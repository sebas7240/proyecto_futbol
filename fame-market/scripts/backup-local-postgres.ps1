$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$postgresBin = 'C:\Program Files\PostgreSQL\18\bin'
$pgDump = Join-Path $postgresBin 'pg_dump.exe'
$pgRestore = Join-Path $postgresBin 'pg_restore.exe'
$psql = Join-Path $postgresBin 'psql.exe'
$createdb = Join-Path $postgresBin 'createdb.exe'
$dropdb = Join-Path $postgresBin 'dropdb.exe'
$backupDirectory = Join-Path $projectRoot 'backups'
$timestamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$backupFile = Join-Path $backupDirectory "fame-market-$timestamp.dump"
$checksumFile = "$backupFile.sha256"
$verifyDatabase = "fame_market_verify_$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
$runId = $null
$completed = $false

foreach ($executable in @($pgDump, $pgRestore, $psql, $createdb, $dropdb)) {
  if (-not (Test-Path -LiteralPath $executable)) {
    throw "No se encontro PostgreSQL 18 en $postgresBin"
  }
}

New-Item -ItemType Directory -Force -Path $backupDirectory | Out-Null

function Invoke-Psql([string]$Database, [string]$Command) {
  $output = & $psql `
    --host=127.0.0.1 `
    --port=5434 `
    --username=fame_market `
    --dbname=$Database `
    --quiet `
    --tuples-only `
    --no-align `
    --command=$Command
  if ($LASTEXITCODE -ne 0) {
    throw "psql fallo sobre $Database"
  }
  return ($output | Out-String).Trim()
}

try {
  $runId = [int](Invoke-Psql 'fame_market' @"
INSERT INTO maintenance_runs (job_name, status, details)
VALUES (
  'database-backup',
  'running',
  jsonb_build_object('source', 'powershell', 'file', '$(Split-Path $backupFile -Leaf)')
)
RETURNING id;
"@)

  & $pgDump `
    --host=127.0.0.1 `
    --port=5434 `
    --username=fame_market `
    --dbname=fame_market `
    --format=custom `
    --no-owner `
    --no-acl `
    --file=$backupFile
  if ($LASTEXITCODE -ne 0) {
    throw 'pg_dump no pudo crear la copia.'
  }

  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $backupFile).Hash.ToLowerInvariant()
  Set-Content -LiteralPath $checksumFile -Value "$hash  $(Split-Path $backupFile -Leaf)"

  & $pgRestore --list $backupFile *> $null
  if ($LASTEXITCODE -ne 0) {
    throw 'pg_restore no pudo leer la copia.'
  }

  & $createdb `
    --host=127.0.0.1 `
    --port=5434 `
    --username=fame_market `
    $verifyDatabase
  if ($LASTEXITCODE -ne 0) {
    throw 'No se pudo crear la base temporal de verificacion.'
  }

  & $pgRestore `
    --host=127.0.0.1 `
    --port=5434 `
    --username=fame_market `
    --dbname=$verifyDatabase `
    --no-owner `
    --no-acl `
    $backupFile
  if ($LASTEXITCODE -ne 0) {
    throw 'La restauracion de prueba fallo.'
  }

  $migrationCount = [int](Invoke-Psql $verifyDatabase 'SELECT COUNT(*) FROM schema_migrations;')
  if ($migrationCount -lt 1) {
    throw 'La base restaurada no contiene migraciones.'
  }

  $sizeBytes = (Get-Item -LiteralPath $backupFile).Length
  Invoke-Psql 'fame_market' @"
UPDATE maintenance_runs
SET status = 'success',
  completed_at = NOW(),
  duration_ms = GREATEST(
    0,
    FLOOR(EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000)::integer
  ),
  details = details || jsonb_build_object(
    'sizeBytes', $sizeBytes,
    'encrypted', false,
    'restoreVerified', true,
    'migrations', $migrationCount
  )
WHERE id = $runId;
"@ | Out-Null
  $completed = $true
  Write-Output "Backup verificado: $backupFile"
} catch {
  if ($runId) {
    $escaped = $_.Exception.Message.Replace("'", "''")
    Invoke-Psql 'fame_market' @"
UPDATE maintenance_runs
SET status = 'failed',
  completed_at = NOW(),
  error_message = '$escaped'
WHERE id = $runId;
"@ | Out-Null
  }
  throw
} finally {
  & $dropdb `
    --host=127.0.0.1 `
    --port=5434 `
    --username=fame_market `
    --if-exists `
    $verifyDatabase *> $null

  if (-not $completed -and (Test-Path -LiteralPath $backupFile)) {
    Remove-Item -LiteralPath $backupFile -Force
  }
  if (-not $completed -and (Test-Path -LiteralPath $checksumFile)) {
    Remove-Item -LiteralPath $checksumFile -Force
  }
}
