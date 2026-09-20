# Says whether backups are actually happening.
#
#   .\scripts\backup-status.ps1
#
# Exits non-zero if the newest backup is older than -MaxHours (default 36, so a
# single missed night is caught the next morning), or if the schedule is missing
# or last failed. Looks at the files, not just the schedule, because a schedule
# can run "successfully" and still produce nothing useful.

param(
    [int]$MaxHours = 36,
    [string]$TaskName = "Berchi backup",
    [string]$Dir = (Join-Path $PSScriptRoot "..\backups")
)

$problems = 0

function Newest($folder) {
    if (-not (Test-Path $folder)) { return $null }
    Get-ChildItem $folder -Filter "berchi-*.dump" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
}

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $task) {
    Write-Host "NO SCHEDULE: '$TaskName' is not set up. Run install-backup-task.ps1." -ForegroundColor Red
    $problems++
} else {
    $info = Get-ScheduledTaskInfo -TaskName $TaskName
    $copy = ($task.Actions[0].Arguments -replace '.*-Copy "([^"]*)".*', '$1')
    # Windows reports a task that has never run as year 1999, result 267011.
    if ($info.LastRunTime.Year -le 2000) {
        Write-Host "Schedule: set up, has not run yet (first run is at the next scheduled time)"
    } else {
        Write-Host ("Schedule: last ran {0}, result code {1} (0 = success)" -f $info.LastRunTime, $info.LastTaskResult)
        if ($info.LastTaskResult -ne 0) { $problems++ }
    }
}

foreach ($place in @(@{ Name = "This PC"; Path = $Dir }, @{ Name = "Cloud folder"; Path = $copy }) | Where-Object { $_.Path }) {
    $file = Newest $place.Path
    if (-not $file) {
        Write-Host ("{0,-13} NO BACKUPS FOUND in {1}" -f $place.Name, $place.Path) -ForegroundColor Red
        $problems++
        continue
    }
    $age = [math]::Round(((Get-Date) - $file.LastWriteTime).TotalHours, 1)
    $ok = $age -le $MaxHours
    if (-not $ok) { $problems++ }
    Write-Host ("{0,-13} newest: {1} ({2} hours old)" -f $place.Name, $file.Name, $age) -ForegroundColor $(if ($ok) { "Green" } else { "Red" })
}

if ($problems -eq 0) { Write-Host "Backups look healthy." -ForegroundColor Green } else { Write-Host "$problems problem(s) found." -ForegroundColor Red }
exit $(if ($problems -eq 0) { 0 } else { 1 })
