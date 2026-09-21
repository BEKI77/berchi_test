Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win { [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr h); }
"@
$p = Get-Process berchi-cashier -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $p) { "none"; exit }
"maximized=$([Win]::IsZoomed($p.MainWindowHandle)) title=$($p.MainWindowTitle)"
