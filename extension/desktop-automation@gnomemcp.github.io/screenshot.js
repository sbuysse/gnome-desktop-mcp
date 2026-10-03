import Shell from 'gi://Shell';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const SCREENSHOT_DIR = '/tmp/gnome-mcp';
let _counter = 0;

function _ensureDir() {
    GLib.mkdir_with_parents(SCREENSHOT_DIR, 0o700);
}

function _nextFilename() {
    _counter++;
    return GLib.build_filenamev([
        SCREENSHOT_DIR,
        `screenshot-${Date.now()}-${_counter}.png`,
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
            // Cogl.Color in Mutter 47 exposes float channels 0.0-1.0; older
            // versions returned 0-255 ints. NaN means the field read failed
            // entirely (boxed type layout mismatch) — fall back to reading
            // the value as a byte array variant if available.
            const norm = (v) => {
                if (typeof v !== 'number' || isNaN(v)) return 0.0;
                return v > 1.0 ? v / 255.0 : v;
            };
            invocation.return_value(GLib.Variant.new('(ddd)', [
                norm(color.red),
                norm(color.green),
                norm(color.blue),
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
        'standard::name', Gio.FileQueryInfoFlags.NONE, null);
    let info;
    while ((info = enumerator.next_file(null)) !== null) {
        const child = dir.get_child(info.get_name());
        if (child.delete(null))
            count++;
    }
    return count;
}
