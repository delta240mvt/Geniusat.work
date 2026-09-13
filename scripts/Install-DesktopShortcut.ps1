$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$iconPath = Join-Path $projectRoot 'packages/canvas/public/genius.ico'
Add-Type -AssemblyName System.Drawing
$bitmap = [Drawing.Bitmap]::new(256, 256)
$graphics = [Drawing.Graphics]::FromImage($bitmap)
$graphics.Clear([Drawing.Color]::FromArgb(2, 3, 4))
$graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
$brush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(0, 214, 216))
$points = [Drawing.Point[]]@([Drawing.Point]::new(176,72),[Drawing.Point]::new(96,72),[Drawing.Point]::new(64,104),[Drawing.Point]::new(64,176),[Drawing.Point]::new(96,200),[Drawing.Point]::new(184,200),[Drawing.Point]::new(184,124),[Drawing.Point]::new(124,124),[Drawing.Point]::new(124,156),[Drawing.Point]::new(152,156),[Drawing.Point]::new(152,172),[Drawing.Point]::new(108,172),[Drawing.Point]::new(96,160),[Drawing.Point]::new(96,116),[Drawing.Point]::new(112,100),[Drawing.Point]::new(176,100))
$graphics.FillPolygon($brush, $points)
$iconObject = [Drawing.Icon]::FromHandle($bitmap.GetHicon())
$stream = [IO.File]::Create($iconPath)
$iconObject.Save($stream)
$stream.Dispose(); $iconObject.Dispose(); $graphics.Dispose(); $brush.Dispose(); $bitmap.Dispose()
$desktopPath = [Environment]::GetFolderPath('Desktop')
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut((Join-Path $desktopPath 'GENIUS@WORK.lnk'))
$shortcut.TargetPath = (Get-Command powershell.exe).Source
$shortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + (Join-Path $PSScriptRoot 'Start-Genius.ps1') + '"'
$shortcut.WorkingDirectory = $projectRoot
$shortcut.Description = 'GENIUS@WORK - studio tresci i publikacje'
$shortcut.WindowStyle = 7
$icon = Join-Path $projectRoot 'packages/canvas/public/genius.ico'
if (Test-Path -LiteralPath $icon) { $shortcut.IconLocation = $icon }
$shortcut.Save()
Write-Output (Join-Path $desktopPath 'GENIUS@WORK.lnk')
