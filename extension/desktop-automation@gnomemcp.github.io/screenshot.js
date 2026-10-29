import Shell from 'gi://Shell';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

// XDG_RUNTIME_DIR (/run/user/UID) is owned by the user and mode 0700, so no
// other local user can pre-create this path, swap it for a symlink, or read
// what lands in it. /tmp would be world-writable and racy.
const SCREENSHOT_DIR = GLib.build_filenamev([
    GLib.get_user_runtime_dir(),
    'gnome-mcp',
]);
const SCREENSHOT_PREFIX = 'screenshot-';
const SCREENSHOT_SUFFIX = '.png';
let _counter = 0;

function _ensureDir() {
    GLib.mkdir_with_parents(SCREENSHOT_DIR, 0o700);
}

function _nextFilename() {
    _counter++;
    return GLib.build_filenamev([
        SCREENSHOT_DIR,
        `${SCREENSHOT_PREFIX}${Date.now()}-${_counter}${SCREENSHOT_SUFFIX}`,
    ]);
}

function _createStream(filepath) {
    const file = Gio.File.new_for_path(filepath);
    return file.replace(null, false, Gio.FileCreateFlags.PRIVATE, null);
}

export function screenshotFull(includeCursor, invocation) {
    _ensureDir();
    const filepath = _nextFilename();
    const stream = _createStream(filepath);
    const screenshot = new Shell.Screenshot();

    screenshot.screenshot(includeCursor, stream, (source, result) => {
        try {
            screenshot.screenshot_finish(result);
            stream.close(null);
            invocation.return_value(GLib.Variant.new('(s)', [filepath]));
        } catch (e) {
            stream.close(null);
            invocation.return_error_literal(
                Gio.DBusError, Gio.DBusError.FAILED,
                `ScreenshotFailed: ${e.message}`);
        }
    });
}

export function screenshotWindow(includeCursor, includeFrame, invocation, onComplete = null) {
    _ensureDir();
    const filepath = _nextFilename();
    const stream = _createStream(filepath);
    const screenshot = new Shell.Screenshot();

    screenshot.screenshot_window(includeFrame, includeCursor, stream, (source, result) => {
        try {
            screenshot.screenshot_window_finish(result);
            stream.close(null);
            if (onComplete) onComplete();
            invocation.return_value(GLib.Variant.new('(s)', [filepath]));
        } catch (e) {
            stream.close(null);
            if (onComplete) onComplete();
            invocation.return_error_literal(
                Gio.DBusError, Gio.DBusError.FAILED,
                `ScreenshotFailed: ${e.message}`);
        }
    });
}

export function screenshotArea(x, y, width, height, includeCursor, invocation) {
    _ensureDir();
    const filepath = _nextFilename();
    const stream = _createStream(filepath);
    const screenshot = new Shell.Screenshot();

    screenshot.screenshot_area(x, y, width, height, stream, (source, result) => {
        try {
            screenshot.screenshot_area_finish(result);
            stream.close(null);
            invocation.return_value(GLib.Variant.new('(s)', [filepath]));
        } catch (e) {
            stream.close(null);
            invocation.return_error_literal(
                Gio.DBusError, Gio.DBusError.FAILED,
                `ScreenshotFailed: ${e.message}`);
        }
    });
}

export function pickColor(x, y, invocation) {
    const screenshot = new Shell.Screenshot();

    screenshot.pick_color(x, y, (source, result) => {
        try {
            const color = screenshot.pick_color_finish(result);
            invocation.return_value(GLib.Variant.new('(ddd)', [
                color.red / 255.0,
                color.green / 255.0,
                color.blue / 255.0,
            ]));
        } catch (e) {
            invocation.return_error_literal(
                Gio.DBusError, Gio.DBusError.FAILED,
                `ScreenshotFailed: ${e.message}`);
        }
    });
}

export function cleanupScreenshots() {
    let count = 0;
    const dir = Gio.File.new_for_path(SCREENSHOT_DIR);
    if (!dir.query_exists(null))
        return count;

    const enumerator = dir.enumerate_children(
        'standard::name', Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
    let info;
    while ((info = enumerator.next_file(null)) !== null) {
        // Only ever delete files this module created.
        const name = info.get_name();
        if (!name.startsWith(SCREENSHOT_PREFIX) || !name.endsWith(SCREENSHOT_SUFFIX))
            continue;
        try {
            if (dir.get_child(name).delete(null))
                count++;
        } catch (e) {
            logError(e, `[DesktopAutomation] failed to delete ${name}`);
        }
    }
    enumerator.close(null);
    return count;
}
