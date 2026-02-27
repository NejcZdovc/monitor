#!/usr/bin/env bash
set -euo pipefail

# Generates latest-mac.yml for electron-updater and uploads it to the GitHub release.
# Downloads all zip artifacts from the release to compute checksums.
# Usage: ./scripts/generate-update-yml.sh <version>
# Requires: GITHUB_TOKEN env var, gh CLI

VERSION="${1:?Usage: generate-update-yml.sh <version>}"
TAG="v${VERSION}"
RELEASE_DATE=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# Download all zip assets from the release
gh release download "$TAG" --pattern "*.zip" --dir "$TMPDIR"

ZIP_COUNT=$(find "$TMPDIR" -name "*.zip" | wc -l | tr -d ' ')
if [ "$ZIP_COUNT" -eq 0 ]; then
  echo "Error: No zip artifacts found in release $TAG" >&2
  exit 1
fi

echo "Found $ZIP_COUNT zip artifact(s)"

YML_PATH="$TMPDIR/latest-mac.yml"

# Write header
cat > "$YML_PATH" <<EOF
version: ${VERSION}
files:
EOF

FIRST_URL=""
FIRST_SHA512=""

# Process each zip, sorted for deterministic output
for ZIP_PATH in $(find "$TMPDIR" -name "*.zip" | sort); do
  # Electron Forge's GitHub publisher replaces spaces with dots in asset names
  ZIP_NAME=$(basename "$ZIP_PATH" | tr ' ' '.')
  ZIP_SIZE=$(stat -f%z "$ZIP_PATH" 2>/dev/null || stat -c%s "$ZIP_PATH")
  ZIP_SHA512=$(shasum -a 512 "$ZIP_PATH" | awk '{print $1}' | xxd -r -p | base64)

  cat >> "$YML_PATH" <<EOF
  - url: ${ZIP_NAME}
    sha512: ${ZIP_SHA512}
    size: ${ZIP_SIZE}
EOF

  if [ -z "$FIRST_URL" ]; then
    FIRST_URL="$ZIP_NAME"
    FIRST_SHA512="$ZIP_SHA512"
  fi
done

cat >> "$YML_PATH" <<EOF
path: ${FIRST_URL}
sha512: ${FIRST_SHA512}
releaseDate: '${RELEASE_DATE}'
EOF

echo "Generated latest-mac.yml:"
cat "$YML_PATH"

# Upload to GitHub release
gh release upload "$TAG" "$YML_PATH" --clobber
echo "Uploaded latest-mac.yml to release ${TAG}"
