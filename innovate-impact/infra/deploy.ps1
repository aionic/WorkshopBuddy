<#
.SYNOPSIS
  Build the Workshop Buddy container image, push it to ACR,
  and deploy / update the Azure Container App in the rgWorkshopBuddy RG.

.PREREQUISITES
  - Azure CLI logged in: az login
  - Correct subscription selected: az account set --subscription <id>
  - Bicep CLI (bundled with recent az): az bicep version
  - Resource group "rgWorkshopBuddy" already exists.
  - The deploying principal needs Owner / User Access Administrator on
    the Foundry account (jamesbas-project-no-hub-resource) so the
    cross-RG role assignment can be created.

.NOTES
  Run from the innovate-impact/ directory (repo root for the app).
#>
[CmdletBinding()]
param(
  [string]$ResourceGroup = 'rgWorkshopBuddy',
  [string]$Location      = 'eastus2',
  [string]$BaseName      = 'workshopbuddy',
  [string]$ImageRepo     = 'workshop-buddy',
  [string]$ImageTag      = $(Get-Date -Format 'yyyyMMddHHmmss'),
  # Pass an empty string to skip punching a firewall hole for your IP.
  [string]$DevWorkstationIp = $(try { (Invoke-RestMethod -Uri 'https://api.ipify.org' -TimeoutSec 5) } catch { '' })
)

$ErrorActionPreference = 'Stop'

# Force UTF-8 so the Azure CLI can stream unicode (e.g. Prisma's ✔) without
# crashing on Windows code page cp1252 (UnicodeEncodeError in colorama).
$env:PYTHONIOENCODING = 'utf-8'
try {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

function Invoke-Az {
  param([Parameter(Mandatory=$true)][string[]]$Args)
  & az @Args
  if ($LASTEXITCODE -ne 0) { throw "az $($Args -join ' ') failed with exit code $LASTEXITCODE" }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot
Write-Host "[1/5] Working directory: $repoRoot" -ForegroundColor Cyan

# 1) Ensure the resource group exists.
Write-Host "[2/5] Verifying resource group '$ResourceGroup'..." -ForegroundColor Cyan
$rgExists = az group exists --name $ResourceGroup | ConvertFrom-Json
if (-not $rgExists) {
  throw "Resource group '$ResourceGroup' does not exist. Create it first: az group create -n $ResourceGroup -l $Location"
}

# 2) Bootstrap deploy (deployApp=false): creates ACR + ACA env + storage but
#    does NOT try to provision the Container App yet (image doesn't exist).
Write-Host "[3/5] Bootstrap deployment (ACR/env/storage only)..." -ForegroundColor Cyan
$bootstrapJson = az deployment group create `
  --resource-group $ResourceGroup `
  --name "workshopbuddy-bootstrap-$ImageTag" `
  --template-file (Join-Path $PSScriptRoot 'main.bicep') `
  --parameters (Join-Path $PSScriptRoot 'main.bicepparam') `
  --parameters baseName=$BaseName imageRepo=$ImageRepo imageTag='bootstrap' deployApp=false pgDevWorkstationIp=$DevWorkstationIp `
  --query 'properties.outputs' `
  -o json
if ($LASTEXITCODE -ne 0) { throw "Bootstrap deployment failed (exit $LASTEXITCODE)." }
$infraOutFirst = $bootstrapJson | ConvertFrom-Json

$acrName        = $infraOutFirst.acrName.value
$acrLoginServer = $infraOutFirst.acrLoginServer.value
if ([string]::IsNullOrWhiteSpace($acrName)) { throw "Bootstrap did not return acrName." }
Write-Host "    ACR: $acrLoginServer" -ForegroundColor DarkGray

# 3) Build & push the image with ACR Tasks (no local Docker required).
#    NOTE 1: --no-logs avoids a Windows-only crash where the Azure CLI's colorama
#    output wrapper hits UnicodeEncodeError on cp1252 when Prisma emits ✔.
#    NOTE 2: az acr build runs `os.walk()` over the source directory BEFORE
#    applying .dockerignore. Windows long paths inside ./node_modules (e.g.
#    @azure/msal-browser deep paths) crash the walker with [WinError 3]. We
#    therefore rename node_modules out of the way for the duration of the
#    upload, then restore it (the Linux build inside ACR runs its own
#    `npm install` so it doesn't need the host's node_modules).
Write-Host "[4/5] Building image $ImageRepo`:$ImageTag in ACR..." -ForegroundColor Cyan
$nodeModulesHidden = $false
$nodeModulesStash = $null
if (Test-Path 'node_modules') {
  # Move node_modules to the SYSTEM TEMP dir (outside the source dir) so
  # `az acr build`'s os.walk() never touches it. Renaming in-place is not
  # enough — the walker still descends into it and crashes on long paths.
  # We use robocopy /MOVE because PowerShell's Move-Item fails on Windows
  # long paths and held-open files (TS server, ESLint, etc.).
  $nodeModulesStash = Join-Path $env:TEMP ("nm_acrhidden_" + [Guid]::NewGuid().ToString('N'))
  Write-Host "    Moving .\node_modules -> $nodeModulesStash via robocopy for the duration of the ACR upload..." -ForegroundColor DarkGray
  $rcLog = Join-Path $env:TEMP "nm_acrhidden_robocopy.log"
  & robocopy 'node_modules' $nodeModulesStash /MOVE /E /NFL /NDL /NJH /NJS /NP /R:1 /W:1 /MT:16 > $rcLog 2>&1
  # robocopy exit codes 0-7 are success (8+ are failures)
  if ($LASTEXITCODE -ge 8) {
    Get-Content $rcLog -Tail 30
    throw "robocopy /MOVE of node_modules failed with exit $LASTEXITCODE. See $rcLog."
  }
  # robocopy /MOVE empties source dir but leaves it behind; remove the empty shell
  if (Test-Path 'node_modules') {
    Remove-Item -Recurse -Force 'node_modules' -ErrorAction SilentlyContinue
  }
  $nodeModulesHidden = $true
}
try {
  & az acr build --registry $acrName --image "${ImageRepo}:${ImageTag}" --file Dockerfile --no-logs .
  $buildExit = $LASTEXITCODE
} finally {
  if ($nodeModulesHidden -and $nodeModulesStash -and (Test-Path $nodeModulesStash)) {
    Write-Host "    Restoring .\node_modules from stash via robocopy" -ForegroundColor DarkGray
    & robocopy $nodeModulesStash 'node_modules' /MOVE /E /NFL /NDL /NJH /NJS /NP /R:1 /W:1 /MT:16 > $null 2>&1
    if (Test-Path $nodeModulesStash) {
      Remove-Item -Recurse -Force $nodeModulesStash -ErrorAction SilentlyContinue
    }
  }
}
if ($buildExit -ne 0) {
  Write-Warning "az acr build failed (exit $buildExit). Recent task runs:"
  az acr task list-runs --registry $acrName -o table --top 3
  Write-Warning "Inspect logs in the portal or with: az acr task logs --registry $acrName --run-id <id>  (run from a UTF-8 terminal; the Azure CLI's log streamer crashes on cp1252)."
  throw "ACR build failed (exit $buildExit)."
}

# 4) Final deploy: now provision the Container App pointing at the new image.
Write-Host "[5/5] Deploying Container App at image tag '$ImageTag'..." -ForegroundColor Cyan
$finalJson = az deployment group create `
  --resource-group $ResourceGroup `
  --name "workshopbuddy-$ImageTag" `
  --template-file (Join-Path $PSScriptRoot 'main.bicep') `
  --parameters (Join-Path $PSScriptRoot 'main.bicepparam') `
  --parameters baseName=$BaseName imageRepo=$ImageRepo imageTag=$ImageTag deployApp=true pgDevWorkstationIp=$DevWorkstationIp `
  --query 'properties.outputs' `
  -o json
if ($LASTEXITCODE -ne 0) { throw "Final deployment failed (exit $LASTEXITCODE)." }
$infraOut = $finalJson | ConvertFrom-Json

# 5) Ensure both Postgres Entra admins (the developer UPN and the UAMI) exist.
#    Idempotent: az checks first, only creates if missing.
$pgServerName  = $infraOut.pgServerName.value
$pgServerFqdn  = $infraOut.pgServerFqdn.value
$pgDbName      = $infraOut.pgDatabaseName.value
$pgAdminLogin  = $infraOut.pgEntraAdminLogin.value
$uamiName      = $infraOut.uamiName.value
$uamiPrincipal = $infraOut.uamiPrincipalId.value

function Ensure-PgEntraAdmin {
  param(
    [Parameter(Mandatory=$true)][string]$ServerName,
    [Parameter(Mandatory=$true)][string]$ObjectId,
    [Parameter(Mandatory=$true)][string]$DisplayName,
    [Parameter(Mandatory=$true)][ValidateSet('User','ServicePrincipal','Group')][string]$Type
  )
  $existing = az postgres flexible-server microsoft-entra-admin list -g $ResourceGroup -s $ServerName --query "[?objectId=='$ObjectId'] | length(@)" -o tsv 2>$null
  if ($existing -eq '1') {
    Write-Host "    $DisplayName already a Postgres Entra admin." -ForegroundColor DarkGray
    return
  }
  az postgres flexible-server microsoft-entra-admin create `
    --resource-group $ResourceGroup `
    --server-name $ServerName `
    --display-name $DisplayName `
    --object-id $ObjectId `
    --type $Type | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "    Failed to add $DisplayName as Postgres Entra admin (exit $LASTEXITCODE)."
  } else {
    Write-Host "    Added $DisplayName as Postgres Entra admin." -ForegroundColor DarkGray
  }
}

if ($pgServerName) {
  Write-Host "[5b/5] Ensuring Postgres Entra admins on '$pgServerName'..." -ForegroundColor Cyan
  # Look up the human admin objectId from the bicepparam (we don't surface it as
  # an output; read it from the parameter file via az deployment show).
  $adminObjId = az deployment group show -g $ResourceGroup -n "workshopbuddy-$ImageTag" --query 'properties.parameters.pgEntraAdminObjectId.value' -o tsv
  if ($adminObjId) { Ensure-PgEntraAdmin -ServerName $pgServerName -ObjectId $adminObjId -DisplayName $pgAdminLogin -Type User }
  if ($uamiPrincipal) { Ensure-PgEntraAdmin -ServerName $pgServerName -ObjectId $uamiPrincipal -DisplayName $uamiName -Type ServicePrincipal }
}

$url = $infraOut.containerAppUrl.value
Write-Host ""
Write-Host "Deployment complete." -ForegroundColor Green
Write-Host "  Container App: $($infraOut.appName.value)"
Write-Host "  URL:           $url"
Write-Host "  ACR:           $($infraOut.acrLoginServer.value)"
Write-Host "  Postgres:      $pgServerFqdn"
Write-Host "  Database:      $pgDbName"
Write-Host "  UAMI:          $uamiName (Entra admin on Postgres)"
Write-Host ""
Write-Host "If Foundry model calls return 401/403, wait a few minutes for RBAC propagation, or verify the 'Cognitive Services User' role on the Foundry account for principal $($infraOut.uamiPrincipalId.value)." -ForegroundColor Yellow
