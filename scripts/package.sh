#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
version="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$project_dir/manifest.json")"
dist_dir="$project_dir/dist"
archive="$dist_dir/bunpro-italian-assistant-v$version.zip"

mkdir -p "$dist_dir"
rm -f "$archive"
cd "$project_dir"
zip -q "$archive" manifest.json content.js styles.css popup.html popup.js popup.css LICENSE README.md
unzip -t "$archive"
printf '%s\n' "$archive"
