#!/bin/bash

# Script de respaldo de la base de datos StockVision

export PGUSER=postgres

pg_dump -h localhost stockvision > ../database/stockvision_backup.sql

echo "Respaldo generado correctamente."
