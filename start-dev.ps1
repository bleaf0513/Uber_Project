# Starts backend (in-memory MongoDB) + frontend in new windows.
$root = $PSScriptRoot
if (-not (Test-Path "$root\backend\node_modules")) {
    npm install --prefix "$root\backend"
}
if (-not (Test-Path "$root\frontend\node_modules")) {
    npm install --prefix "$root\frontend"
}
if (-not (Test-Path "$root\frontend\.env")) {
    Copy-Item "$root\frontend\.env.example" "$root\frontend\.env"
    Write-Host "Created frontend\.env from .env.example"
}
Write-Host "Opening two terminals: backend (port 4000) and frontend (Vite)."
Write-Host "Use a narrow/mobile browser window. Add GOOGLE_MAPS_API for maps."
Start-Process powershell -WorkingDirectory "$root\backend" -ArgumentList @('-NoExit', '-Command', 'npm run dev:memory')
Start-Process powershell -WorkingDirectory "$root\frontend" -ArgumentList @('-NoExit', '-Command', 'npm run dev')
