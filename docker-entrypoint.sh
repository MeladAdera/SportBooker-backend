#!/bin/sh
set -e
echo "Running migrations..."
pnpm run migrate
echo "Starting app..."
exec node dist/src/main.js
