"""MCP server for GNOME desktop automation."""

import json
from mcp.server.fastmcp import FastMCP
from gnome_desktop_mcp.dbus_client import (
    DbusClient, AutomationDisabledError, ExtensionNotFoundError,
    WindowNotFoundError, ScreenshotFailedError, InputFailedError,
)
from gnome_desktop_mcp.utils import friendly_to_keyval, combo_to_keyvals, file_to_base64, cleanup_file

mcp = FastMCP(
    "gnome-desktop-automation",
    instructions="GNOME desktop automation: screenshots, window management, input injection",
)

_client: DbusClient | None = None


def _get_client() -> DbusClient:
    global _client
    if _client is None:
        _client = DbusClient()
    return _client


def _handle_error(e: Exception) -> str:
    if isinstance(e, AutomationDisabledError):
        return f"Error: {e}"
    if isinstance(e, ExtensionNotFoundError):
        return f"Error: {e}"
    if isinstance(e, WindowNotFoundError):
        return f"Error: {e}"
    if isinstance(e, ScreenshotFailedError):
        return f"Error: {e}"
    if isinstance(e, InputFailedError):
        return f"Error: {e}"
    return f"Error: {e}"


# --- Screenshot Tools ---

@mcp.tool()
def screenshot(include_cursor: bool = False, format: str = "path") -> str:
    """Take a full screenshot of the entire screen.

    Args:
        include_cursor: Whether to include the mouse cursor.
        format: "path" returns filepath, "base64" returns base64-encoded PNG.
    """
    try:
        client = _get_client()
        filepath = client.screenshot(include_cursor)
        if format == "base64":
            data = file_to_base64(filepath)
            cleanup_file(filepath)
            return data
        return filepath
    except Exception as e:
        return _handle_error(e)


@mcp.tool()
def screenshot_window(window_id: int, include_frame: bool = True,
                      include_cursor: bool = False,
                      format: str = "path") -> str:
    """Take a screenshot of a specific window.

    Args:
        window_id: The window's stable ID (from list_windows).
        include_frame: Whether to include window decorations.
        include_cursor: Whether to include the mouse cursor.
        format: "path" returns filepath, "base64" returns base64-encoded PNG.
    """
    try:
        client = _get_client()
        filepath = client.screenshot_window(window_id, include_frame, include_cursor)
        if format == "base64":
            data = file_to_base64(filepath)
            cleanup_file(filepath)
            return data
        return filepath
    except Exception as e:
        return _handle_error(e)


@mcp.tool()
def screenshot_area(x: int, y: int, width: int, height: int,
                    include_cursor: bool = False,
                    format: str = "path") -> str:
    """Take a screenshot of a rectangular screen region.

    Args:
        x: Left edge in pixels.
        y: Top edge in pixels.
        width: Width in pixels.
        height: Height in pixels.
        include_cursor: Whether to include the mouse cursor.
        format: "path" returns filepath, "base64" returns base64-encoded PNG.
    """
    try:
        client = _get_client()
        filepath = client.screenshot_area(x, y, width, height, include_cursor)
        if format == "base64":
            data = file_to_base64(filepath)
            cleanup_file(filepath)
            return data
        return filepath
    except Exception as e:
        return _handle_error(e)


@mcp.tool()
def pick_color(x: int, y: int) -> str:
    """Get the pixel color at screen coordinates.

    Args:
        x: X coordinate in pixels.
        y: Y coordinate in pixels.

    Returns:
        JSON with r, g, b values (0.0-1.0).
    """
    try:
        client = _get_client()
        r, g, b = client.pick_color(x, y)
        return json.dumps({"r": r, "g": g, "b": b})
    except Exception as e:
        return _handle_error(e)


# --- Window Tools ---

@mcp.tool()
def list_windows() -> str:
    """List all open windows with their properties.

    Returns JSON array with id, title, wmClass, position, size, state, workspace.
    """
    try:
        client = _get_client()
        return json.dumps(client.list_windows(), indent=2)
    except Exception as e:
        return _handle_error(e)


@mcp.tool()
def get_window(window_id: int) -> str:
    """Get detailed properties of a specific window.

    Args:
        window_id: The window's stable ID (from list_windows).
    """
    try:
        client = _get_client()
        return json.dumps(client.get_window(window_id), indent=2)
    except Exception as e:
        return _handle_error(e)


@mcp.tool()
def focus_window(window_id: int) -> str:
    """Focus and raise a window.

    Args:
        window_id: The window's stable ID (from list_windows).
    """
    try:
        client = _get_client()
        client.focus_window(window_id)
        return "Window focused"
    except Exception as e:
        return _handle_error(e)


@mcp.tool()
def move_resize_window(window_id: int, x: int, y: int,
                       width: int, height: int) -> str:
    """Move and resize a window. Unmaximizes first if needed.

    Args:
        window_id: The window's stable ID.
        x: New X position.
        y: New Y position.
        width: New width.
        height: New height.
    """
    try:
        client = _get_client()
        client.move_resize_window(window_id, x, y, width, height)
        return "Window moved and resized"
    except Exception as e:
        return _handle_error(e)


@mcp.tool()
def minimize_window(window_id: int) -> str:
    """Minimize a window."""
    try:
        client = _get_client()
        client.minimize_window(window_id)
        return "Window minimized"
    except Exception as e:
        return _handle_error(e)


@mcp.tool()
def unminimize_window(window_id: int) -> str:
    """Unminimize (restore) a window."""
    try:
        client = _get_client()
        client.unminimize_window(window_id)
        return "Window unminimized"
    except Exception as e:
        return _handle_error(e)


@mcp.tool()
def maximize_window(window_id: int) -> str:
    """Maximize a window."""
    try:
        client = _get_client()
        client.maximize_window(window_id)
        return "Window maximized"
    except Exception as e:
        return _handle_error(e)


@mcp.tool()
def unmaximize_window(window_id: int) -> str:
    """Unmaximize a window."""
    try:
        client = _get_client()
        client.unmaximize_window(window_id)
        return "Window unmaximized"
    except Exception as e:
        return _handle_error(e)


@mcp.tool()
def close_window(window_id: int) -> str:
    """Close a window."""
    try:
        client = _get_client()
        client.close_window(window_id)
        return "Window closed"
    except Exception as e:
        return _handle_error(e)


@mcp.tool()
def list_workspaces() -> str:
    """List all workspaces with their properties."""
    try:
        client = _get_client()
        return json.dumps(client.list_workspaces(), indent=2)
    except Exception as e:
        return _handle_error(e)


@mcp.tool()
def activate_workspace(index: int) -> str:
    """Switch to a workspace by index (0-based)."""
    try:
        client = _get_client()
        client.activate_workspace(index)
        return f"Switched to workspace {index}"
    except Exception as e:
        return _handle_error(e)


# --- Input Tools ---

@mcp.tool()
def key_press(key: str) -> str:
    """Press and release a single key.

    Args:
        key: Key name like "Return", "a", "F5", "Ctrl", "Escape".
    """
    try:
        client = _get_client()
        keyval = friendly_to_keyval(key)
        client.key_press(keyval)
        return f"Key pressed: {key}"
    except Exception as e:
        return _handle_error(e)


@mcp.tool()
def key_combo(keys: str) -> str:
    """Press a key combination.

    Args:
        keys: Combo like "Ctrl+Alt+t", "Shift+F5", "Super+l". Keys are held in
            the order given and released in reverse. For the + key itself use
            its keysym name, as in "Ctrl+plus".
    """
    try:
        keyvals = combo_to_keyvals(keys)
        client = _get_client()
        client.key_combo(keyvals)
        return f"Key combo pressed: {keys}"
    except Exception as e:
        return _handle_error(e)


@mcp.tool()
def type_text(text: str) -> str:
    """Type text character by character.

    Args:
        text: Text to type.
    """
    try:
        client = _get_client()
        client.type_text(text)
        return f"Typed {len(text)} characters"
    except Exception as e:
        return _handle_error(e)


@mcp.tool()
def mouse_move(x: int, y: int) -> str:
    """Move the mouse to absolute screen coordinates."""
    try:
        client = _get_client()
        client.mouse_move(x, y)
        return f"Mouse moved to ({x}, {y})"
    except Exception as e:
        return _handle_error(e)


@mcp.tool()
def mouse_click(x: int, y: int, button: int = 1) -> str:
    """Click at screen coordinates. button: 1=left, 2=middle, 3=right."""
    try:
        client = _get_client()
        client.mouse_click(x, y, button)
        return f"Clicked at ({x}, {y}) button {button}"
    except Exception as e:
        return _handle_error(e)


@mcp.tool()
def mouse_double_click(x: int, y: int, button: int = 1) -> str:
    """Double-click at screen coordinates."""
    try:
        client = _get_client()
        client.mouse_double_click(x, y, button)
        return f"Double-clicked at ({x}, {y}) button {button}"
    except Exception as e:
        return _handle_error(e)


@mcp.tool()
def mouse_down(x: int, y: int, button: int = 1) -> str:
    """Press mouse button down without releasing."""
    try:
        client = _get_client()
        client.mouse_down(x, y, button)
        return f"Mouse down at ({x}, {y}) button {button}"
    except Exception as e:
        return _handle_error(e)


@mcp.tool()
def mouse_up(x: int, y: int, button: int = 1) -> str:
    """Release mouse button."""
    try:
        client = _get_client()
        client.mouse_up(x, y, button)
        return f"Mouse up at ({x}, {y}) button {button}"
    except Exception as e:
        return _handle_error(e)


@mcp.tool()
def mouse_drag(x1: int, y1: int, x2: int, y2: int, button: int = 1) -> str:
    """Drag from one position to another."""
    try:
        client = _get_client()
        client.mouse_drag(x1, y1, x2, y2, button)
        return f"Dragged from ({x1}, {y1}) to ({x2}, {y2})"
    except Exception as e:
        return _handle_error(e)


@mcp.tool()
def mouse_scroll(x: int, y: int, dx: float, dy: float) -> str:
    """Scroll at screen coordinates. dy negative=up, positive=down."""
    try:
        client = _get_client()
        client.mouse_scroll(x, y, dx, dy)
        return f"Scrolled at ({x}, {y}) by ({dx}, {dy})"
    except Exception as e:
        return _handle_error(e)


# --- Utility Tools ---

@mcp.tool()
def get_monitors() -> str:
    """List all monitors with their geometry and scale."""
    try:
        client = _get_client()
        return json.dumps(client.get_monitors(), indent=2)
    except Exception as e:
        return _handle_error(e)


@mcp.tool()
def ping() -> str:
    """Check if the extension is running and responding."""
    try:
        client = _get_client()
        client.ping()
        return "Extension is alive"
    except Exception as e:
        return _handle_error(e)


@mcp.tool()
def get_enabled() -> str:
    """Check if automation is enabled."""
    try:
        client = _get_client()
        if client.get_enabled():
            return "Automation is enabled"
        return (
            "Automation is disabled. It cannot be enabled from here -- ask the "
            "user to turn on 'Allow Automation' in the Desktop Automation menu "
            "in the GNOME top bar."
        )
    except Exception as e:
        return _handle_error(e)


@mcp.tool()
def cleanup_screenshots() -> str:
    """Remove all temporary screenshot files."""
    try:
        client = _get_client()
        count = client.cleanup_screenshots()
        return f"Removed {count} screenshot files"
    except Exception as e:
        return _handle_error(e)


def main():
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
