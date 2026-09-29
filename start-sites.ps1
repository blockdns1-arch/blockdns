param(
  [switch]$Rebuild
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$front = Join-Path $root "frontend"
$next = Join-Path $front "node_modules\next\dist\bin\next"

if (-not (Test-Path (Join-Path $front ".next"))) {
  Write-Host "No .next build found - building once first..." -ForegroundColor Yellow
  Push-Location $front
  & npx next build
  Pop-Location
}

if ($Rebuild) {
  Write-Host "Rebuilding production bundle..." -ForegroundColor Yellow
  Push-Location $front
  & npx next build
  Pop-Location
}

foreach ($p in 3000, 3001, 3002, 3003) {
  $existing = Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue
  if ($existing) {
    Write-Host "Port $p already in use - skipping."
    continue
  }
  Start-Process -FilePath "node" -ArgumentList $next, "start", "-p", "$p", "-H", "127.0.0.1" -WorkingDirectory $front -WindowStyle Hidden -RedirectStandardOutput "C:\Users\pc\Desktop\site$p.log" -RedirectStandardError "C:\Users\pc\Desktop\site$p.err.log"
  Write-Host "Started site on http://localhost:$p"
}

Write-Host ""
Write-Host "BlockDNS sites:"
Write-Host "  main    .bdns domains : http://localhost:3000"
Write-Host "  explorer  L2 explorer : http://localhost:3001/explorer"
Write-Host "  foundation       site : http://localhost:3002/foundation"
Write-Host "  swap&bridge       site : http://localhost:3003/swap"
Write-Host "Requires the Hardhat L2 node (chain 8461) running for live data."