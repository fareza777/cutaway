#!/usr/bin/env bash
# Captures a screenshot from the connected device.
#
#   tools/device-shot.sh <name> [seconds-to-wait]
#
# Used to eyeball the real render on real hardware — the one thing neither the
# typecheck nor the headless smoke test can tell you anything about.

set -euo pipefail

ANDROID_HOME="${ANDROID_HOME:-/c/Android/Sdk}"
ADB="$ANDROID_HOME/platform-tools/adb.exe"
OUT_DIR="${SHOT_DIR:-./.shots}"
NAME="${1:-shot}"
WAIT="${2:-2}"

mkdir -p "$OUT_DIR"
sleep "$WAIT"
"$ADB" exec-out screencap -p > "$OUT_DIR/$NAME.png"
echo "$OUT_DIR/$NAME.png"
