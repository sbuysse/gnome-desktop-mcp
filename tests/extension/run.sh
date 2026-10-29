#!/bin/bash
# Runs the gjs test suite for the GNOME Shell extension.
#
# These tests import the extension's own modules and run them under plain gjs,
# outside gnome-shell. That works for the modules which only need Gio/GLib/Meta/
# Clutter/Shell typelibs. It does NOT work for indicator.js, extension.js or
# consent.js: those import resource:///org/gnome/shell/..., a GResource that
# only exists inside a running shell.
#
# Exits 0 and prints SKIP when the toolchain is unavailable, so this is safe to
# call from CI runners that have no GNOME installed.

set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"

if ! command -v gjs >/dev/null 2>&1; then
    echo "SKIP: gjs not found (provided by the gjs package on Fedora)"
    exit 0
fi

# Shell, Meta and Clutter typelibs live in private, version-suffixed directories
# that are not on the default GI search path. The exact paths differ per distro
# and change with every GNOME release, so discover them rather than pin them.
shopt -s nullglob
candidates=(
    /usr/lib64/gnome-shell /usr/lib/gnome-shell /usr/lib/*/gnome-shell
    /usr/lib64/mutter-* /usr/lib/mutter-* /usr/lib/*/mutter-*
)
typelib_dirs=()
for namespace in Shell Meta Clutter; do
    found=""
    for dir in "${candidates[@]}"; do
        for hit in "$dir"/"$namespace"-*.typelib; do
            found="$dir"
            break 2
        done
    done
    if [ -z "$found" ]; then
        echo "SKIP: no $namespace typelib found (install gnome-shell and mutter)"
        exit 0
    fi
    typelib_dirs+=("$found")
done
shopt -u nullglob

# De-duplicate while preserving order.
gi_path=""
for dir in "${typelib_dirs[@]}"; do
    case ":$gi_path:" in
        *":$dir:"*) ;;
        *) gi_path="${gi_path:+$gi_path:}$dir" ;;
    esac
done
export GI_TYPELIB_PATH="$gi_path${GI_TYPELIB_PATH:+:$GI_TYPELIB_PATH}"

# Point XDG_RUNTIME_DIR at a throwaway directory. screenshot.js resolves its
# capture directory from it at import time, so without this the cleanup tests
# would operate on the real session's captures.
workdir="$(mktemp -d -t gnome-mcp-test.XXXXXX)"
trap 'rm -rf "$workdir"' EXIT
export XDG_RUNTIME_DIR="$workdir/runtime"
mkdir -p "$XDG_RUNTIME_DIR"
chmod 700 "$XDG_RUNTIME_DIR"

echo "gjs:      $(gjs --version | head -1)"
echo "typelibs: $GI_TYPELIB_PATH"

status=0
for test_file in "$HERE"/test_*.js; do
    echo
    echo "=== $(basename "$test_file") ==="
    if ! gjs -m "$test_file"; then
        status=1
    fi
done

echo
if [ "$status" -eq 0 ]; then
    echo "extension tests: all suites passed"
else
    echo "extension tests: FAILURES"
fi
exit "$status"
