#!/bin/sh
set -eu

: "${PGHOST:?PGHOST is required}"
: "${PGDATABASE:?PGDATABASE is required}"
: "${PGUSER:?PGUSER is required}"

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
ALLOW_UNENCRYPTED="${ALLOW_UNENCRYPTED_BACKUP:-false}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BASE_NAME="fame-market-${TIMESTAMP}"
RAW_FILE="${BACKUP_DIR}/${BASE_NAME}.dump"
FINAL_FILE="${RAW_FILE}"
VERIFY_FILE="${BACKUP_DIR}/.${BASE_NAME}.verify.dump"
VERIFY_DB="fame_market_verify_$(date -u +%s)_$$"
RUN_ID=""
FINISHED="false"
VERIFIED="false"
OFFSITE_UPLOADED="false"

mkdir -p "${BACKUP_DIR}"

record_failure() {
  if [ -n "${RUN_ID}" ] && [ "${FINISHED}" != "true" ]; then
    psql --dbname="${PGDATABASE}" --quiet --command="
      UPDATE maintenance_runs
      SET status = 'failed',
        completed_at = NOW(),
        duration_ms = GREATEST(
          0,
          FLOOR(EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000)::integer
        ),
        error_message = 'El proceso de backup o restauracion de prueba fallo.'
      WHERE id = ${RUN_ID};
    " >/dev/null 2>&1 || true
  fi
}

cleanup() {
  dropdb --if-exists "${VERIFY_DB}" >/dev/null 2>&1 || true
  rm -f "${VERIFY_FILE}"
  if [ "${FINISHED}" = "true" ] || [ "${VERIFIED}" = "true" ]; then
    if [ "${FINAL_FILE}" != "${RAW_FILE}" ]; then
      rm -f "${RAW_FILE}"
    fi
  else
    rm -f "${RAW_FILE}" "${FINAL_FILE}" "${FINAL_FILE}.sha256"
  fi
  record_failure
}
trap cleanup EXIT INT TERM

RUN_ID="$(psql --dbname="${PGDATABASE}" --quiet --tuples-only --no-align --command="
  INSERT INTO maintenance_runs (
    job_name, status, details
  ) VALUES (
    'database-backup',
    'running',
    jsonb_build_object('source', 'docker', 'file', '${BASE_NAME}')
  )
  RETURNING id;
" | tr -d '[:space:]')"

pg_dump \
  --dbname="${PGDATABASE}" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="${RAW_FILE}"

if [ -n "${BACKUP_ENCRYPTION_PASSWORD:-}" ]; then
  FINAL_FILE="${RAW_FILE}.enc"
  openssl enc \
    -aes-256-cbc \
    -salt \
    -pbkdf2 \
    -iter 200000 \
    -pass env:BACKUP_ENCRYPTION_PASSWORD \
    -in "${RAW_FILE}" \
    -out "${FINAL_FILE}"
  rm -f "${RAW_FILE}"
elif [ "${ALLOW_UNENCRYPTED}" != "true" ]; then
  echo "BACKUP_ENCRYPTION_PASSWORD is required." >&2
  exit 1
fi

(
  cd "$(dirname "${FINAL_FILE}")"
  sha256sum "$(basename "${FINAL_FILE}")" > "$(basename "${FINAL_FILE}").sha256"
  sha256sum -c "$(basename "${FINAL_FILE}").sha256"
)

if [ "${FINAL_FILE}" != "${RAW_FILE}" ]; then
  openssl enc \
    -d \
    -aes-256-cbc \
    -pbkdf2 \
    -iter 200000 \
    -pass env:BACKUP_ENCRYPTION_PASSWORD \
    -in "${FINAL_FILE}" \
    -out "${VERIFY_FILE}"
else
  cp "${FINAL_FILE}" "${VERIFY_FILE}"
fi

pg_restore --list "${VERIFY_FILE}" >/dev/null
createdb "${VERIFY_DB}"
pg_restore \
  --dbname="${VERIFY_DB}" \
  --no-owner \
  --no-acl \
  "${VERIFY_FILE}"

MIGRATIONS="$(
  psql --dbname="${VERIFY_DB}" --tuples-only --no-align \
    --command="SELECT COUNT(*) FROM schema_migrations;"
)"
if [ "${MIGRATIONS}" -lt 1 ]; then
  echo "Restore verification did not find migrations." >&2
  exit 1
fi
VERIFIED="true"

if [ -n "${BACKUP_S3_URI:-}" ]; then
  : "${AWS_ENDPOINT_URL_S3:?AWS_ENDPOINT_URL_S3 is required for offsite backups}"
  REMOTE_PREFIX="${BACKUP_S3_URI%/}"
  aws s3 cp \
    "${FINAL_FILE}" \
    "${REMOTE_PREFIX}/$(basename "${FINAL_FILE}")" \
    --endpoint-url "${AWS_ENDPOINT_URL_S3}"
  aws s3 cp \
    "${FINAL_FILE}.sha256" \
    "${REMOTE_PREFIX}/$(basename "${FINAL_FILE}.sha256")" \
    --endpoint-url "${AWS_ENDPOINT_URL_S3}"
  OFFSITE_UPLOADED="true"
fi

SIZE_BYTES="$(wc -c < "${FINAL_FILE}" | tr -d ' ')"
psql --dbname="${PGDATABASE}" --quiet --command="
  UPDATE maintenance_runs
  SET status = 'success',
    completed_at = NOW(),
    duration_ms = GREATEST(
      0,
      FLOOR(EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000)::integer
    ),
    details = details || jsonb_build_object(
      'file', '$(basename "${FINAL_FILE}")',
      'encrypted', $([ "${FINAL_FILE}" = "${RAW_FILE}" ] && echo false || echo true),
      'sizeBytes', ${SIZE_BYTES},
      'restoreVerified', true,
      'offsiteUploaded', ${OFFSITE_UPLOADED},
      'migrations', ${MIGRATIONS}
    )
  WHERE id = ${RUN_ID};
" >/dev/null
FINISHED="true"

find "${BACKUP_DIR}" -type f -name 'fame-market-*' -mtime "+${RETENTION_DAYS}" -delete
echo "Backup ready: ${FINAL_FILE}"
