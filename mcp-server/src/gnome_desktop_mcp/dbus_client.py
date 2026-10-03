"""D-Bus client for the Desktop Automation extension."""

import json

IFACE = "io.github.gnomemcp.DesktopAutomation"
BUS_NAME = "org.gnome.Shell"
OBJECT_PATH = "/io/github/gnomemcp/DesktopAutomation"


class AutomationDisabledError(Exception):
    """Raised when automation is disabled by user."""
    pass


class ExtensionNotFoundError(Exception):
    """Raised when the extension is not installed or enabled."""
    pass


class WindowNotFoundError(Exception):
    """Raised when a window ID is invalid."""
    pass


class ScreenshotFailedError(Exception):
    """Raised when a screenshot operation fails."""
    pass


class InputFailedError(Exception):
    """Raised when an input injection fails."""
    pass


def _translate_error(e: Exception) -> Exception:
    """Translate a D-Bus error to a typed exception."""
    msg = str(e)
    if "Disabled" in msg:
        return AutomationDisabledError(
            "Automation disabled by user. Enable from top bar indicator.")
    if "WindowNotFound" in msg:
        return WindowNotFoundError(msg)
    if "ScreenshotFailed" in msg:
        return ScreenshotFailedError(msg)
    if "InputFailed" in msg:
        return InputFailedError(msg)
    return e


class DbusClient:
    """Proxy to the Desktop Automation D-Bus interface."""

    TIMEOUT_MS = 5000  # 5 second timeout

    def __init__(self):
        # Imported lazily so that `tools/list` works in environments without
        # PyGObject / GNOME libraries (e.g. Glama's inspection sandbox).
        try:
            from dasbus.connection import SessionMessageBus
            bus = SessionMessageBus()
            self._proxy = bus.get_proxy(BUS_NAME, OBJECT_PATH)
        except Exception as e:
            raise ExtensionNotFoundError(
                "GNOME Shell extension not installed or not enabled. "
                "Install desktop-automation@gnomemcp.github.io and restart GNOME Shell."
            ) from e

    def _call(self, method: str, *args):
        from dasbus.error import DBusError
        try:
            return getattr(self._proxy, method)(*args, timeout=self.TIMEOUT_MS)
        except DBusError as e:
            raise _translate_error(e) from e
        except TimeoutError as e:
            raise ExtensionNotFoundError(
                "Extension not responding -- GNOME Shell may be busy"
            ) from e

    # --- Utility ---

    def ping(self) -> bool:
        return self._call("Ping")

    def get_enabled(self) -> bool:
        return self._call("GetEnabled")

    def set_enabled(self, enabled: bool) -> bool:
        return self._call("SetEnabled", enabled)

    def get_monitors(self) -> list[dict]:
        return json.loads(self._call("GetMonitors"))

    def cleanup_screenshots(self) -> int:
        return self._call("CleanupScreenshots")

    # --- Screenshots ---

    def screenshot(self, include_cursor: bool = False) -> str:
        return self._call("Screenshot", include_cursor)

    def screenshot_window(self, window_id: int,
                          include_frame: bool = True,
                          include_cursor: bool = False) -> str:
        return self._call("ScreenshotWindow", window_id, include_frame, include_cursor)

    def screenshot_area(self, x: int, y: int, width: int, height: int,
                        include_cursor: bool = False) -> str:
        return self._call("ScreenshotArea", x, y, width, height, include_cursor)

    def pick_color(self, x: int, y: int) -> tuple[float, float, float]:
        # Shell.Screenshot.pick_color_finish returns a CoglColor boxed type
        # that GJS cannot introspect reliably on Mutter 47 (channels read as
        # NaN). Compute the pixel from a 1x1 screenshot_area instead, which
        # goes through the same D-Bus surface but returns a plain PNG.
        import struct, zlib
        path = self.screenshot_area(x, y, 1, 1)
        try:
            data = open(path, 'rb').read()
        finally:
            try:
                import os
                os.unlink(path)
            except OSError:
                pass
        pos = 8
        idat = b''
        w = h = colortype = None
        while pos < len(data):
            ln = struct.unpack('>I', data[pos:pos+4])[0]
            typ = data[pos+4:pos+8]
            chunk = data[pos+8:pos+8+ln]
            if typ == b'IHDR':
                w, h, _depth, colortype = struct.unpack('>IIBB', chunk[:10])
            elif typ == b'IDAT':
                idat += chunk
            pos += 12 + ln
        channels = {2: 3, 6: 4}.get(colortype or 0)
        if not channels or w != 1 or h != 1:
            raise ScreenshotFailedError("pick_color: unexpected screenshot data")
        raw = zlib.decompress(idat)
        ft = raw[0]
        px = bytearray(raw[1:1+channels])
        if ft == 1:
            for i in range(1, channels):
                px[i] = (px[i] + px[i-1]) & 255
        elif ft == 2:
            pass  # first row, no previous
        elif ft == 3:
            for i in range(1, channels):
                px[i] = (px[i] + (px[i-1] >> 1)) & 255
        elif ft == 4:
            for i in range(1, channels):
                a = px[i-1]
                b = 0; c = 0
                p = a + b - c
                pa, pb, pc = abs(p-a), abs(p-b), abs(p-c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                px[i] = (px[i] + pr) & 255
        return (px[0] / 255.0, px[1] / 255.0, px[2] / 255.0)

    # --- Windows ---

    def list_windows(self) -> list[dict]:
        return json.loads(self._call("ListWindows"))

    def get_window(self, window_id: int) -> dict:
        return json.loads(self._call("GetWindow", window_id))

    def focus_window(self, window_id: int) -> bool:
        return self._call("FocusWindow", window_id)

    def move_resize_window(self, window_id: int,
                           x: int, y: int, width: int, height: int) -> bool:
        return self._call("MoveResizeWindow", window_id, x, y, width, height)

    def minimize_window(self, window_id: int) -> bool:
        return self._call("MinimizeWindow", window_id)

    def unminimize_window(self, window_id: int) -> bool:
        return self._call("UnminimizeWindow", window_id)

    def maximize_window(self, window_id: int) -> bool:
        return self._call("MaximizeWindow", window_id)

    def unmaximize_window(self, window_id: int) -> bool:
        return self._call("UnmaximizeWindow", window_id)

    def close_window(self, window_id: int) -> bool:
        return self._call("CloseWindow", window_id)

    def list_workspaces(self) -> list[dict]:
        return json.loads(self._call("ListWorkspaces"))

    def activate_workspace(self, index: int) -> bool:
        return self._call("ActivateWorkspace", index)

    # --- Input ---

    def key_press(self, keyval: int) -> bool:
        return self._call("KeyPress", keyval)

    def key_combo(self, combo: str) -> bool:
        return self._call("KeyCombo", combo)

    def type_text(self, text: str) -> bool:
        return self._call("TypeText", text)

    def mouse_move(self, x: int, y: int) -> bool:
        return self._call("MouseMove", x, y)

    def mouse_click(self, x: int, y: int, button: int = 1) -> bool:
        return self._call("MouseClick", x, y, button)

    def mouse_double_click(self, x: int, y: int, button: int = 1) -> bool:
        return self._call("MouseDoubleClick", x, y, button)

    def mouse_down(self, x: int, y: int, button: int = 1) -> bool:
        return self._call("MouseDown", x, y, button)

    def mouse_up(self, x: int, y: int, button: int = 1) -> bool:
        return self._call("MouseUp", x, y, button)

    def mouse_drag(self, x1: int, y1: int, x2: int, y2: int,
                   button: int = 1) -> bool:
        return self._call("MouseDrag", x1, y1, x2, y2, button)

    def mouse_scroll(self, x: int, y: int, dx: float, dy: float) -> bool:
        return self._call("MouseScroll", x, y, dx, dy)
