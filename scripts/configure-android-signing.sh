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

if ! grep -q "^DRFT_UPLOAD_STORE_FILE=" "$GRADLE_PROPERTIES_FILE" 2>/dev/null; then
cat >> "$GRADLE_PROPERTIES_FILE" <<EOF
DRFT_UPLOAD_STORE_FILE=$KEYSTORE_FILE_NAME
DRFT_UPLOAD_KEY_ALIAS=$KEY_ALIAS
DRFT_UPLOAD_STORE_PASSWORD=$STORE_PASSWORD
DRFT_UPLOAD_KEY_PASSWORD=$KEY_PASSWORD
EOF
fi

if ! grep -q "DRFT release signing override" "$BUILD_GRADLE_FILE"; then
cat >> "$BUILD_GRADLE_FILE" <<'EOF'

// DRFT release signing override
android {
    signingConfigs {
        release {
            if (project.hasProperty("DRFT_UPLOAD_STORE_FILE")) {
                storeFile file(DRFT_UPLOAD_STORE_FILE)
                storePassword DRFT_UPLOAD_STORE_PASSWORD
                keyAlias DRFT_UPLOAD_KEY_ALIAS
                keyPassword DRFT_UPLOAD_KEY_PASSWORD
            }
        }
    }
    buildTypes {
        release {
            if (project.hasProperty("DRFT_UPLOAD_STORE_FILE")) {
                signingConfig signingConfigs.release
            }
        }
    }
}
EOF
fi

echo "Configured Android release signing in $BUILD_GRADLE_FILE"
