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
  # The LOCAL commit to start the range from. Required for an ordinary push; ignored in
  # -Init mode, where the range is the whole history reachable from HEAD.
  [string]$Base,
  [string]$RemoteBase,
  [string]$Branch = 'main',
  [string]$RemoteOwner = 'ABccgh',
  [string]$RemoteRepo = 'dsh-smith',
  # Create refs/heads/<Branch> for an EMPTY target repository: the first commit is sent as a
  # root commit (empty parents) and the ref is created with POST /git/refs, because PATCH
  # cannot move a reference that does not exist. Refuses to run when the ref already exists.
  [switch]$Init,
  # Allow the final reference move to discard commits that are on the remote and not in this
  # push. Needed exactly once, when a previous -Init run died after its bootstrap write: that
  # bootstrap commit is then the branch's root and is unrelated to the local history, so the
  # branch has no common ancestor to move forward from. The discarded commit's only content is
  # the bootstrap file this script deletes anyway, so nothing a reader wants is lost — and the
  # flag is explicit rather than implied, because a force move is not a safe default.
  [switch]$Force,
  # The throwaway path a -Init run writes through the Contents API to bootstrap an empty
  # repository, and deletes again once the real commit has been pushed.
  [string]$BootstrapFile = '.dsh-bootstrap',
  [switch]$Trace,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
if (-not $Init -and -not $Force -and [string]::IsNullOrWhiteSpace($Base)) {
  throw '-Base is required unless -Init or -Force is given (-Init seeds an empty repository; -Force moves the branch onto the whole local history).'
}
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
if ($Init) {
  # Initialization: the target repository is supposed to be EMPTY, so there is no remote
  # base to pair against and the range is simply "everything reachable from HEAD". The
  # range walk below still refuses a mismatch, so -Init cannot be used to paper over a
  # misconfigured pair on a repository that already has commits.
  $localShas = @(git -C $PWD rev-list --reverse HEAD)
  if ($localShas.Count -eq 0) { throw 'no commits in HEAD' }
  "mode        : INIT (target ref refs/heads/$Branch is expected to be absent)"
} elseif ($Force) {
  # Force-move: the branch is taken over by the whole local history, so the range is again
  # everything reachable from HEAD and it must start at a root commit (checked below).
  $localShas = @(git -C $PWD rev-list --reverse HEAD)
  if ($localShas.Count -eq 0) { throw 'no commits in HEAD' }
  "mode        : FORCE (refs/heads/$Branch will be moved onto the whole local history)"
} else {
  $localShas = @(git -C $PWD log --reverse --format='%H' "$Base..HEAD")
}
if ($localShas.Count -eq 0) { throw "no local commits in $Base..HEAD" }
"local range : $(if ($Init -or $Force) { 'HEAD (all)' } else { "$Base..HEAD" })  ($($localShas.Count) commit(s))"
foreach ($s in $localShas) { "  $($s.Substring(0,7))  $((git -C $PWD log -1 --format='%s' $s))" }

# --- 2. the remote range, oldest first, read from the API ----------------------------
$tip = $null
try {
  $ref = Api "$api/git/refs/heads/$Branch"
  $tip = $ref.object.sha
  "remote tip  : $tip"
} catch {
  # An absent ref does not answer 404. MEASURED on a freshly created empty repository:
  # `GET /repos/<o>/<r>/git/refs/heads/main` answers **409** ("Git Repository is empty"),
  # and so does the refs list. So the failure is treated as "no ref", and the two guards
  # that matter are kept elsewhere: the repository must be reachable at all, and an
  # an INIT run refuses outright when a ref turns out to exist.
  try {
    $null = Api "$api"
  } catch {
    throw "target repository $RemoteOwner/$RemoteRepo is not reachable with this token — check -RemoteOwner/-RemoteRepo"
  }
  if (-not $Init) { throw "refs/heads/$Branch is absent on $RemoteOwner/$RemoteRepo — pass -Init to create it as a root commit" }
  "remote tip  : (none — refs/heads/$Branch does not exist)"
  # MEASURED: a TRULY empty repository rejects object creation outright —
  # `POST /git/blobs` answers 409 "Git Repository is empty." The git database endpoints are
  # unusable until the repository owns at least one commit, so the only way in is the
  # Contents API, which bootstraps a first commit and the default branch in one call.
  #
  # The bootstrap file is then DELETED through the same API, which leaves the branch with an
  # empty tree. That second commit is unavoidable and is why this path prints a warning: the
  # branch's first commit is the bootstrap, not this script's. Two cheaper-looking escapes
  # were measured and do NOT work — `POST /git/trees` with an empty array answers
  # `422 Invalid tree info`, and PUT /contents rejects an empty content with
  # `422 content is not valid Base64`.
  if (-not $DryRun) {
    "bootstrapping an empty repository with $BootstrapFile"
    $seed = Api "$api/contents/$BootstrapFile" 'Put' @{
      message = 'chore: bootstrap the default branch so the git database endpoints accept objects'
      content = [Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes("delete me`n"))
    }
    "  bootstrap commit: $($seed.commit.sha.Substring(0,7))"
    $removed = Api "$api/contents/$BootstrapFile" 'Delete' @{
      message = 'chore: remove the bootstrap file'
      sha     = $seed.content.sha
    }
    "  cleanup commit  : $($removed.commit.sha.Substring(0,7))"
    $filesAfter = Api "$api/contents?ref=$Branch"
    if (@($filesAfter).Count -ne 0) { throw "bootstrap cleanup left $(@($filesAfter).Count) file(s) on $Branch" }
    "  branch $Branch now exists with an empty tree"
    "  NOTE: those two bootstrap commits are the branch's root; this script's own commit"
    "        becomes its child, so the repository's first two log entries are not the payload."
  } else {
    "  (dry run: an empty repository rejects object creation, so a real run would bootstrap"
    "   it through the Contents API, delete the bootstrap file, then push the real history)"
  }
}
$remoteShas = New-Object System.Collections.Generic.List[string]
if ($null -ne $tip) {
  # Does the remote already contain the local tip at all? If not, there is nothing to pair and
  # no common ancestor to move forward from: the local history is entirely new to this
  # repository, which is what a RETRIED -Init looks like (a previous run's bootstrap commit is
  # then the branch's only content). Requiring -Force makes that explicit, because the move
  # discards commits that exist only on the remote.
  #
  # Reachability is answered by walking the remote first-parent chain, NOT by /compare: a
  # compare against a SHA it does not hold answers `identical` rather than an error, which
  # reads exactly like success. Measured on this repository.
  $localTip = (git -C $PWD rev-parse HEAD).Trim()
  $remoteTipReachable = New-Object System.Collections.Generic.List[string]
  $probe = $tip
  for ($hop = 0; $hop -lt 200 -and $null -ne $probe; $hop++) {
    $remoteTipReachable.Add($probe)
    if ($probe -eq $localTip) { break }
    try { $probe = (Api "$api/git/commits/$probe").parents[0].sha } catch { $probe = $null }
  }
  $remoteContainsLocalTip = $remoteTipReachable.Contains($localTip)

  if (-not $remoteContainsLocalTip) {
    if (-not $Force) {
      throw "the remote tip $($tip.Substring(0,7)) shares no history with this push (typically a previous -Init run's bootstrap commit) — pass -Force to move the branch onto the local history"
    }
    "remote history is unrelated to this push — moving the branch onto the local history (-Force)"
    $script:moveOntoLocalHistory = $true
  } else {
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
    "remote contains the local history: (compare succeeded)"
  }
} else {
  # An absent ref is zero remote commits, so the local range must be exactly the commits
  # whose parent chain starts outside the remote — i.e. the target is genuinely empty.
  "remote range: (empty)"
}

if ($Init -and $remoteShas.Count -ne 0) {
  throw "refs/heads/$Branch already has $($remoteShas.Count) commit(s) — -Init is for an empty repository; drop it and pass -RemoteBase"
}
if (-not $Init -and -not $script:moveOntoLocalHistory -and $localShas.Count -ne $remoteShas.Count) {
  throw "range length mismatch: $($localShas.Count) local vs $($remoteShas.Count) remote — the bases do not pair, refusing to run"
}
if ($script:moveOntoLocalHistory) {
  # Nothing pairs here: the remote content is unrelated to this push, and the local history
  # takes the branch over entirely. The local range must therefore be self-contained, i.e.
  # start at a root commit, or the branch would be left pointing at a partial history.
  $firstParentCount = @(git -C $PWD rev-list --parents -n 1 $localShas[0]).Count
  if (@(git -C $PWD rev-list --parents -n 1 $localShas[0]) | Select-Object -Skip 1) {
    throw "-Force is only valid when the local range starts at a root commit; $($localShas[0].Substring(0,7)) has a parent"
  }
}

# local sha -> remote sha, position by position. Empty in INIT mode, where the whole local
# history is new and the pairing has nothing to pair with.
$map = @{}
for ($i = 0; $i -lt $remoteShas.Count; $i++) { $map[$localShas[$i]] = $remoteShas[$i] }
if ($map.Count -gt 0) {
  "paired      : " + (($map.Keys | ForEach-Object { "$($_.Substring(0,7))->$($map[$_].Substring(0,7))" }) -join '  ')
} else {
  "paired      : (none — every commit in range is new)"
}

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
# In INIT mode the tip is absent, and a root commit must carry an EMPTY parents list
# rather than omit the key — `parents = @()` serializes as `"parents":[]`, which is what
# the git database API accepts for a commit with no parent.
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
  # A local commit's own parent count is the authority on whether the API commit is a root:
  # rev-parse "<sha>^" fails on a root commit, so use the parent list, never `^`.
  $localParents = @(git -C $PWD rev-list --parents -n 1 $sha) -split '\s+' | Select-Object -Skip 1
  $isRoot = $localParents.Count -eq 0
  if ($isRoot -and $null -ne $parent -and -not $script:moveOntoLocalHistory -and -not $Init) {
    throw "local commit $($sha.Substring(0,7)) is a root but the remote already has a tip — refusing to create a second history (pass -Force to replace the branch)"
  }
  if (-not $isRoot -and $null -eq $parent) { throw "local commit $($sha.Substring(0,7)) has a parent but no remote parent is available — the range starts mid-history" }
  $parentLabel = if ($isRoot) { '(root)' } else { $parent.Substring(0, 7) }
  "-> $($sha.Substring(0,7))  parent(remote)=$parentLabel  tree=$($tree.Substring(0,7))"
  "   msg type=$($message.GetType().Name) $((($message -split "`n").Count)) lines: $(($message -split "`n")[0])"
  $uploaded = Push-Tree -Sha $tree
  if ($uploaded -ne $tree) { throw "tree id changed: $tree -> $uploaded" }
  if ($DryRun) { continue }
  $commitBody = @{
    message   = $message
    tree      = $uploaded
    author    = @{ name = $authorName; email = $authorEmail; date = $authorDate }
    committer = @{ name = $authorName; email = $authorEmail; date = $authorDate }
  }
  # A root commit carries NO parent, and PowerShell's ConvertTo-Json DROPS an empty array, so
  # `parents = @($null)` would vanish while `parents = @(<sha>)` would not — the key is left
  # out deliberately rather than set to an empty list, and added only when a parent exists.
  if (-not $isRoot) { $commitBody.parents = @($parent) }
  # Serialized once, so the body sent is the body printed when -Trace is on.
  $json = ($commitBody | ConvertTo-Json -Depth 20 -Compress)
  if ($Trace) { "[TRACE] POST $api/git/commits`n         $($json.Substring(0, [Math]::Min(300, $json.Length)))" }
  $commit = Api "$api/git/commits" 'Post' $commitBody
  if ($isRoot) {
    if (@($commit.parents).Count -ne 0) { throw "created commit has $(@($commit.parents).Count) parent(s); a root commit must have none" }
  } elseif ($commit.parents[0].sha -ne $parent) {
    throw "created commit parent $($commit.parents[0].sha) != $parent"
  }
  if ($commit.tree.sha -ne $tree) { throw "created commit tree $($commit.tree.sha) != $tree" }
  "   commit $($commit.sha)$(if ($isRoot) { '  (root)' } else { '' })"
  $pushed += [pscustomobject]@{ Local = $sha; Remote = $commit.sha }
  $parent = $commit.sha
}

"blobs: $blobCount  trees: $treeCount"
if ($DryRun) { 'DRY RUN complete — ref untouched.'; exit 0 }

# --- 5. move the ref, then read it back ---------------------------------------------
# Two different calls, because an absent ref cannot be moved: PATCH updates an existing
# reference and answers 422 for one that does not exist, while POST /git/refs creates it.
# In INIT mode the local commit count is exactly the number that just became new history.
if ($Init) {
  "creating refs/heads/$Branch -> $($parent.Substring(0,7))"
  $updated = Api "$api/git/refs" 'Post' @{ ref = "refs/heads/$Branch"; sha = $parent }
} else {
  "updating refs/heads/$Branch -> $($parent.Substring(0,7))  (force=$($Force.IsPresent))"
  $updated = Api "$api/git/refs/heads/$Branch" 'Patch' @{ sha = $parent; force = $Force.IsPresent }
}
$verify = Api "$api/git/refs/heads/$Branch"
"ref now     : $($verify.object.sha)"
if ($verify.object.sha -ne $parent) { throw "ref does not point at $parent" }
if ($Init -and @($pushed).Count -ne @(git -C $PWD rev-list --count HEAD).Count) {
  throw "INIT pushed $((@($pushed).Count)) commit(s) but HEAD reachable history is $(@(git -C $PWD rev-list --count HEAD))"
}
$headTree = (git -C $PWD rev-parse 'HEAD^{tree}').Trim()
$final = Api "$api/git/commits/$($verify.object.sha)"
"remote tree : $($final.tree.sha)"
"local tree  : $headTree"
if ($final.tree.sha -ne $headTree) { throw 'remote tree does not equal the local HEAD tree' }
''
'LOCAL -> REMOTE'
foreach ($row in $pushed) { "  $($row.Local)  ->  $($row.Remote)" }
"OK: remote tip $($verify.object.sha) carries the local tree $headTree"
