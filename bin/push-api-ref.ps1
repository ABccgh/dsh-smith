# Upload the objects for one commit range and move refs/heads/main.
#
# WHY THIS EXISTS RATHER THAN A SECOND RUN OF bin/push-api.ps1: that script ran
# twice, created a commit both times, and then failed the ref update with 422
# "Update is not a fast forward" — while the remote tip's parent is exactly the
# -RemoteBase passed to it. Its tree objects uploaded fine and are present on the
# remote. Rather than keep guessing which input it used, this walks the SAME
# range, prints every id it sends, and verifies each one before it is used.
#
# THE MAPPING, which is the part a single-SHA design cannot express: an
# API-created commit is re-encoded, so THE REMOTE TIP IS NEVER EQUAL TO A LOCAL
# SHA. Two bases express that, and the pair is only valid when both ranges have
# the same length:
#   local  (-Base, HEAD]           ==  remote (-RemoteBase, remote tip]
#
# AND THE MAPPING IS NOT THE PARENT FOR THE NEW COMMIT — this is the trap that
# cost several attempts, so it is written down here. Position-by-position
# pairing says "local commit 1 corresponds to remote commit 1", which is a
# statement about CONTENT. It is not a statement about ancestry: the remote
# commit that corresponds to the previous local commit is ALREADY PUSHED, so
# parenting the new commit at that commit makes it a SIBLING of the current
# remote tip, not its descendant. GitHub answers exactly that with
#   `422 Update is not a fast forward`
# and `GET /compare/main...<new>` then reports `status=diverged ahead=1 behind=1`,
# which is how this was finally diagnosed rather than guessed.
# The parent of the first new commit must therefore be THE REMOTE TIP (or an
# ancestor of it, in a multi-commit batch, where each commit parents the one
# before and only the batch's first commit touches the existing history).
#
# Usage:
#   $env:GH_TOKEN='...'; pwsh -File bin\push-api-ref.ps1 -Base <local> -RemoteBase <remote> -DryRun
#   $env:GH_TOKEN='...'; pwsh -File bin\push-api-ref.ps1 -Base <local> -RemoteBase <remote>
param(
  [Parameter(Mandatory = $true)][string]$Base,
  [string]$RemoteBase,
  [string]$Branch = 'main',
  [string]$RemoteOwner = 'ABccgh',
  [string]$RemoteRepo = 'dsh-smith',
  [switch]$Trace,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$token = $env:GH_TOKEN
if (-not $token) { throw 'GH_TOKEN is not set.' }
$hdr = @{ Authorization = "Bearer $token"; 'User-Agent' = 'dsh-session'; Accept = 'application/vnd.github+json' }
$api = "https://api.github.com/repos/$RemoteOwner/$RemoteRepo"

# git with a byte-exact stdout pipe. A PowerShell capture of git's stdout decodes it as text
# and rewrites line endings, which corrupts both binary blobs and canonical blob bytes —
# `bin/push-api.ps1` carries the same helper for the same reason.
function GitBytes {
  param([string[]]$GitArgs)
  $psi = [System.Diagnostics.ProcessStartInfo]::new()
  $psi.FileName = 'git'
  $psi.WorkingDirectory = $PWD.Path
  foreach ($a in $GitArgs) { $psi.ArgumentList.Add($a) }
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.UseShellExecute = $false
  $proc = [System.Diagnostics.Process]::Start($psi)
  $ms = [System.IO.MemoryStream]::new()
  $proc.StandardOutput.BaseStream.CopyTo($ms)
  $err = $proc.StandardError.ReadToEnd()
  $proc.WaitForExit()
  if ($proc.ExitCode -ne 0) { throw "git $($GitArgs -join ' ') failed: $err" }
  return $ms.ToArray()
}

# The git object id of one byte sequence: SHA1("<type> <byte-length>\0" + bytes).
# The header is part of the hash — hashing the content alone gives a plausible-looking but wrong
# id, which is how the first version of the blob check reported a mismatch on every file.
function Get-GitObjectId {
  param([string]$Type, [byte[]]$Bytes)
  $header = [System.Text.Encoding]::ASCII.GetBytes("$Type $($Bytes.Length)`0")
  $full = [byte[]]::new($header.Length + $Bytes.Length)
  [Array]::Copy($header, 0, $full, 0, $header.Length)
  [Array]::Copy($Bytes, 0, $full, $header.Length, $Bytes.Length)
  return ((([System.Security.Cryptography.SHA1]::Create().ComputeHash($full)) | ForEach-Object { $_.ToString('x2') }) -join '')
}

function Api {
  param([string]$Uri, [string]$Method = 'Get', $Body)
  $p = @{ Uri = $Uri; Method = $Method; Headers = $hdr; TimeoutSec = 120 }
  if ($Body) {
    $p.ContentType = 'application/json'
    $p.Body = ($Body | ConvertTo-Json -Depth 20 -Compress)
  }
  Invoke-RestMethod @p
}

# --- 1. the local range, oldest first ------------------------------------------------
$localShas = @(git -C $PWD log --reverse --format='%H' "$Base..HEAD")
if ($localShas.Count -eq 0) { throw "no local commits in $Base..HEAD" }
"local range : $Base..HEAD  ($($localShas.Count) commit(s))"
foreach ($s in $localShas) { "  $($s.Substring(0,7))  $((git -C $PWD log -1 --format='%s' $s))" }

# --- 2. the remote range, oldest first, read from the API ----------------------------
$ref = Api "$api/git/refs/heads/$Branch"
$tip = $ref.object.sha
"remote tip  : $tip"
$remoteShas = New-Object System.Collections.Generic.List[string]
$cursor = $tip
while ($cursor -and $cursor -ne $RemoteBase) {
  $remoteShas.Insert(0, $cursor)
  $c = Api "$api/git/commits/$cursor"
  $cursor = $c.parents[0].sha
  if ($remoteShas.Count -gt 50) { throw 'walked 50 commits without reaching -RemoteBase; wrong base?' }
}
if ($cursor -ne $RemoteBase) { throw "remote history does not contain -RemoteBase $RemoteBase" }
"remote range: $RemoteBase..$tip  ($($remoteShas.Count) commit(s))"
foreach ($s in $remoteShas) { "  $($s.Substring(0,7))" }

if ($localShas.Count -ne $remoteShas.Count) {
  throw "range length mismatch: $($localShas.Count) local vs $($remoteShas.Count) remote — the bases do not pair, refusing to run"
}

# local sha -> remote sha, position by position
$map = @{}
for ($i = 0; $i -lt $localShas.Count; $i++) { $map[$localShas[$i]] = $remoteShas[$i] }
"paired      : " + (($localShas | ForEach-Object { "$($_.Substring(0,7))->$($map[$_].Substring(0,7))" }) -join '  ')

# --- 3. upload blobs and trees bottom-up, verifying every id -------------------------
$blobCount = 0
$treeCount = 0
function Push-Tree {
  param([string]$Sha)
  $existing = $null
  try { $existing = Api "$api/git/trees/$Sha" } catch { $existing = $null }
  if ($null -ne $existing -and $existing.sha -eq $Sha) { return $Sha }
  # `--full-tree`, not `--full`: `--full` is an ambiguous prefix in this git and is rejected
  # with `ambiguous option: full (could be --full-name or --full-tree)`. This path is only
  # reached for a tree the remote does not already have, which is why it survived the first
  # run — every object was already content-addressed there, so the function returned early
  # on line 97 and this line never executed.
  $ls = git -C $PWD ls-tree $Sha --full-tree
  $entries = @()
  foreach ($line in $ls) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    $m = [regex]::Match($line, '^(?<mode>\S+)\s+(?<type>\S+)\s+(?<sha>[0-9a-f]{40})\t(?<path>.*)$')
    if (-not $m.Success) { throw "unparsable ls-tree line: $line" }
    $mode = $m.Groups['mode'].Value
    $type = $m.Groups['type'].Value
    $childSha = $m.Groups['sha'].Value
    $path = $m.Groups['path'].Value
    if ($type -eq 'commit') { $entries += @{ path = $path; mode = $mode; type = 'commit'; sha = $childSha }; continue }
    if ($type -eq 'tree') { $entries += @{ path = $path; mode = $mode; type = 'tree'; sha = (Push-Tree -Sha $childSha) }; continue }
    if ($type -ne 'blob') { throw "unsupported tree entry type '$type' at $path" }
    # The bytes must come from GIT, not from the working tree: `.gitattributes` text
    # normalization means the checked-out file can differ from the blob, and this script reads
    # its own `.gitattributes`. `cat-file blob` answers the canonical bytes.
    $bytes = GitBytes -GitArgs @('cat-file', 'blob', $childSha)
    # A blob id is SHA1("blob <byte-length>\0" + content) — the header is part of the hash, and
    # hashing the content alone gives a WRONG id that looks plausible. Measured: content-only
    # gave 886063dc… for a blob git knows as 6f0169e9…, and the header form reproduces git's id.
    $gitBlobId = (Get-GitObjectId -Type 'blob' -Bytes $bytes)
    if ($gitBlobId -ne $childSha) { throw "blob id mismatch for $path : computed $gitBlobId, git says $childSha" }
    if (-not $DryRun) {
      $created = Api "$api/git/blobs" 'Post' @{ content = [Convert]::ToBase64String($bytes); encoding = 'base64' }
      if ($created.sha -ne $childSha) { throw "blob upload for $path returned $($created.sha), expected $childSha" }
    }
    $script:blobCount++
    $entries += @{ path = $path; mode = $mode; type = 'blob'; sha = $childSha }
  }
  if ($DryRun) { $script:treeCount++; return $Sha }
  $tree = Api "$api/git/trees" 'Post' @{ tree = $entries }
  if ($tree.sha -ne $Sha) { throw "tree creation returned $($tree.sha), expected $Sha" }
  $script:treeCount++
  return $tree.sha
}

# --- 4. one commit per local commit, parents taken from the mapping ------------------
# The FIRST commit's parent is the remote TIP, not the mapped remote base: the mapped
# base is already in the remote history, so parenting there produces a sibling. Each
# later commit parents the one created before it, so the batch extends the tip.
$parent = $tip
$pushed = @()
foreach ($sha in $localShas) {
  $tree = (git -C $PWD rev-parse "$sha^{tree}").Trim()
  # A commit message MUST reach the API as a JSON string. `git log --format=%B` in a
  # PowerShell pipeline yields a STRING ARRAY (one element per line), and the API answers
  # 422 "For 'properties/message', [...] is not a string" — the array is the tell. The
  # joined-and-split shape keeps it a string while preserving the raw line breaks.
  # Measured: bin/push-api.ps1 reads the message through a UTF-8 round trip for the same
  # reason; the first version of this script did not, and this is the error it produced.
  $message = ((@(git -C $PWD log -1 --format='%B' $sha) -join "`n"))
  $authorName = (git -C $PWD log -1 --format='%an' $sha)
  $authorEmail = (git -C $PWD log -1 --format='%ae' $sha)
  $authorDate = (git -C $PWD log -1 --format='%aI' $sha)
  if ($message -isnot [string]) { throw "commit message resolved to $($message.GetType().Name), not a string" }
  if ($message.Trim() -eq '') { throw "commit $($sha.Substring(0,7)) has an empty message" }
  "-> $($sha.Substring(0,7))  parent(remote)=$($parent.Substring(0,7))  tree=$($tree.Substring(0,7))"
  "   msg type=$($message.GetType().Name) $((($message -split "`n").Count)) lines: $(($message -split "`n")[0])"
  $uploaded = Push-Tree -Sha $tree
  if ($uploaded -ne $tree) { throw "tree id changed: $tree -> $uploaded" }
  if ($DryRun) { continue }
  $commitBody = @{
    message   = $message
    tree      = $uploaded
    parents   = @($parent)
    author    = @{ name = $authorName; email = $authorEmail; date = $authorDate }
    committer = @{ name = $authorName; email = $authorEmail; date = $authorDate }
  }
  # Serialized once, so the body sent is the body printed when -Trace is on.
  $json = ($commitBody | ConvertTo-Json -Depth 20 -Compress)
  if ($Trace) { "[TRACE] POST $api/git/commits`n         $($json.Substring(0, [Math]::Min(300, $json.Length)))" }
  $commit = Api "$api/git/commits" 'Post' $commitBody
  if ($commit.parents[0].sha -ne $parent) { throw "created commit parent $($commit.parents[0].sha) != $parent" }
  if ($commit.tree.sha -ne $tree) { throw "created commit tree $($commit.tree.sha) != $tree" }
  "   commit $($commit.sha)"
  $pushed += [pscustomobject]@{ Local = $sha; Remote = $commit.sha }
  $parent = $commit.sha
}

"blobs: $blobCount  trees: $treeCount"
if ($DryRun) { 'DRY RUN complete — ref untouched.'; exit 0 }

# --- 5. move the ref, then read it back ---------------------------------------------
"updating refs/heads/$Branch -> $($parent.Substring(0,7))"
$updated = Api "$api/git/refs/heads/$Branch" 'Patch' @{ sha = $parent; force = $false }
$verify = Api "$api/git/refs/heads/$Branch"
"ref now     : $($verify.object.sha)"
if ($verify.object.sha -ne $parent) { throw "ref did not move to $parent" }
$headTree = (git -C $PWD rev-parse 'HEAD^{tree}').Trim()
$final = Api "$api/git/commits/$($verify.object.sha)"
"remote tree : $($final.tree.sha)"
"local tree  : $headTree"
if ($final.tree.sha -ne $headTree) { throw 'remote tree does not equal the local HEAD tree' }
''
'LOCAL -> REMOTE'
foreach ($row in $pushed) { "  $($row.Local)  ->  $($row.Remote)" }
"OK: remote tip $($verify.object.sha) carries the local tree $headTree"
