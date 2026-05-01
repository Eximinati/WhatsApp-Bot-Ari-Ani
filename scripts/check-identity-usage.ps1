# scripts/check-identity-usage.ps1
$ErrorActionPreference = "Stop"

Write-Host "--- Checking identity usage patterns ---"

# 1. Forbid message.sender in services (logic layer)
Write-Host "Checking for raw message.sender in service files (logic layer)..."
$badUsage = Select-String -Path "src\services\*.js" -Pattern "message\.sender[^I]" -SimpleMatch -CaseSensitive:$false
if ($badUsage) {
  Write-Host "ERROR: Raw message.sender found in service files (logic layer):"
  $badUsage | ForEach-Object { Write-Host "  $($_.Filename):$($_.LineNumber): $($_.Line.Trim())" }
  exit 1
}

# 2. Check that senderId is used in service files
Write-Host "Checking for senderId usage in service files..."
$serviceFiles = Get-ChildItem "src\services\*.js"
$foundSenderId = $false
foreach ($f in $serviceFiles) {
  $content = Get-Content $f.FullName -Raw
  if ($content -match "senderId") { $foundSenderId = $true }
}

if (-not $foundSenderId) {
  Write-Host "WARNING: senderId not found in any service file"
}

# 3. Check no stale extractUserId imports from jid.js
Write-Host "Checking for stale extractUserId imports from jid.js..."
$staleImport = Select-String -Path "src\services\*.js" -Pattern "extractUserId.*from.*jid" -SimpleMatch
if ($staleImport) {
  Write-Host "ERROR: Stale extractUserId import from jid.js found:"
  $staleImport | ForEach-Object { Write-Host "  $($_.Filename):$($_.LineNumber): $($_.Line.Trim())" }
  exit 1
}

# 4. Check identity-resolver.js exports are consistent
Write-Host "Checking identity-resolver.js exports..."
$resolverContent = Get-Content "src\utils\identity-resolver.js" -Raw
if (-not ($resolverContent -match "extractUserId.*extract")) {
  Write-Host "ERROR: identity-resolver.js does not export extractUserId as alias"
  exit 1
}

Write-Host "--- Identity usage check PASSED ---"
