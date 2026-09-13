param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$port = if ($env:CANVAS_PORT) { [int]$env:CANVAS_PORT } else { 4188 }
$url = "http://127.0.0.1:$port"
$runtimeDir = Join-Path $projectRoot '.genius'
$hashBytes = [Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($projectRoot.ToLowerInvariant()))
$workspaceId = ([BitConverter]::ToString($hashBytes)).Replace('-', '').ToLowerInvariant().Substring(0, 16)
New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
$ready = $false
try {
    $state = Invoke-RestMethod -Uri "$url/api/publisher/state" -TimeoutSec 4
    if ($state.workspaceId -ne $workspaceId) { throw 'Pod tym adresem dziala inny projekt GENIUS@WORK.' }
    $ready = $state.version -eq 1
} catch {
    $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($listener) { throw "Port $port jest zajety. Zamknij poprzednia wersje studia lub ustaw CANVAS_PORT." }
}
if (-not $ready) {
    $nodePath = (Get-Command node -ErrorAction Stop).Source
    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules/tsx'))) { throw 'Brakuje zaleznosci. Uruchom npm.cmd install w katalogu projektu.' }
    $env:CANVAS_PORT = [string]$port
    $serverPath = Join-Path $projectRoot 'packages/canvas/src/server.ts'
    $child = Start-Process -FilePath $nodePath -ArgumentList @('--import', 'tsx', ('"' + $serverPath + '"')) -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeDir 'server.log') -RedirectStandardError (Join-Path $runtimeDir 'server-error.log') -PassThru
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        Start-Sleep -Milliseconds 500
        if ($child.HasExited) { throw 'Serwer zakonczyl prace. Sprawdz .genius/server-error.log.' }
        try { $state = Invoke-RestMethod -Uri "$url/api/publisher/state" -TimeoutSec 2; if ($state.version -eq 1 -and $state.workspaceId -eq $workspaceId) { $ready = $true; break } } catch { }
    }
    if (-not $ready) { throw 'Studio nie odpowiedzialo w ciagu 30 sekund. Sprawdz .genius/server-error.log.' }
}
if (-not $NoBrowser) { Start-Process -FilePath $url -WindowStyle Hidden }
Write-Output "GENIUS@WORK dziala: $url"
