#!/bin/sh
set -eu

: "${RESTORE_FILE:?RESTORE_FILE is required}"
: "${TARGET_DATABASE:?TARGET_DATABASE is required}"
: "${CONFIRM_RESTORE:?Set CONFIRM_RESTORE=RESTORE_FAME_MARKET}"

if [ "${CONFIRM_RESTORE}" != "RESTORE_FAME_MARKET" ]; then
  echo "Restore confirmation does not match." >&2
  exit 1
fi

if [ ! -f "${RESTORE_FILE}" ]; then
  echo "Backup file not found: ${RESTORE_FILE}" >&2
  exit 1
fi

if [ -f "${RESTORE_FILE}.sha256" ]; then
  (
    cd "$(dirname "${RESTORE_FILE}")"
    sha256sum --check "$(basename "${RESTORE_FILE}").sha256"
  )
fi

SOURCE_FILE="${RESTORE_FILE}"
TEMP_FILE=""
if echo "${RESTORE_FILE}" | grep -q '\.enc$'; then
  : "${BACKUP_ENCRYPTION_PASSWORD:?Password required for encrypted backup}"
  TEMP_FILE="/tmp/fame-market-restore-$$.dump"
  openssl enc \
    -d \
    -aes-256-cbc \
    -pbkdf2 \
    -iter 200000 \
    -pass env:BACKUP_ENCRYPTION_PASSWORD \
    -in "${RESTORE_FILE}" \
    -out "${TEMP_FILE}"
  SOURCE_FILE="${TEMP_FILE}"
fi

cleanup() {
  [ -z "${TEMP_FILE}" ] || rm -f "${TEMP_FILE}"
}
trap cleanup EXIT INT TERM

pg_restore --list "${SOURCE_FILE}" >/dev/null
pg_restore \
  --dbname="${TARGET_DATABASE}" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  "${SOURCE_FILE}"

psql --dbname="${TARGET_DATABASE}" --command="
  SELECT COUNT(*) AS migrations FROM schema_migrations;
  SELECT COUNT(*) AS users FROM users;
  SELECT COUNT(*) AS trades FROM trades;
"
