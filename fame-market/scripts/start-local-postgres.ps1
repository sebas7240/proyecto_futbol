$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$clusterRoot = Join-Path $projectRoot '.local-postgres'
$dataDirectory = Join-Path $clusterRoot 'data'
$logFile = Join-Path $clusterRoot 'postgres.log'
$postgresBin = 'C:\Program Files\PostgreSQL\18\bin'
$initDb = Join-Path $postgresBin 'initdb.exe'
$pgCtl = Join-Path $postgresBin 'pg_ctl.exe'
$psql = Join-Path $postgresBin 'psql.exe'
$createdb = Join-Path $postgresBin 'createdb.exe'
$port = 5434
$databaseUser = 'fame_market'
$databaseName = 'fame_market'

foreach ($executable in @($initDb, $pgCtl, $psql, $createdb)) {
  if (-not (Test-Path -LiteralPath $executable)) {
    throw "No se encontro PostgreSQL 18 en $postgresBin"
  }
}

New-Item -ItemType Directory -Force -Path $clusterRoot | Out-Null

if (-not (Test-Path -LiteralPath (Join-Path $dataDirectory 'PG_VERSION'))) {
  & $initDb `
    --pgdata=$dataDirectory `
    --username=$databaseUser `
    --auth=trust `
    --encoding=UTF8 `
    --no-locale
  if ($LASTEXITCODE -ne 0) {
    throw 'No se pudo inicializar el PostgreSQL local.'
  }

  Add-Content -LiteralPath (Join-Path $dataDirectory 'postgresql.conf') -Value @"

# Fame Market local development
listen_addresses = '127.0.0.1'
port = $port
max_connections = 30
"@
}

& $pgCtl status --pgdata=$dataDirectory *> $null
if ($LASTEXITCODE -ne 0) {
  & $pgCtl start --pgdata=$dataDirectory --log=$logFile --wait
  if ($LASTEXITCODE -ne 0) {
    throw 'No se pudo iniciar el PostgreSQL local.'
  }
}

$databaseExists = & $psql `
  --host=127.0.0.1 `
  --port=$port `
  --username=$databaseUser `
  --dbname=postgres `
  --tuples-only `
  --no-align `
  --command="SELECT 1 FROM pg_database WHERE datname = '$databaseName'"

if ([string]::IsNullOrWhiteSpace($databaseExists) -or $databaseExists.Trim() -ne '1') {
  & $createdb `
    --host=127.0.0.1 `
    --port=$port `
    --username=$databaseUser `
    $databaseName
  if ($LASTEXITCODE -ne 0) {
    throw 'No se pudo crear la base fame_market.'
  }
}

Write-Output "PostgreSQL local listo en 127.0.0.1:$port/$databaseName"
