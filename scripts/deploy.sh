#!/bin/bash
set -e
cd "$(dirname "$0")/.."
docker compose down
docker compose up -d --build
echo "Deployment complete. App should be available at http://192.168.200.60:3000"
