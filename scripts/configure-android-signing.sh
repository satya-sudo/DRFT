#!/usr/bin/env sh

set -eu

if [ $# -lt 5 ]; then
  echo "Usage: sh scripts/configure-android-signing.sh <android-dir> <keystore-file-name> <alias> <store-password> <key-password>" >&2
  exit 1
fi

ANDROID_DIR="$1"
KEYSTORE_FILE_NAME="$2"
KEY_ALIAS="$3"
STORE_PASSWORD="$4"
KEY_PASSWORD="$5"
GRADLE_PROPERTIES_FILE="$ANDROID_DIR/gradle.properties"
BUILD_GRADLE_FILE="$ANDROID_DIR/app/build.gradle"

cat >> "$GRADLE_PROPERTIES_FILE" <<EOF
DRFT_UPLOAD_STORE_FILE=$KEYSTORE_FILE_NAME
DRFT_UPLOAD_KEY_ALIAS=$KEY_ALIAS
DRFT_UPLOAD_STORE_PASSWORD=$STORE_PASSWORD
DRFT_UPLOAD_KEY_PASSWORD=$KEY_PASSWORD
EOF

if ! grep -q "DRFT_UPLOAD_STORE_FILE" "$BUILD_GRADLE_FILE"; then
  perl -0pi -e 's/signingConfigs \{\n\s*debug \{\n\s*storeFile file\("debug\.keystore"\)\n\s*storePassword "android"\n\s*keyAlias "androiddebugkey"\n\s*keyPassword "android"\n\s*\n\s*\}/signingConfigs {\n        debug {\n            storeFile file("debug.keystore")\n            storePassword "android"\n            keyAlias "androiddebugkey"\n            keyPassword "android"\n        }\n        release {\n            if (project.hasProperty("DRFT_UPLOAD_STORE_FILE")) {\n                storeFile file(DRFT_UPLOAD_STORE_FILE)\n                storePassword DRFT_UPLOAD_STORE_PASSWORD\n                keyAlias DRFT_UPLOAD_KEY_ALIAS\n                keyPassword DRFT_UPLOAD_KEY_PASSWORD\n            }\n        }\n    }/s' "$BUILD_GRADLE_FILE"

  perl -0pi -e 's/buildTypes \{\n\s*debug \{\n\s*signingConfig signingConfigs\.debug\n\s*\}\n\s*release \{\n/buildTypes {\n        debug {\n            signingConfig signingConfigs.debug\n        }\n        release {\n            signingConfig signingConfigs.release\n/s' "$BUILD_GRADLE_FILE"
fi

echo "Configured Android release signing in $BUILD_GRADLE_FILE"
