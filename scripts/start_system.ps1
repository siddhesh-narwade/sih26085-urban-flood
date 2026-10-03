$ErrorActionPreference = "Stop"

$username = Read-Host "MOSDAC username (press Enter to use cached data only)"
if ($username) {
    $securePassword = Read-Host "MOSDAC password" -AsSecureString
    $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    try {
        $env:MOSDAC_USERNAME = $username
        $env:MOSDAC_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    }
} else {
    Remove-Item Env:MOSDAC_USERNAME -ErrorAction SilentlyContinue
    Remove-Item Env:MOSDAC_PASSWORD -ErrorAction SilentlyContinue
}

$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"

# Replace previous prototype processes so new environment variables take effect.
foreach ($port in @(8000, 5173)) {
    $listeners = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
    foreach ($listener in $listeners) {
        Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}

Start-Process cmd.exe -ArgumentList "/k", "cd /d `"$backend`" && python run.py" -WorkingDirectory $backend
Start-Process cmd.exe -ArgumentList "/k", "cd /d `"$frontend`" && npm run dev" -WorkingDirectory $frontend

Write-Host "Backend: http://127.0.0.1:8000"
Write-Host "Frontend: http://localhost:5173"
Write-Host "Credentials are passed only to this backend process and are not saved."