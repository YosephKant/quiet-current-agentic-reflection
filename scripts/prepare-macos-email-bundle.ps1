#Requires -Version 5.1
<#
  Builds a Mac-friendly zip (no node_modules) for emailing. Friend runs npm ci on first launch via Start-Quiet-Current.command.
  Run on Windows from repo root: npm run installer:prepare:mac-email
#>
$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $Root

Write-Host "== Quiet Current: macOS email bundle (no node_modules; first run installs on Mac) ==" -ForegroundColor Cyan

if (-not (Test-Path (Join-Path $Root "dist\index.html"))) {
  Write-Host "dist\ not found - running npm run build ..." -ForegroundColor Yellow
  npm run build
}

$temp = Join-Path $env:TEMP ("QuietCurrent-macos-" + [guid]::NewGuid().ToString("n").Substring(0, 10))
$inner = Join-Path $temp "QuietCurrent-macos"
New-Item -ItemType Directory -Path $inner -Force | Out-Null

Copy-Item -Path (Join-Path $Root "server") -Destination (Join-Path $inner "server") -Recurse -Force
Copy-Item -Path (Join-Path $Root "dist") -Destination (Join-Path $inner "dist") -Recurse -Force
Copy-Item (Join-Path $Root "package.json") -Destination $inner -Force
Copy-Item (Join-Path $Root "package-lock.json") -Destination $inner -Force

$dataDir = Join-Path $inner "data"
New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
$null = New-Item -ItemType File -Path (Join-Path $dataDir ".gitkeep") -Force

Copy-Item (Join-Path $Root "installer\macos\Start-Quiet-Current.command") $inner -Force
Copy-Item (Join-Path $Root "installer\macos\READ-ME-FIRST-mac.txt") (Join-Path $inner "READ-ME-FIRST.txt") -Force

$utf8NoBom = New-Object System.Text.UTF8Encoding $false

$zipPath = Join-Path $env:USERPROFILE "Downloads\QuietCurrent-macOS-for-friend.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

Compress-Archive -Path $inner -DestinationPath $zipPath -CompressionLevel Optimal
Remove-Item $temp -Recurse -Force

$item = Get-Item $zipPath
Write-Host ""
Write-Host "Created: $($item.FullName)" -ForegroundColor Green
Write-Host "Size MB: $([math]::Round($item.Length / 1MB, 2))" -ForegroundColor Gray
