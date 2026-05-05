#Requires -Version 5.1
<#
  Builds installer\staging (production node_modules + server + dist) and compiles Inno Setup if ISCC is installed.
  Run from repo root:  powershell -ExecutionPolicy Bypass -File scripts\build-windows-installer.ps1
  Or:                 npm run installer:prepare
#>
$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $Root

Write-Host "== Quiet Current: Windows installer staging ==" -ForegroundColor Cyan

if (-not (Test-Path (Join-Path $Root "dist\index.html"))) {
  Write-Host "dist\ not found - running npm run build ..." -ForegroundColor Yellow
  npm run build
}

$Staging = Join-Path $Root "installer\staging"
if (Test-Path $Staging) {
  Remove-Item $Staging -Recurse -Force
}
New-Item -ItemType Directory -Path $Staging -Force | Out-Null

Write-Host "Copying application files..." -ForegroundColor Gray
Copy-Item -Path (Join-Path $Root "server") -Destination (Join-Path $Staging "server") -Recurse -Force
Copy-Item -Path (Join-Path $Root "dist") -Destination (Join-Path $Staging "dist") -Recurse -Force
Copy-Item (Join-Path $Root "package.json") -Destination $Staging -Force
Copy-Item (Join-Path $Root "package-lock.json") -Destination $Staging -Force

$LauncherSrc = Join-Path $Root "installer\assets\QuietCurrentLauncher.bat"
if (-not (Test-Path $LauncherSrc)) {
  throw "Missing $LauncherSrc"
}
Copy-Item $LauncherSrc (Join-Path $Staging "QuietCurrent.bat") -Force

$dataStaging = Join-Path $Staging "data"
New-Item -ItemType Directory -Path $dataStaging -Force | Out-Null
$gitkeep = Join-Path $dataStaging ".gitkeep"
if (-not (Test-Path $gitkeep)) {
  New-Item -ItemType File -Path $gitkeep -Force | Out-Null
}

Write-Host "npm ci --omit=dev (Windows native modules - run this script on Windows)..." -ForegroundColor Gray
Push-Location $Staging
try {
  npm ci --omit=dev
}
finally {
  Pop-Location
}

Write-Host "Staging ready at: $Staging" -ForegroundColor Green

$isccCandidates = @(
  "${env:LOCALAPPDATA}\Programs\Inno Setup 6\ISCC.exe",
  "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
  "${env:ProgramFiles}\Inno Setup 6\ISCC.exe"
)
$iscc = $isccCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $iscc) {
  Write-Host ""
  Write-Host "Inno Setup 6 not found. Install from https://jrsoftware.org/isdl.php" -ForegroundColor Yellow
  Write-Host "Then run manually:" -ForegroundColor Yellow
  Write-Host '  "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer\QuietCurrent.iss' -ForegroundColor Yellow
  exit 0
}

$iss = Join-Path $Root "installer\QuietCurrent.iss"
Write-Host "Compiling installer with: $iscc" -ForegroundColor Cyan
& $iscc $iss
Write-Host "Done. Output under dist-installer\" -ForegroundColor Green
