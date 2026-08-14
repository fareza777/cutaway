#!/usr/bin/env bash
# Release build that cannot ship stale models.
#
#   ./tools/build-apk.sh 0.9.0
#
# Gradle's bundling task decides for itself whether it needs to run, and it gets
# it wrong: rebuilt .glb files were packaged from a previous run's copies twice
# in a row. Removing the generated bundle is cheap insurance, and the verify
# step at the end is what actually proves it worked.
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="${1:?usage: tools/build-apk.sh <version>}"

npm run build:models
rm -rf android/app/build/generated/assets/react android/app/build/generated/res/react
(cd android && ./gradlew assembleRelease -q --console=plain -PreactNativeArchitectures=arm64-v8a)

mkdir -p dist
cp android/app/build/outputs/apk/release/app-release.apk "dist/cutaway-${VERSION}-arm64.apk"
node tools/verify-apk.mjs "dist/cutaway-${VERSION}-arm64.apk"
ls -la "dist/cutaway-${VERSION}-arm64.apk"
