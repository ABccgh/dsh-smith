#!/usr/bin/env pwsh
# Upload local git objects to GitHub through the REST API and move a ref to them.
#
# Git cannot push here: schannel fails the revocation check (CRYPT_E_NO_REVOCATION_CHECK)
# and the OpenSSL backend has no CA bundle. HTTPS to the API works, so this reproduces
# `git push` in the order the API requires: blobs -> trees (bottom-up) -> commits -> ref.
#
# THE BUG THIS FILE WAS REWRITTEN TO FIX: the tree API takes a **bare entry name** in
# `path`, never a path. Passing `bin/preflight.mjs` creates a *subtree* at `bin/` inside
# the tree being built, which lands as `bin/bin/preflight.mjs`. Measured on a real push:
# every directory was doubled. -DryRun prints the object graph without writing anything.
#
# Usage:
#   $env:GH_TOKEN='...'; pwsh -File push-api.ps1 -Base <sha>                    # push through HEAD
#   $env:GH_TOKEN='...'; pwsh -File push-api.ps1 -Base <sha> -DryRun            # inspect only
#   $env:GH_TOKEN='...'; pwsh -File push-api.ps1 -Base <sha> -Force             # rewrite the ref

param(
  [string]$RemoteOwner = 'ABccgh',
  [string]$RemoteRepo  = 'dsh-smith',
  [string]$Branch      = 'main',
  [Parameter(Mandatory = $true)][string]$Base,
  [string]$RepoRoot    = (Get-Location).Path,
  [switch]$DryRun,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$token = $env:GH_TOKEN
if (-not $token) { throw 'GH_TOKEN is not set.' }

$hdr = @{
  Authorization = "Bearer $token"
  'User-Agent'  = 'dsh-push'
  Accept        = 'application/vnd.github+json'
}
$api = "https://api.github.com/repos/$RemoteOwner/$RemoteRepo"

function Invoke-Api {
  param([string]$Uri, [string]$Method = 'Get', $Body)
  $p = @{ Uri = $Uri; Method = $Method; Headers = $hdr; TimeoutSec = 120 }
  if ($Body) {
    $p.ContentType = 'application/json'
    $p.Body = ($Body | ConvertTo-Json -Depth 12 -Compress)
  }
  return Invoke-RestMethod @p
}

# git with a byte-exact stdout pipe, so binary blobs survive the round trip.
function GitBytes {
  param([string[]]$GitArgs)
  $psi = [System.Diagnostics.ProcessStartInfo]::new()
  $psi.FileName = 'git'
  $psi.WorkingDirectory = $RepoRoot
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

function GitText { param([string[]]$GitArgs) [System.Text.Encoding]::UTF8.GetString((GitBytes -GitArgs $GitArgs)) }

# Commit message through a FILE: capturing git stdout as a PowerShell string collapses
# newlines into spaces, which produced a one-line message and a 422 from the API.
function Get-Message {
  param([string]$Sha)
  $psi = [System.Diagnostics.ProcessStartInfo]::new()
  $psi.FileName = 'git'
  $psi.WorkingDirectory = $RepoRoot
  foreach ($a in @('log', '-1', '--format=%B', $Sha)) { $psi.ArgumentList.Add($a) }
  $psi.RedirectStandardOutput = $true
  $psi.UseShellExecute = $false
  $proc = [System.Diagnostics.Process]::Start($psi)
  $raw = $proc.StandardOutput.ReadToEnd()
  $proc.WaitForExit()
  $tmp = Join-Path ([System.IO.Path]::GetTempPath()) "dsh-msg-$($Sha.Substring(0,7)).txt"
  [System.IO.File]::WriteAllText($tmp, $raw, (New-Object System.Text.UTF8Encoding($false)))
  $text = [System.IO.File]::ReadAllText($tmp).TrimEnd()
  Remove-Item $tmp -ErrorAction SilentlyContinue
  # Multi-line messages and one-liners are BOTH legitimate — the first commit in this
  # repository's history that carried only a subject line failed a version of this check
  # that demanded a newline. The real hazard is the opposite one: a message that HAS body
  # paragraphs but arrived flattened, which is what a naive stdout capture produces and
  # what the API accepts as a single very long subject line. Detect that shape instead.
  if ($raw -match '\.\s{2,}[A-Z]' -and -not $text.Contains([char]10)) {
    throw "commit $($Sha.Substring(0,7)) message looks flattened: paragraphs joined onto one line"
  }
  return $text
}

$script:blobCount = 0
$script:treeCount = 0
# Memoize by SHA. A file reachable through several trees would otherwise be uploaded once
# per path — measured: 88 blob uploads for 22 distinct blobs before this cache existed.
# The API is idempotent per content SHA, so a repeat is wasteful rather than wrong.
$script:seen = @{}

function Push-Blob {
  param([string]$Sha)
  if ($script:seen.ContainsKey($Sha)) { return $script:seen[$Sha] }
  $bytes = GitBytes -GitArgs @('cat-file', 'blob', $Sha)
  if ($DryRun) { $script:blobCount++; $script:seen[$Sha] = $Sha; return $Sha }
  $r = Invoke-Api -Uri "$api/git/blobs" -Method Post -Body @{
    content  = [Convert]::ToBase64String($bytes)
    encoding = 'base64'
  }
  # Uploading the raw bytes keeps the SHA identical, so the resulting tree is byte-for-byte
  # the local one and the commit's tree hash matches `git rev-parse <sha>^{tree}`.
  if ($r.sha -ne $Sha) { throw "blob $Sha came back as $($r.sha) — tree would not match" }
  $script:blobCount++
  $script:seen[$Sha] = $r.sha
  return $r.sha
}

function Push-Tree {
  param([string]$TreeSha, [string]$Label = '')
  if ($script:seen.ContainsKey("tree:$TreeSha")) { return $script:seen["tree:$TreeSha"] }
  $listing = GitText -GitArgs @('cat-file', '-p', $TreeSha)
  $entries = @()
  foreach ($line in ($listing -split "`n")) {
    if ($line.Trim() -eq '') { continue }
    $m = [regex]::Match($line, '^([0-9]+) (blob|tree|commit) ([0-9a-f]{40})\t(.+)$')
    if (-not $m.Success) { throw "unparsable tree line: $line" }
    $mode = $m.Groups[1].Value; $type = $m.Groups[2].Value
    $sha  = $m.Groups[3].Value; $name = $m.Groups[4].Value
    if ($type -eq 'blob') {
      $newSha = Push-Blob -Sha $sha
    } elseif ($type -eq 'tree') {
      $newSha = Push-Tree -TreeSha $sha -Label "$Label$name/"
    } else {
      throw "unsupported tree entry: $type"
    }
    # `path` must be the bare entry name. Anything containing a slash makes the API
    # create a nested subtree instead of recording the name.
    if ($name.Contains('/')) { throw "entry name contains a slash: $name" }
    $entries += @{ path = $name; mode = $mode; type = $type; sha = $newSha }
  }
  if ($DryRun) { $script:treeCount++; $script:seen["tree:$TreeSha"] = $TreeSha; return $TreeSha }
  $r = Invoke-Api -Uri "$api/git/trees" -Method Post -Body @{ tree = $entries }
  $script:treeCount++
  $script:seen["tree:$TreeSha"] = $r.sha
  return $r.sha
}

# ── main ────────────────────────────────────────────────────────────────────
$logLines = (GitText -GitArgs @('log', '--reverse', '--format=%H|%T|%an|%ae|%aI|%cn|%ce|%cI', "$Base..HEAD")) -split "`n" |
  Where-Object { $_.Trim() -ne '' }

"-"
"target      : $RemoteOwner/$RemoteRepo  branch=$Branch"
"base        : $($Base.Substring(0,7))"
"commits     : $($logLines.Count)"
if ($DryRun) { "mode        : DRY RUN — nothing is written" }
""

# Read and validate EVERY message before the first write. Reading is free and cannot
# half-fail; a message problem discovered after blobs and trees are uploaded would leave
# objects on the remote that no commit references.
$plan = @()
foreach ($line in $logLines) {
  $f = $line.Split('|')
  $plan += [pscustomobject]@{
    Sha = $f[0]; Tree = $f[1]
    AuthorName = $f[2]; AuthorEmail = $f[3]; AuthorDate = $f[4]
    CommitterName = $f[5]; CommitterEmail = $f[6]; CommitterDate = $f[7]
    Message = (Get-Message -Sha $f[0])
  }
}
"messages read and validated: $($plan.Count)"
""

$parent = $Base
$pushed = @()
foreach ($item in $plan) {
  $sha = $item.Sha
  $tree = Push-Tree -TreeSha $item.Tree -Label ''
  $msg = $item.Message
  $localTree = (GitText -GitArgs @('rev-parse', "$sha^{tree}")).Trim()
  $treeOk = if ($DryRun) { 'n/a (dry run)' } else { $tree -eq $localTree }
  "-> $($sha.Substring(0,7))"
  "   tree   remote=$($tree.Substring(0,7))  local=$($localTree.Substring(0,7))  match=$treeOk"
  "   msg    $((($msg -split "`n").Count)) lines, first: $($msg.Split([char]10)[0])"
  if (-not $DryRun -and -not $treeOk) { throw "tree mismatch for $($sha.Substring(0,7)) — refusing to commit" }
  if ($DryRun) { continue }
  $body = @{
    message   = $msg
    tree      = $tree
    parents   = @($parent)
    author    = @{ name = $item.AuthorName; email = $item.AuthorEmail; date = $item.AuthorDate }
    committer = @{ name = $item.CommitterName; email = $item.CommitterEmail; date = $item.CommitterDate }
  }
  $r = Invoke-Api -Uri "$api/git/commits" -Method Post -Body $body
  "   commit $($r.sha.Substring(0,7))"
  $pushed += [pscustomobject]@{ Local = $sha; Remote = $r.sha }
  $parent = $r.sha
}

""
"blobs uploaded: $script:blobCount   trees created: $script:treeCount"
if ($DryRun) { "DRY RUN complete — ref untouched."; exit 0 }

"updating refs/heads/$Branch -> $($parent.Substring(0,7))  (force=$($Force.IsPresent))"
$u = Invoke-Api -Uri "$api/git/refs/heads/$Branch" -Method Patch -Body @{ sha = $parent; force = $Force.IsPresent }
"done: $($u.ref) = $($u.object.sha)"
$pushed | Format-Table -AutoSize

# Print the map for syncing the local clone (API commits are re-encoded, so SHAs differ).
""
"LOCAL -> REMOTE"
foreach ($row in $pushed) { "  $($row.Local)  ->  $($row.Remote)" }
