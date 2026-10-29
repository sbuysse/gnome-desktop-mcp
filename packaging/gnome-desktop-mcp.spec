%global uuid        desktop-automation@gnomemcp.github.io
%global extdir      %{_datadir}/gnome-shell/extensions/%{uuid}
%global srcname     gnome_desktop_mcp

Name:           gnome-desktop-mcp
Version:        0.1.0
Release:        1%{?dist}
Summary:        MCP server and GNOME Shell extension for desktop automation

License:        GPL-3.0-only
URL:            https://github.com/sbuysse/gnome-desktop-mcp
Source0:        %{name}-%{version}.tar.gz

BuildArch:      noarch

BuildRequires:  python3-devel
# For validating the GSettings schema at build time.
BuildRequires:  glib2-devel

%description
Desktop automation for GNOME on Wayland, exposed over the Model Context
Protocol so that MCP clients can take screenshots, manage windows and inject
keyboard and mouse input.

GNOME on Wayland deliberately prevents external processes from capturing the
screen or synthesising input. This project therefore ships two halves: a GNOME
Shell extension that runs inside the compositor and exports a D-Bus API, and a
Python MCP server that bridges that API to MCP clients. Both halves must be
installed for the automation to work.

Automation is off by default and can only be armed from the extension's menu in
the GNOME top bar.


%package -n python3-%{name}
Summary:        MCP server bridging the Desktop Automation D-Bus API

Requires:       python3-mcp >= 1.0.0
Requires:       python3-dasbus >= 1.7
# PyGObject is not listed: python3-dasbus already pulls python3-gobject-base,
# which is all the GLib/Gio access this package needs. Requiring the full
# python3-gobject here would drag in bindings nothing uses.
# The server does nothing on its own; the extension provides the D-Bus API it
# talks to. A Recommends rather than a Requires, so the server can be installed
# on a machine that drives a different host.
Recommends:     gnome-shell-extension-desktop-automation = %{version}-%{release}

%description -n python3-%{name}
The Python half of gnome-desktop-mcp. Provides the gnome-desktop-mcp
executable, an MCP server over stdio that translates MCP tool calls into D-Bus
calls against the Desktop Automation GNOME Shell extension.


%package -n gnome-shell-extension-desktop-automation
Summary:        GNOME Shell extension exposing a desktop automation D-Bus API

# No upper bound is expressed here on purpose. Extensions are tied to the
# Shell's JS API, but the Shell already enforces that itself from the
# shell-version list in metadata.json (currently 45-50): on a newer Shell the
# extension is simply reported as incompatible instead of loading. A Conflicts
# would block the GNOME upgrade outright, which is worse.
Requires:       gnome-shell >= 45
Recommends:     python3-%{name} = %{version}-%{release}

%description -n gnome-shell-extension-desktop-automation
A GNOME Shell extension that runs inside the Wayland compositor and exports
io.github.gnomemcp.DesktopAutomation on the session bus, offering screenshots,
window management, workspace control and input injection.

Automation is disabled until it is switched on from the extension's top bar
menu; it cannot be armed over D-Bus. While enabled, the top bar shows an
indicator and the menu lists recent calls.

The extension must be enabled once after installation:

    gnome-extensions enable desktop-automation@gnomemcp.github.io

On Wayland, log out and back in first so the Shell picks up the new extension.


%prep
%autosetup -n %{name}-%{version}


%generate_buildrequires
# The Python project lives in a subdirectory of the tarball.
cd mcp-server
%pyproject_buildrequires


%build
cd mcp-server
%pyproject_wheel


%install
cd mcp-server
%pyproject_install
%pyproject_save_files %{srcname}
cd ..

# GNOME Shell extension. Installed system-wide, so it is available to every
# user on the machine but still has to be enabled per user.
install -d %{buildroot}%{extdir}
install -pm 0644 extension/%{uuid}/*.js %{buildroot}%{extdir}
install -pm 0644 extension/%{uuid}/metadata.json %{buildroot}%{extdir}
install -pm 0644 extension/%{uuid}/stylesheet.css %{buildroot}%{extdir}

# The schema goes to the system schema directory rather than travelling inside
# the extension: glib2's file triggers recompile the cache on install and
# removal, and Extension.getSettings() falls back to the default schema source
# when the extension ships no schemas/ directory of its own. Deliberately NOT
# packaging a prebuilt gschemas.compiled, which must never be shipped.
install -d %{buildroot}%{_datadir}/glib-2.0/schemas
install -pm 0644 extension/%{uuid}/schemas/*.gschema.xml \
    %{buildroot}%{_datadir}/glib-2.0/schemas


%check
# Validate the schema we are about to ship.
glib-compile-schemas --strict --dry-run \
    %{buildroot}%{_datadir}/glib-2.0/schemas

# The extension's own test suite. It runs the extension modules under plain
# gjs and self-skips when gjs or the Shell/mutter typelibs are absent, which
# they normally are in a minimal build root. Add
#   BuildRequires: gjs gnome-shell mutter
# to make it execute during the build.
./tests/extension/run.sh


%files -n python3-%{name} -f %{pyproject_files}
%doc README.md
%license LICENSE
%{_bindir}/gnome-desktop-mcp

%files -n gnome-shell-extension-desktop-automation
%doc README.md
%license LICENSE
%dir %{extdir}
%{extdir}/*.js
%{extdir}/metadata.json
%{extdir}/stylesheet.css
%{_datadir}/glib-2.0/schemas/org.gnome.shell.extensions.desktop-automation.gschema.xml


%changelog
* Thu Oct 29 2026 Christian F.K. Schaller <christian.schaller@gmail.com> - 0.1.0-1
- Initial package
