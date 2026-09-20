# Sets up the nightly backup to a cloud-synced folder, and proves it works by
# taking one backup straight away.
#
#   .\scripts\install-backup-task.ps1                       # finds OneDrive / Google Drive / Dropbox
#   .\scripts\install-backup-task.ps1 -Copy "D:\MyDrive\berchi-backups"
#
# The sync app (OneDrive, Google Drive, Dropbox) does the uploading. This script
# only drops each night's backup into its folder, so that app must be installed,
# signed in, and running on this PC. Check occasionally that the files really
# appear online: backup-status.ps1 checks the PC side, not the cloud side.
#
# The backups contain customer names and phone numbers. Use the OWNER's cloud
# account, not one shared with staff.

param(
    [string]$Copy = "",
    [string]$At = "22:30",
    [string]$TaskName = "Berchi backup"
)

$ErrorActionPreference = "Stop"

if (-not $Copy) {
    $candidates = @(
        $env:OneDrive, $env:OneDriveCommercial, $env:OneDriveConsumer,
        (Join-Path $HOME "Google Drive"), (Join-Path $HOME "My Drive"),
        "G:\My Drive", (Join-Path $HOME "Dropbox")
    ) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique

    if (@($candidates).Count -eq 1) {
        $Copy = Join-Path @($candidates)[0] "berchi-backups"
        Write-Host "Found a cloud-synced folder: $(@($candidates)[0])"
    } elseif (@($candidates).Count -gt 1) {
        Write-Host "Several cloud-synced folders found. Choose one and run again with -Copy:" -ForegroundColor Yellow
        $candidates | ForEach-Object { Write-Host "  .\scripts\install-backup-task.ps1 -Copy `"$(Join-Path $_ 'berchi-backups')`"" }
        exit 1
    } else {
        Write-Host "No OneDrive, Google Drive or Dropbox folder found on this PC." -ForegroundColor Red
        Write-Host "Install and sign in to one, or pass the folder yourself with -Copy."
        exit 1
    }
}

$script = (Resolve-Path (Join-Path $PSScriptRoot "backup.ps1")).Path
$argLine = "-NoProfile -ExecutionPolicy Bypass -File `"$script`" -Copy `"$Copy`""

# StartWhenAvailable: if the PC was off at the scheduled time, run as soon as it
# is next on, instead of skipping that night.
$action   = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $argLine
$trigger  = New-ScheduledTaskTrigger -Daily -At $At
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
    -Description "Nightly Berchi salon database backup to $Copy" -Force | Out-Null
Write-Host "Scheduled '$TaskName' daily at $At -> $Copy"

Write-Host "Taking a first backup now to prove it works..."
& $script -Copy $Copy
if ($LASTEXITCODE -ne 0) {
    Write-Host "The schedule is set, but the first backup failed - fix the error above." -ForegroundColor Red
    exit 1
}
Write-Host "Done. Run .\scripts\backup-status.ps1 any time to check on it." -ForegroundColor Green
