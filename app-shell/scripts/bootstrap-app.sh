#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: ./scripts/bootstrap-app.sh <app-slug> \"<App Display Name>\" [target-parent-dir]"
  exit 1
fi

SLUG="$1"
APP_NAME="$2"
PARENT_DIR="${3:-..}"
TARGET="$PARENT_DIR/$SLUG"
SHELL_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if [ -d "$TARGET" ]; then
  echo "Error: Target directory '$TARGET' already exists."
  exit 1
fi

mkdir -p "$TARGET"
cp -R "$SHELL_DIR"/. "$TARGET"/
rm -rf "$TARGET/frontend/node_modules" "$TARGET/frontend/dist" "$TARGET/backend/.venv" "$TARGET/backend/db.sqlite3"

sed -i "s/\"name\": \"AppShell\"/\"name\": \"$APP_NAME\"/g" "$TARGET/app.config.json"
sed -i "s/\"slug\": \"app-shell\"/\"slug\": \"$SLUG\"/g" "$TARGET/app.config.json"
cp "$TARGET/.env.example" "$TARGET/.env"

echo "Bootstrapped independent app '$APP_NAME' at $TARGET"
echo "Next steps:"
echo "  cd $TARGET && docker compose up --build"

