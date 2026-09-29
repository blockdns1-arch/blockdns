param(
  [Parameter(Mandatory = $true)][string]$Script,
  [ValidateSet("base-sepolia", "base")][string]$Network = "base-sepolia"
)

# Load secrets from gitignored base-deploy.env (DEPLOYER private key + treasury)
$envMap = @{}
Get-Content "$PSScriptRoot\base-deploy.env" | ForEach-Object {
  if ($_ -match '^\s*([^#=]+?)\s*=\s*(.*)$') { $envMap[$matches[1].Trim()] = $matches[2].Trim() }
}

if (-not $envMap['BASE_DEPLOYER_PRIVATE_KEY']) {
  Write-Error "base-deploy.env missing BASE_DEPLOYER_PRIVATE_KEY"; exit 1
}

$env:DEPLOYER_PRIVATE_KEY = $envMap['BASE_DEPLOYER_PRIVATE_KEY']
if ($envMap['TREASURY_ADDRESS']) { $env:TREASURY_ADDRESS = $envMap['TREASURY_ADDRESS'] }

if ($Network -eq "base-sepolia") {
  $env:L2_CHAIN_ID = "84532"
} else {
  $env:L2_CHAIN_ID = "8453"
}

Write-Host "== deploy via $Network (script=$Script, deployer=$($envMap['TREASURY_ADDRESS'])) =="
npx hardhat run $Script --network $Network
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }