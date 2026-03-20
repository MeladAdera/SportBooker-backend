#!/bin/sh
set -e
echo "Running migrations..."
npm run migrate
echo "Starting app..."
exec node dist/main.js
