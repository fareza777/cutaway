#!/usr/bin/env bash
# Installs the release APK, walks the app on a connected device, and captures a
# screenshot at each stop.
#
#   tools/device-check.sh
#
# This is the one check that exercises the real thing: real GL driver, real
# touch input, real asset loading out of the APK. Everything else in the repo
# runs headless.

set -euo pipefail

ANDROID_HOME="${ANDROID_HOME:-/c/Android/Sdk}"
ADB="$ANDROID_HOME/platform-tools/adb.exe"
PKG=com.cutaway.explorer
APK=android/app/build/outputs/apk/release/app-release.apk
SHOTS=.shots

shot() {
  sleep "${2:-3}"
  "$ADB" exec-out screencap -p > "$SHOTS/$1.png"
  echo "  → $SHOTS/$1.png"
}

# Screen coordinates are resolved from the live display size, so this works on
# whatever device happens to be attached rather than one hard-coded phone.
read -r W H <<<"$("$ADB" shell wm size | sed 's/.*: //' | tr 'x' ' ')"
at() { "$ADB" shell input tap "$(printf '%.0f' "$(echo "$W * $1" | bc -l)")" "$(printf '%.0f' "$(echo "$H * $2" | bc -l)")"; }
swipe() { "$ADB" shell input swipe "$(printf '%.0f' "$(echo "$W * $1" | bc -l)")" "$(printf '%.0f' "$(echo "$H * $2" | bc -l)")" "$(printf '%.0f' "$(echo "$W * $3" | bc -l)")" "$(printf '%.0f' "$(echo "$H * $4" | bc -l)")" "${5:-400}"; }

mkdir -p "$SHOTS"
echo "display ${W}x${H}"

echo "installing…"
"$ADB" install -r "$APK" >/dev/null
"$ADB" shell am force-stop "$PKG" || true
"$ADB" shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1

shot 01-library 6

echo "opening the jet engine…"
at 0.5 0.42            # second library card
shot 02-turbofan 7

echo "rotating…"
swipe 0.72 0.5 0.28 0.5 500
shot 03-rotated 2

echo "exploding…"
at 0.16 0.895          # Explode tool
sleep 1
swipe 0.12 0.83 0.88 0.83 600   # drag the slider to full
shot 04-exploded 3

echo "x-ray…"
at 0.16 0.895          # close Explode
sleep 1
at 0.62 0.895          # X-ray
shot 05-xray 3

echo "tapping a part…"
at 0.62 0.895          # x-ray off
sleep 1
at 0.45 0.45
shot 06-part 3

echo "walkthrough…"
"$ADB" shell input keyevent KEYCODE_BACK
sleep 1
at 0.5 0.955           # How it works
shot 07-story 3

echo
echo "crashes since launch:"
"$ADB" logcat -d -b crash --pid="$("$ADB" shell pidof "$PKG" || echo 0)" 2>/dev/null | tail -20 || echo "  (none)"
