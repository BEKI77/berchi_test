# Restores the salon database from a backup made by backup.ps1.
#
#   .\scripts\restore.ps1 -File .\backups\berchi-20260920-220000.dump -Yes
#
# This REPLACES everything currently in the database. Without -Yes it only
# explains what it would do. The app is stopped for the restore and started
# again afterwards.

param(
    [Parameter(Mandatory = $true)][string]$File,
    [switch]$Yes,
    [string]$Container = "berchi-cashier-db",
    [string]$AppContainer = "berchi-cashier-app"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $File)) { Write-Host "No such file: $File" -ForegroundColor Red; exit 1 }
$File = (Resolve-Path $File).Path

if (-not $Yes) {
    Write-Host "This would replace ALL data in the salon database with the contents of:"
    Write-Host "  $File"
    Write-Host "Run again with -Yes to do it."
    exit 0
}

docker cp $File "${Container}:/tmp/restore.dump"
if ($LASTEXITCODE -ne 0) { Write-Host "Could not copy the backup into the container." -ForegroundColor Red; exit 1 }

# Refuse to touch the live database if the file is not a readable dump.
docker exec $Container sh -c "pg_restore --list /tmp/restore.dump > /dev/null"
if ($LASTEXITCODE -ne 0) {
    docker exec $Container rm -f /tmp/restore.dump | Out-Null
    Write-Host "That file is not a readable backup. Nothing was changed." -ForegroundColor Red
    exit 1
}

docker stop $AppContainer | Out-Null
try {
    docker exec $Container sh -c "pg_restore -U berchi -d berchi_salon --clean --if-exists --no-owner /tmp/restore.dump"
    if ($LASTEXITCODE -ne 0) { throw "pg_restore reported errors (exit $LASTEXITCODE)" }
    Write-Host "Restore complete." -ForegroundColor Green
} finally {
    docker exec $Container rm -f /tmp/restore.dump | Out-Null
    docker start $AppContainer | Out-Null
}
