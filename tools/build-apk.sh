#!/usr/bin/env bash
# Compatibility wrapper for the portable Node release entrypoint.
#
#   ./tools/build-apk.sh 0.13.0
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "$SCRIPT_DIR/build-apk.mjs" "$@"
