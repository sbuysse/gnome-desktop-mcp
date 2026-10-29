# Gnome-MCP

Desktop automation for GNOME Wayland via MCP. Take screenshots, manage windows, and inject keyboard/mouse input from AI assistants like Claude Code.

[![GNOME Desktop MCP server](https://glama.ai/mcp/servers/sbuysse/gnome-desktop-mcp/badges/card.svg)](https://glama.ai/mcp/servers/sbuysse/gnome-desktop-mcp)

```
Claude Code  ──MCP──▶  gnome-desktop-mcp (Python)  ──D-Bus──▶  GNOME Shell Extension
```

## Why

GNOME Wayland blocks external processes from taking screenshots or injecting input. This extension runs **inside** the compositor, bypassing those restrictions, and exposes a D-Bus API. The MCP server bridges that API to any MCP-compatible client.

## Features

- **29 MCP tools**: screenshots, window management, input injection, workspace control
- **Privacy indicator**: top bar icon shows connection status (red = active, grey = idle)
- **Consent dialog**: first-use notice when the extension is enabled
- **Access gating**: master kill switch; automation can only be armed from the top bar menu, not over D-Bus

## Requirements

- GNOME Shell 45-49 (Wayland)
- Python 3.12+

## Installation

### Quick install (development)

```bash
git clone https://github.com/sbuysse/gnome-mcp.git
cd gnome-mcp
./install.sh
```

Then log out and back in (required for Wayland), and enable:

```bash
gnome-extensions enable desktop-automation@gnomemcp.github.io
```

### MCP server only (from PyPI)

```bash
pip install gnome-desktop-mcp
```

## Claude Code Configuration

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "desktop-automation": {
      "command": "gnome-desktop-mcp"
    }
  }
}
```

## Tools

### Screenshots

| Tool | Description |
|---|---|
| `screenshot` | Full screen capture |
| `screenshot_window` | Capture a specific window |
| `screenshot_area` | Capture a rectangular region |
| `pick_color` | Get pixel color at coordinates |
| `cleanup_screenshots` | Remove temp screenshot files |

### Windows

| Tool | Description |
|---|---|
| `list_windows` | List all open windows |
| `get_window` | Get detailed window properties |
| `focus_window` | Focus and raise a window |
| `move_resize_window` | Move and resize a window |
| `minimize_window` / `unminimize_window` | Minimize/restore |
| `maximize_window` / `unmaximize_window` | Maximize/restore |
| `close_window` | Close a window |
| `list_workspaces` | List all workspaces |
| `activate_workspace` | Switch workspace |

### Input

| Tool | Description |
|---|---|
| `key_press` | Press a single key ("Return", "F5", "a") |
| `key_combo` | Key combination ("Ctrl+Alt+t") |
| `type_text` | Type text character by character |
| `mouse_move` | Move mouse to coordinates |
| `mouse_click` | Click at coordinates |
| `mouse_double_click` | Double-click |
| `mouse_down` / `mouse_up` | Press/release mouse button |
| `mouse_drag` | Drag from point A to point B |
| `mouse_scroll` | Scroll at coordinates |

### Utility

| Tool | Description |
|---|---|
| `ping` | Check extension is alive |
| `get_enabled` | Check whether automation is enabled |
| `get_monitors` | List monitors with geometry |

Automation is deliberately not switchable from MCP — only from the top bar menu.

## Privacy

- **Top bar indicator** shows when automation is active, and always reflects the
  service's real state — including changes made over D-Bus
- **Toggle switch** to disable all automation instantly. Automation can only be
  *enabled* from this menu: `SetEnabled(true)` over D-Bus is refused, so no other
  process (and no MCP client) can re-arm it behind your back
- **Activity log** tracks last 20 method calls (name + timestamp only, no data),
  marking calls that were blocked
- **D-Bus access gating**: all automation methods blocked when disabled
- **Screenshots** are written 0600 to `$XDG_RUNTIME_DIR/gnome-mcp` (not `/tmp`),
  so no other local user can read or tamper with them. They persist until
  `cleanup_screenshots` runs or you log out
- **Session bus trust model**: any local user process can call the API (consistent with GNOME's security model)

## Architecture

The GNOME Shell extension (`desktop-automation@gnomemcp.github.io`) runs inside the Wayland compositor. It exports `io.github.gnomemcp.DesktopAutomation` on the session D-Bus with privileged access to:

- `Shell.Screenshot` — silent screenshots (no permission dialog)
- `Meta.Window` — window management
- `Clutter.VirtualInputDevice` — keyboard/mouse injection

The Python MCP server (`gnome-desktop-mcp`) translates MCP tool calls into D-Bus method calls via `dasbus`.

## Development

```bash
# Install in development mode
pip install -e mcp-server[dev]

# Run tests
python -m pytest tests/ -v          # MCP server
./tests/extension/run.sh            # GNOME Shell extension (needs gjs)

# Watch extension logs
journalctl /usr/bin/gnome-shell -f

# Test D-Bus directly
gdbus call --session --dest org.gnome.Shell \
  --object-path /io/github/gnomemcp/DesktopAutomation \
  --method io.github.gnomemcp.DesktopAutomation.Ping
```

## License

[GPL-3.0](LICENSE)
