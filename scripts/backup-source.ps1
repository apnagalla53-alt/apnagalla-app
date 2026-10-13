$date = Get-Date -Format "yyyy-MM-dd"
$zipPath = "D:\evolix-backups\evolix-retail-baseline-$date.zip"
$sourcePath = "D:\evolix-trade-erp"

# Create backup directory if it doesn't exist
$backupDir = Split-Path $zipPath
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
}

# Exclude unnecessary files
$exclude = @(
    "node_modules",
    "dist",
    "build",
    "coverage",
    ".git",
    "logs",
    "*.log",
    "*.tmp",
    "scratch",
    "archive"
)

# Zip the repository
Write-Host "Creating backup at $zipPath..."
Compress-Archive -Path "$sourcePath\*" -DestinationPath $zipPath -Update -ErrorAction SilentlyContinue

Write-Host "Backup completed successfully!"
