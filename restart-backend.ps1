# PowerShell script to restart backend server
Write-Host "🔄 Restarting Backend Server..." -ForegroundColor Cyan

# Navigate to backend directory
Set-Location -Path "backend"

# Kill any existing node processes (optional, uncomment if needed)
# Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Start the server
Write-Host "🚀 Starting server..." -ForegroundColor Green
npm run dev

