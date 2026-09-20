# Backs up the salon database. Run it nightly (docs/CASHIER_PC.md shows how).
#
#   .\scripts\backup.ps1 -Copy E:\berchi-backups
#
# -Copy is a SECOND location: a USB drive, a network share, or a folder that a
# cloud-sync app uploads. A backup on the same disk as the database dies with it,
# so treat -Copy as required. If it cannot be reached the script says so loudly
# and exits non-zero, rather than pretending the backup is safe.

param(
    [string]$Copy = "",
    [int]$KeepDays = 30,
    [string]$Container = "berchi-cashier-db",
    [string]$Dir = (Join-Path $PSScriptRoot "..\backups")
)

$ErrorActionPreference = "Stop"

function Fail($msg) {
    Write-Host "BACKUP FAILED: $msg" -ForegroundColor Red
    exit 1
}

New-Item -ItemType Directory -Force -Path $Dir | Out-Null
$Dir = (Resolve-Path $Dir).Path
$name = "berchi-{0}.dump" -f (Get-Date -Format "yyyyMMdd-HHmmss")
$target = Join-Path $Dir $name

# Dump inside the container and copy the file out. Redirecting docker's output
# through PowerShell 5.1 re-encodes it and corrupts a binary dump.
docker exec $Container sh -c "pg_dump -U berchi -Fc berchi_salon > /tmp/backup.dump"
if ($LASTEXITCODE -ne 0) { Fail "pg_dump failed - is the '$Container' container running?" }

docker cp "${Container}:/tmp/backup.dump" $target
if ($LASTEXITCODE -ne 0) { Fail "could not copy the dump out of the container" }
docker exec $Container rm -f /tmp/backup.dump | Out-Null

# A file that exists is not a backup that works. Make Postgres read it back.
docker cp $target "${Container}:/tmp/verify.dump"
docker exec $Container sh -c "pg_restore --list /tmp/verify.dump > /dev/null"
$readable = $LASTEXITCODE -eq 0
docker exec $Container rm -f /tmp/verify.dump | Out-Null
if (-not $readable) { Remove-Item $target -Force; Fail "the dump could not be read back and was discarded" }

$sizeKb = [math]::Round((Get-Item $target).Length / 1KB)
Write-Host "Backup written: $target ($sizeKb KB)"

if ($Copy) {
    try {
        New-Item -ItemType Directory -Force -Path $Copy | Out-Null
        Copy-Item $target (Join-Path $Copy $name) -Force
        Write-Host "Second copy written: $(Join-Path $Copy $name)"
    } catch {
        Fail "the local backup is fine but the second copy to '$Copy' failed: $($_.Exception.Message)"
    }
} else {
    Write-Host "WARNING: no -Copy location given; this backup lives on the same disk as the database." -ForegroundColor Yellow
}

# Prune old dumps, but never the newest one.
foreach ($folder in @($Dir, $Copy) | Where-Object { $_ }) {
    Get-ChildItem $folder -Filter "berchi-*.dump" |
        Sort-Object LastWriteTime -Descending |
        Select-Object -Skip 1 |
        Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } |
        Remove-Item -Force
}
