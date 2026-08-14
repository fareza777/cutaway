#!/usr/bin/env bash
# Reproduces the "crash if you spin it while it is still loading" report.
#
#   tools/stress-load.sh [rounds]
#
# Opens an object and immediately starts flinging the model around, which is
# what the user was doing. Each round relaunches cold so the model has to load
# again. Prints the round number at which the process died.

set -uo pipefail

ANDROID_HOME="${ANDROID_HOME:-/c/Android/Sdk}"
ADB="$ANDROID_HOME/platform-tools/adb.exe"
PKG=com.cutaway.explorer
ROUNDS="${1:-8}"

for round in $(seq 1 "$ROUNDS"); do
  "$ADB" shell am force-stop "$PKG"
  "$ADB" logcat -c
  "$ADB" shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
  sleep 6

  # Open the first object, then start dragging before it can finish loading.
  "$ADB" shell input tap 540 1250
  for _ in $(seq 1 14); do
    "$ADB" shell input swipe 800 1100 250 1300 90
    "$ADB" shell input swipe 250 1300 850 1000 90
  done

  pid=$("$ADB" shell pidof "$PKG" | tr -d '\r')
  if [ -z "$pid" ]; then
    echo "DIED on round $round"
    echo "--- native crash ---"
    "$ADB" logcat -d -b crash -t 60
    echo "--- last app log ---"
    "$ADB" logcat -d -t 80 | grep -Ei "cutaway|EXGL|libGL|SIGSEGV|FATAL|abort|OutOfMemory" | tail -30
    exit 1
  fi
  echo "round $round survived (pid $pid)"
done

echo "survived $ROUNDS rounds"
