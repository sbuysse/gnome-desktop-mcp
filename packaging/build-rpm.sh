#!/bin/bash
# Builds RPMs for gnome-desktop-mcp from the current working tree.
#
# The source tarball is made from the working tree rather than from git HEAD,
# so uncommitted changes are included -- which is usually what you want when
# testing a package locally.
#
# Output lands in ./dist/. Nothing is written to ~/rpmbuild and nothing is
# installed; use dnf on the resulting RPMs when you want them on the system.

set -euo pipefail

SPEC_NAME="gnome-desktop-mcp.spec"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
SPEC="$HERE/$SPEC_NAME"

name=$(rpmspec -q --qf '%{name}\n' "$SPEC" 2>/dev/null | head -1)
version=$(rpmspec -q --qf '%{version}\n' "$SPEC" 2>/dev/null | head -1)
nv="$name-$version"

if ! command -v rpmbuild >/dev/null 2>&1; then
    echo "error: rpmbuild not found. sudo dnf install rpm-build rpmdevtools" >&2
    exit 1
fi

topdir="$(mktemp -d -t gnome-mcp-rpmbuild.XXXXXX)"
trap 'rm -rf "$topdir"' EXIT
mkdir -p "$topdir"/{SOURCES,SPECS,BUILD,BUILDROOT,RPMS,SRPMS}

# Stage the tree under the expected directory name. gschemas.compiled is a
# build artefact and must never be shipped: the schema is compiled from XML at
# install time by glib2's file triggers.
staging="$topdir/stage/$nv"
mkdir -p "$staging"
tar -cf - -C "$ROOT" \
    --exclude=.git \
    --exclude=dist \
    --exclude=__pycache__ \
    --exclude='*.pyc' \
    --exclude=gschemas.compiled \
    . | tar -xf - -C "$staging"

tar -czf "$topdir/SOURCES/$nv.tar.gz" -C "$topdir/stage" "$nv"
cp "$SPEC" "$topdir/SPECS/"

mkdir -p "$ROOT/dist"

echo "==> building source RPM"
rpmbuild --define "_topdir $topdir" -bs "$topdir/SPECS/$SPEC_NAME" >/dev/null
cp "$topdir"/SRPMS/*.rpm "$ROOT/dist/"
srpm=$(basename "$topdir"/SRPMS/*.rpm)
echo "    dist/$srpm"

# The Python half uses the pyproject RPM macros, whose dynamic BuildRequires
# need the build backend present. ${RPMBUILD_EXTRA_ARGS} is an escape hatch for
# local testing against a backend supplied some other way (e.g. PYTHONPATH).
if ! python3 -c 'import hatchling' >/dev/null 2>&1 &&
   [ -z "${RPMBUILD_EXTRA_ARGS:-}" ]; then
    cat <<MSG

Source RPM built, but the binary RPMs need the Python build backend:

    sudo dnf builddep dist/$srpm
    $0

MSG
    exit 0
fi

echo "==> building binary RPMs"
# shellcheck disable=SC2086
rpmbuild --define "_topdir $topdir" ${RPMBUILD_EXTRA_ARGS:-} \
    -bb "$topdir/SPECS/$SPEC_NAME" >"$topdir/build.log" 2>&1 || {
        echo "build failed; last 30 lines:" >&2
        tail -30 "$topdir/build.log" >&2
        exit 1
    }

cp "$topdir"/RPMS/noarch/*.rpm "$ROOT/dist/"
echo
echo "==> built into dist/"
for f in "$topdir"/RPMS/noarch/*.rpm; do
    echo "    $(basename "$f")"
done
cat <<MSG

Install with:

    sudo dnf install ./dist/*.noarch.rpm

Then, once per user:

    gnome-extensions enable desktop-automation@gnomemcp.github.io

On Wayland the Shell must be restarted to pick up a new extension, so log out
and back in first.
MSG
