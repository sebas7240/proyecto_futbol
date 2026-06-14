$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$dataDirectory = Join-Path $projectRoot '.local-postgres\data'
$pgCtl = 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe'

if (-not (Test-Path -LiteralPath (Join-Path $dataDirectory 'PG_VERSION'))) {
  Write-Output 'El PostgreSQL local de Fame Market no ha sido inicializado.'
  exit 0
}

& $pgCtl status --pgdata=$dataDirectory *> $null
if ($LASTEXITCODE -eq 0) {
  & $pgCtl stop --pgdata=$dataDirectory --mode=fast --wait
}

Write-Output 'PostgreSQL local de Fame Market detenido.'
