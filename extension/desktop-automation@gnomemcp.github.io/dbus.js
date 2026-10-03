import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import * as Screenshot from './screenshot.js';
import * as Windows from './windows.js';
import * as Input from './input.js';

const INTERFACE_XML = `
<node>
  <interface name="io.github.gnomemcp.DesktopAutomation">

    <!-- Screenshots -->
    <method name="Screenshot">
      <arg type="b" direction="in" name="includeCursor"/>
      <arg type="s" direction="out" name="filepath"/>
    </method>
    <method name="ScreenshotWindow">
      <arg type="u" direction="in" name="windowId"/>
      <arg type="b" direction="in" name="includeFrame"/>
      <arg type="b" direction="in" name="includeCursor"/>
      <arg type="s" direction="out" name="filepath"/>
    </method>
    <method name="ScreenshotArea">
      <arg type="i" direction="in" name="x"/>
      <arg type="i" direction="in" name="y"/>
      <arg type="i" direction="in" name="width"/>
      <arg type="i" direction="in" name="height"/>
      <arg type="b" direction="in" name="includeCursor"/>
      <arg type="s" direction="out" name="filepath"/>
    </method>
    <method name="PickColor">
      <arg type="i" direction="in" name="x"/>
      <arg type="i" direction="in" name="y"/>
      <arg type="d" direction="out" name="red"/>
      <arg type="d" direction="out" name="green"/>
      <arg type="d" direction="out" name="blue"/>
    </method>

    <!-- Windows -->
    <method name="ListWindows">
      <arg type="s" direction="out" name="windowsJson"/>
    </method>
    <method name="GetWindow">
      <arg type="u" direction="in" name="windowId"/>
      <arg type="s" direction="out" name="propertiesJson"/>
    </method>
    <method name="FocusWindow">
      <arg type="u" direction="in" name="windowId"/>
      <arg type="b" direction="out" name="success"/>
    </method>
    <method name="MoveResizeWindow">
      <arg type="u" direction="in" name="windowId"/>
      <arg type="i" direction="in" name="x"/>
      <arg type="i" direction="in" name="y"/>
      <arg type="i" direction="in" name="width"/>
      <arg type="i" direction="in" name="height"/>
      <arg type="b" direction="out" name="success"/>
    </method>
    <method name="MinimizeWindow">
      <arg type="u" direction="in" name="windowId"/>
      <arg type="b" direction="out" name="success"/>
    </method>
    <method name="UnminimizeWindow">
      <arg type="u" direction="in" name="windowId"/>
      <arg type="b" direction="out" name="success"/>
    </method>
    <method name="MaximizeWindow">
      <arg type="u" direction="in" name="windowId"/>
      <arg type="b" direction="out" name="success"/>
    </method>
    <method name="UnmaximizeWindow">
      <arg type="u" direction="in" name="windowId"/>
      <arg type="b" direction="out" name="success"/>
    </method>
    <method name="CloseWindow">
      <arg type="u" direction="in" name="windowId"/>
      <arg type="b" direction="out" name="success"/>
    </method>
    <method name="ListWorkspaces">
      <arg type="s" direction="out" name="workspacesJson"/>
    </method>
    <method name="ActivateWorkspace">
      <arg type="i" direction="in" name="index"/>
      <arg type="b" direction="out" name="success"/>
    </method>

    <!-- Input -->
    <method name="KeyPress">
      <arg type="u" direction="in" name="keyval"/>
      <arg type="b" direction="out" name="success"/>
    </method>
    <method name="KeyCombo">
      <arg type="s" direction="in" name="combo"/>
      <arg type="b" direction="out" name="success"/>
    </method>
    <method name="TypeText">
      <arg type="s" direction="in" name="text"/>
      <arg type="b" direction="out" name="success"/>
    </method>
    <method name="MouseMove">
      <arg type="i" direction="in" name="x"/>
      <arg type="i" direction="in" name="y"/>
      <arg type="b" direction="out" name="success"/>
    </method>
    <method name="MouseClick">
      <arg type="i" direction="in" name="x"/>
      <arg type="i" direction="in" name="y"/>
      <arg type="u" direction="in" name="button"/>
      <arg type="b" direction="out" name="success"/>
    </method>
    <method name="MouseDoubleClick">
      <arg type="i" direction="in" name="x"/>
      <arg type="i" direction="in" name="y"/>
      <arg type="u" direction="in" name="button"/>
      <arg type="b" direction="out" name="success"/>
    </method>
    <method name="MouseDown">
      <arg type="i" direction="in" name="x"/>
      <arg type="i" direction="in" name="y"/>
      <arg type="u" direction="in" name="button"/>
      <arg type="b" direction="out" name="success"/>
    </method>
    <method name="MouseUp">
      <arg type="i" direction="in" name="x"/>
      <arg type="i" direction="in" name="y"/>
      <arg type="u" direction="in" name="button"/>
      <arg type="b" direction="out" name="success"/>
    </method>
    <method name="MouseDrag">
      <arg type="i" direction="in" name="x1"/>
      <arg type="i" direction="in" name="y1"/>
      <arg type="i" direction="in" name="x2"/>
      <arg type="i" direction="in" name="y2"/>
      <arg type="u" direction="in" name="button"/>
      <arg type="b" direction="out" name="success"/>
    </method>
    <method name="MouseScroll">
      <arg type="i" direction="in" name="x"/>
      <arg type="i" direction="in" name="y"/>
      <arg type="d" direction="in" name="dx"/>
      <arg type="d" direction="in" name="dy"/>
      <arg type="b" direction="out" name="success"/>
    </method>

    <!-- Utility -->
    <method name="GetMonitors">
      <arg type="s" direction="out" name="monitorsJson"/>
    </method>
    <method name="SetEnabled">
      <arg type="b" direction="in" name="enabled"/>
      <arg type="b" direction="out" name="success"/>
    </method>
    <method name="GetEnabled">
      <arg type="b" direction="out" name="enabled"/>
    </method>
    <method name="Ping">
      <arg type="b" direction="out" name="alive"/>
    </method>
    <method name="CleanupScreenshots">
      <arg type="u" direction="out" name="count"/>
    </method>

  </interface>
</node>
`;

const ERROR_DOMAIN = 'io.github.gnomemcp.DesktopAutomation.Error';

export class DbusService {
    constructor() {
        this._enabled = true;
        this._activityLog = [];
        this._onActivity = null;
        this._screenshotTimerId = null;
    }

    destroy() {
        if (this._screenshotTimerId) {
            GLib.source_remove(this._screenshotTimerId);
            this._screenshotTimerId = null;
        }
    }

    get enabled() { return this._enabled; }
    set enabled(value) { this._enabled = value; }
    get activityLog() { return this._activityLog; }
    set onActivity(callback) { this._onActivity = callback; }

    _logActivity(methodName) {
        const entry = { method: methodName, timestamp: new Date().toISOString() };
        this._activityLog.push(entry);
        if (this._activityLog.length > 20)
            this._activityLog.shift();
        if (this._onActivity)
            this._onActivity(entry);
    }

    _checkEnabled(invocation, methodName) {
        this._logActivity(methodName);
        if (!this._enabled) {
            invocation.return_error_literal(
                Gio.DBusError,
                Gio.DBusError.FAILED,
                `${ERROR_DOMAIN}.Disabled: Automation is disabled`
            );
            return false;
        }
        return true;
    }

    // --- Ungated methods ---

    PingAsync(_params, invocation) {
        this._logActivity('Ping');
        invocation.return_value(GLib.Variant.new('(b)', [true]));
    }

    GetEnabledAsync(_params, invocation) {
        this._logActivity('GetEnabled');
        invocation.return_value(GLib.Variant.new('(b)', [this._enabled]));
    }

    SetEnabledAsync([enabled], invocation) {
        this._logActivity('SetEnabled');
        this._enabled = enabled;
        invocation.return_value(GLib.Variant.new('(b)', [true]));
    }

    // --- Screenshots ---

    ScreenshotAsync([includeCursor], invocation) {
        if (!this._checkEnabled(invocation, 'Screenshot')) return;
        Screenshot.screenshotFull(includeCursor, invocation);
    }

    ScreenshotWindowAsync([windowId, includeFrame, includeCursor], invocation) {
        if (!this._checkEnabled(invocation, 'ScreenshotWindow')) return;
        const win = Windows.findWindow(windowId);
        if (!win) {
            invocation.return_error_literal(Gio.DBusError, Gio.DBusError.FAILED,
                `${ERROR_DOMAIN}.WindowNotFound: No window with ID ${windowId}`);
            return;
        }
        const wasMinimized = win.minimized;
        if (wasMinimized) win.unminimize();
        win.activate(global.get_current_time());
        if (this._screenshotTimerId)
            GLib.source_remove(this._screenshotTimerId);
        this._screenshotTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
            this._screenshotTimerId = null;
            const onComplete = wasMinimized ? () => win.minimize() : null;
            Screenshot.screenshotWindow(includeCursor, includeFrame, invocation, onComplete);
            return GLib.SOURCE_REMOVE;
        });
    }

    ScreenshotAreaAsync([x, y, width, height, includeCursor], invocation) {
        if (!this._checkEnabled(invocation, 'ScreenshotArea')) return;
        Screenshot.screenshotArea(x, y, width, height, includeCursor, invocation);
    }

    PickColorAsync([x, y], invocation) {
        if (!this._checkEnabled(invocation, 'PickColor')) return;
        Screenshot.pickColor(x, y, invocation);
    }

    CleanupScreenshotsAsync(_params, invocation) {
        if (!this._checkEnabled(invocation, 'CleanupScreenshots')) return;
        try {
            const count = Screenshot.cleanupScreenshots();
            invocation.return_value(GLib.Variant.new('(u)', [count]));
        } catch (e) {
            invocation.return_error_literal(Gio.DBusError, Gio.DBusError.FAILED, e.message);
        }
    }

    // --- Windows ---

    ListWindowsAsync(_params, invocation) {
        if (!this._checkEnabled(invocation, 'ListWindows')) return;
        try {
            invocation.return_value(GLib.Variant.new('(s)', [JSON.stringify(Windows.listWindows())]));
        } catch (e) {
            invocation.return_error_literal(Gio.DBusError, Gio.DBusError.FAILED, e.message);
        }
    }

    GetWindowAsync([windowId], invocation) {
        if (!this._checkEnabled(invocation, 'GetWindow')) return;
        const win = Windows.findWindow(windowId);
        if (!win) {
            invocation.return_error_literal(Gio.DBusError, Gio.DBusError.FAILED,
                `${ERROR_DOMAIN}.WindowNotFound: No window with ID ${windowId}`);
            return;
        }
        invocation.return_value(GLib.Variant.new('(s)', [JSON.stringify(Windows.getWindow(win))]));
    }

    FocusWindowAsync([windowId], invocation) {
        if (!this._checkEnabled(invocation, 'FocusWindow')) return;
        const win = Windows.findWindow(windowId);
        if (!win) {
            invocation.return_error_literal(Gio.DBusError, Gio.DBusError.FAILED,
                `${ERROR_DOMAIN}.WindowNotFound: No window with ID ${windowId}`);
            return;
        }
        win.activate(global.get_current_time());
        invocation.return_value(GLib.Variant.new('(b)', [true]));
    }

    MoveResizeWindowAsync([windowId, x, y, width, height], invocation) {
        if (!this._checkEnabled(invocation, 'MoveResizeWindow')) return;
        const win = Windows.findWindow(windowId);
        if (!win) {
            invocation.return_error_literal(Gio.DBusError, Gio.DBusError.FAILED,
                `${ERROR_DOMAIN}.WindowNotFound: No window with ID ${windowId}`);
            return;
        }
        const isMaximized = typeof win.get_maximized === 'function'
            ? win.get_maximized() !== 0
            : (win.maximized_horizontally || win.maximized_vertically || false);
        if (isMaximized)
            win.unmaximize(Meta.MaximizeFlags.BOTH);
        win.move_resize_frame(false, x, y, width, height);
        invocation.return_value(GLib.Variant.new('(b)', [true]));
    }

    MinimizeWindowAsync([windowId], invocation) {
        if (!this._checkEnabled(invocation, 'MinimizeWindow')) return;
        const win = Windows.findWindow(windowId);
        if (!win) {
            invocation.return_error_literal(Gio.DBusError, Gio.DBusError.FAILED,
                `${ERROR_DOMAIN}.WindowNotFound: No window with ID ${windowId}`);
            return;
        }
        win.minimize();
        invocation.return_value(GLib.Variant.new('(b)', [true]));
    }

    UnminimizeWindowAsync([windowId], invocation) {
        if (!this._checkEnabled(invocation, 'UnminimizeWindow')) return;
        const win = Windows.findWindow(windowId);
        if (!win) {
            invocation.return_error_literal(Gio.DBusError, Gio.DBusError.FAILED,
                `${ERROR_DOMAIN}.WindowNotFound: No window with ID ${windowId}`);
            return;
        }
        win.unminimize();
        invocation.return_value(GLib.Variant.new('(b)', [true]));
    }

    MaximizeWindowAsync([windowId], invocation) {
        if (!this._checkEnabled(invocation, 'MaximizeWindow')) return;
        const win = Windows.findWindow(windowId);
        if (!win) {
            invocation.return_error_literal(Gio.DBusError, Gio.DBusError.FAILED,
                `${ERROR_DOMAIN}.WindowNotFound: No window with ID ${windowId}`);
            return;
        }
        win.maximize(Meta.MaximizeFlags.BOTH);
        invocation.return_value(GLib.Variant.new('(b)', [true]));
    }

    UnmaximizeWindowAsync([windowId], invocation) {
        if (!this._checkEnabled(invocation, 'UnmaximizeWindow')) return;
        const win = Windows.findWindow(windowId);
        if (!win) {
            invocation.return_error_literal(Gio.DBusError, Gio.DBusError.FAILED,
                `${ERROR_DOMAIN}.WindowNotFound: No window with ID ${windowId}`);
            return;
        }
        win.unmaximize(Meta.MaximizeFlags.BOTH);
        invocation.return_value(GLib.Variant.new('(b)', [true]));
    }

    CloseWindowAsync([windowId], invocation) {
        if (!this._checkEnabled(invocation, 'CloseWindow')) return;
        const win = Windows.findWindow(windowId);
        if (!win) {
            invocation.return_error_literal(Gio.DBusError, Gio.DBusError.FAILED,
                `${ERROR_DOMAIN}.WindowNotFound: No window with ID ${windowId}`);
            return;
        }
        win.delete(global.get_current_time());
        invocation.return_value(GLib.Variant.new('(b)', [true]));
    }

    ListWorkspacesAsync(_params, invocation) {
        if (!this._checkEnabled(invocation, 'ListWorkspaces')) return;
        try {
            invocation.return_value(GLib.Variant.new('(s)', [JSON.stringify(Windows.listWorkspaces())]));
        } catch (e) {
            invocation.return_error_literal(Gio.DBusError, Gio.DBusError.FAILED, e.message);
        }
    }

    ActivateWorkspaceAsync([index], invocation) {
        if (!this._checkEnabled(invocation, 'ActivateWorkspace')) return;
        const success = Windows.activateWorkspace(index);
        if (!success) {
            invocation.return_error_literal(Gio.DBusError, Gio.DBusError.FAILED,
                'Invalid workspace index');
            return;
        }
        invocation.return_value(GLib.Variant.new('(b)', [true]));
    }

    // --- Input ---

    KeyPressAsync([keyval], invocation) {
        if (!this._checkEnabled(invocation, 'KeyPress')) return;
        try {
            Input.keyPress(keyval);
            invocation.return_value(GLib.Variant.new('(b)', [true]));
        } catch (e) {
            invocation.return_error_literal(Gio.DBusError, Gio.DBusError.FAILED,
                `${ERROR_DOMAIN}.InputFailed: ${e.message}`);
        }
    }

    KeyComboAsync([combo], invocation) {
        if (!this._checkEnabled(invocation, 'KeyCombo')) return;
        try {
            Input.keyCombo(combo);
            invocation.return_value(GLib.Variant.new('(b)', [true]));
        } catch (e) {
            invocation.return_error_literal(Gio.DBusError, Gio.DBusError.FAILED,
                `${ERROR_DOMAIN}.InputFailed: ${e.message}`);
        }
    }

    TypeTextAsync([text], invocation) {
        if (!this._checkEnabled(invocation, 'TypeText')) return;
        try {
            Input.typeText(text);
            invocation.return_value(GLib.Variant.new('(b)', [true]));
        } catch (e) {
            invocation.return_error_literal(Gio.DBusError, Gio.DBusError.FAILED,
                `${ERROR_DOMAIN}.InputFailed: ${e.message}`);
        }
    }

    MouseMoveAsync([x, y], invocation) {
        if (!this._checkEnabled(invocation, 'MouseMove')) return;
        try {
            Input.mouseMove(x, y);
            invocation.return_value(GLib.Variant.new('(b)', [true]));
        } catch (e) {
            invocation.return_error_literal(Gio.DBusError, Gio.DBusError.FAILED,
                `${ERROR_DOMAIN}.InputFailed: ${e.message}`);
        }
    }

    MouseClickAsync([x, y, button], invocation) {
        if (!this._checkEnabled(invocation, 'MouseClick')) return;
        try {
            Input.mouseClick(x, y, button);
            invocation.return_value(GLib.Variant.new('(b)', [true]));
        } catch (e) {
            invocation.return_error_literal(Gio.DBusError, Gio.DBusError.FAILED,
                `${ERROR_DOMAIN}.InputFailed: ${e.message}`);
        }
    }

    MouseDoubleClickAsync([x, y, button], invocation) {
        if (!this._checkEnabled(invocation, 'MouseDoubleClick')) return;
        try {
            Input.mouseDoubleClick(x, y, button);
            invocation.return_value(GLib.Variant.new('(b)', [true]));
        } catch (e) {
            invocation.return_error_literal(Gio.DBusError, Gio.DBusError.FAILED,
                `${ERROR_DOMAIN}.InputFailed: ${e.message}`);
        }
    }

    MouseDownAsync([x, y, button], invocation) {
        if (!this._checkEnabled(invocation, 'MouseDown')) return;
        try {
            Input.mouseDown(x, y, button);
            invocation.return_value(GLib.Variant.new('(b)', [true]));
        } catch (e) {
            invocation.return_error_literal(Gio.DBusError, Gio.DBusError.FAILED,
                `${ERROR_DOMAIN}.InputFailed: ${e.message}`);
        }
    }

    MouseUpAsync([x, y, button], invocation) {
        if (!this._checkEnabled(invocation, 'MouseUp')) return;
        try {
            Input.mouseUp(x, y, button);
            invocation.return_value(GLib.Variant.new('(b)', [true]));
        } catch (e) {
            invocation.return_error_literal(Gio.DBusError, Gio.DBusError.FAILED,
                `${ERROR_DOMAIN}.InputFailed: ${e.message}`);
        }
    }

    MouseDragAsync([x1, y1, x2, y2, button], invocation) {
        if (!this._checkEnabled(invocation, 'MouseDrag')) return;
        try {
            Input.mouseDrag(x1, y1, x2, y2, button);
            invocation.return_value(GLib.Variant.new('(b)', [true]));
        } catch (e) {
            invocation.return_error_literal(Gio.DBusError, Gio.DBusError.FAILED,
                `${ERROR_DOMAIN}.InputFailed: ${e.message}`);
        }
    }

    MouseScrollAsync([x, y, dx, dy], invocation) {
        if (!this._checkEnabled(invocation, 'MouseScroll')) return;
        try {
            Input.mouseScroll(x, y, dx, dy);
            invocation.return_value(GLib.Variant.new('(b)', [true]));
        } catch (e) {
            invocation.return_error_literal(Gio.DBusError, Gio.DBusError.FAILED,
                `${ERROR_DOMAIN}.InputFailed: ${e.message}`);
        }
    }

    // --- Utility ---

    GetMonitorsAsync(_params, invocation) {
        if (!this._checkEnabled(invocation, 'GetMonitors')) return;
        const monitors = [];
        const display = global.display;
        const nMonitors = display.get_n_monitors();
        for (let i = 0; i < nMonitors; i++) {
            const rect = display.get_monitor_geometry(i);
            const scale = display.get_monitor_scale(i);
            monitors.push({
                index: i,
                x: rect.x, y: rect.y,
                width: rect.width, height: rect.height,
                scale,
                primary: i === display.get_primary_monitor(),
            });
        }
        invocation.return_value(GLib.Variant.new('(s)', [JSON.stringify(monitors)]));
    }
}

export { INTERFACE_XML, ERROR_DOMAIN };
