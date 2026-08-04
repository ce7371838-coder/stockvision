#!/bin/bash

set -e

PROJECT_DIR="/home/jlorenzo/proyectos/stockvision"
BACKUP_DIR="$PROJECT_DIR/backups"
DATABASE="stockvision"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="$BACKUP_DIR/stockvision-$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "Generando respaldo de PostgreSQL..."

sudo -u postgres pg_dump "$DATABASE" | gzip > "$BACKUP_FILE"

if [ -s "$BACKUP_FILE" ]; then
    echo "Respaldo generado correctamente:"
    echo "$BACKUP_FILE"
else
    echo "Error: el respaldo está vacío."
    exit 1
fi
