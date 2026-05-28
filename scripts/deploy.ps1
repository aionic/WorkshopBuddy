# =============================================================================
# Workshop Buddy — azd deploy wrapper
# =============================================================================
# Usage:
#   pwsh scripts/deploy.ps1            # local Docker build (default, fastest)
#   pwsh scripts/deploy.ps1 -Remote    # ACR remote build (no Docker needed)
#   pwsh scripts/deploy.ps1 -Stream    # show full docker/azd output (debug)
#
# By default azd swallows docker build output and only shows the spinner
# (`Packaging service web (Building Docker image)`). -Stream sets
# BUILDKIT_PROGRESS=plain and passes `--debug` to azd so every layer,
# every package install, every Next.js compile line is visible.
#
# Why not just `azd deploy`?
#   azd 1.24.x does not interpolate env vars into the `remoteBuild` field
#   of azure.yaml (it must be a literal bool). This script flips the line
#   in place before the deploy and restores it afterward.
#
# Use -Remote on CI runners, machines without Docker Desktop, or when the
# local image build is the bottleneck and ACR is faster (rare for first
# build, common for cold-cache CI).
# =============================================================================
[CmdletBinding()]
param(
  [switch]$Remote,
  [switch]$Stream,
  [string[]]$AzdArgs = @("--no-prompt")
)

$ErrorActionPreference = "Stop"

if ($Stream) {
  # BuildKit honors this for any `docker build` invocation in this process tree
  # (azd shells out to docker, which inherits the env). `plain` disables the
  # animated TTY renderer and emits each step's stdout/stderr line-by-line.
  $env:BUILDKIT_PROGRESS = "plain"
  $env:DOCKER_BUILDKIT   = "1"
  if ($AzdArgs -notcontains "--debug") { $AzdArgs += "--debug" }
  Write-Host "Stream mode: BUILDKIT_PROGRESS=plain, azd --debug" -ForegroundColor Yellow
}
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$yamlPath = Join-Path $repoRoot "azure.yaml"

if (-not (Test-Path $yamlPath)) {
  throw "azure.yaml not found at $yamlPath"
}

$originalContent = Get-Content $yamlPath -Raw
$wantValue = if ($Remote) { 'true' } else { 'false' }

# Match the remoteBuild line under services.web.docker, preserving indent.
$pattern = '(?m)^(\s*remoteBuild:\s*)(true|false)\s*$'
$matchInfo = [regex]::Match($originalContent, $pattern)
if (-not $matchInfo.Success) {
  throw "Could not locate 'remoteBuild:' line in azure.yaml. Edit manually."
}
$currentValue = $matchInfo.Groups[2].Value
$indent = $matchInfo.Groups[1].Value

if ($currentValue -eq $wantValue) {
  Write-Host "azure.yaml already has remoteBuild: $wantValue — no patch needed." -ForegroundColor DarkGray
  $patched = $false
} else {
  $newContent = [regex]::Replace($originalContent, $pattern, "$indent$wantValue")
  Set-Content -Path $yamlPath -Value $newContent -NoNewline
  Write-Host "Patched azure.yaml → remoteBuild: $wantValue" -ForegroundColor Cyan
  $patched = $true
}

$mode = if ($Remote) { "ACR remote build" } else { "local Docker build" }
Write-Host "==> azd deploy ($mode)" -ForegroundColor Green

try {
  Push-Location $repoRoot
  & azd deploy @AzdArgs
  $exit = $LASTEXITCODE
} finally {
  Pop-Location
  if ($patched) {
    Set-Content -Path $yamlPath -Value $originalContent -NoNewline
    Write-Host "Restored azure.yaml to remoteBuild: $currentValue" -ForegroundColor DarkGray
  }
}

exit $exit
