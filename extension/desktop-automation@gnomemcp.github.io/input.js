import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';

function _getSeat() {
    return Clutter.get_default_backend().get_default_seat();
}

function _createKeyboard() {
    return _getSeat().create_virtual_device(
        Clutter.InputDeviceType.KEYBOARD_DEVICE);
}

function _createPointer() {
    return _getSeat().create_virtual_device(
        Clutter.InputDeviceType.POINTER_DEVICE);
}

export function keyPress(keyval) {
    const vkbd = _createKeyboard();
    const now = GLib.get_monotonic_time();
    vkbd.notify_keyval(now, keyval, Clutter.KeyState.PRESSED);
    vkbd.notify_keyval(now + 50000, keyval, Clutter.KeyState.RELEASED);
    return true;
}

// Takes resolved X11 keyvals, not key names: Clutter has no keyval_from_name()
// to call from inside the Shell, so the MCP server resolves names before the
// call reaches us (see utils.combo_to_keyvals).
export function keyCombo(keyvals) {
    const vkbd = _createKeyboard();
    let time = GLib.get_monotonic_time();

    for (const keyval of keyvals) {
        vkbd.notify_keyval(time, keyval, Clutter.KeyState.PRESSED);
        time += 10000;
    }

    // Released in reverse, so modifiers outlive the key they modify.
    for (let i = keyvals.length - 1; i >= 0; i--) {
        vkbd.notify_keyval(time, keyvals[i], Clutter.KeyState.RELEASED);
        time += 10000;
    }

    return true;
}

export function typeText(text) {
    const vkbd = _createKeyboard();
    let time = GLib.get_monotonic_time();
    const hasUnichar = typeof vkbd.notify_key_unichar === 'function';

    for (const char of text) {
        if (hasUnichar) {
            vkbd.notify_key_unichar(time, char.codePointAt(0), Clutter.KeyState.PRESSED);
            time += 10000;
            vkbd.notify_key_unichar(time, char.codePointAt(0), Clutter.KeyState.RELEASED);
        } else {
            const cp = char.codePointAt(0);
            // ASCII printable (0x20–0x7E): use codepoint directly as X11 keysym.
            // Non-ASCII: use Unicode keysym convention (0x01000000 | codepoint).
            const keyval = (cp >= 0x20 && cp <= 0x7E) ? cp : (cp | 0x01000000);
            vkbd.notify_keyval(time, keyval, Clutter.KeyState.PRESSED);
            time += 10000;
            vkbd.notify_keyval(time, keyval, Clutter.KeyState.RELEASED);
        }
        time += 10000;
    }

    return true;
}

export function mouseMove(x, y) {
    const vmouse = _createPointer();
    vmouse.notify_absolute_motion(GLib.get_monotonic_time(), x, y);
    return true;
}

export function mouseClick(x, y, button) {
    const vmouse = _createPointer();
    const now = GLib.get_monotonic_time();
    vmouse.notify_absolute_motion(now, x, y);
    vmouse.notify_button(now + 10000, button, Clutter.ButtonState.PRESSED);
    vmouse.notify_button(now + 50000, button, Clutter.ButtonState.RELEASED);
    return true;
}

export function mouseDoubleClick(x, y, button) {
    const vmouse = _createPointer();
    let time = GLib.get_monotonic_time();
    vmouse.notify_absolute_motion(time, x, y);
    vmouse.notify_button(time + 10000, button, Clutter.ButtonState.PRESSED);
    vmouse.notify_button(time + 50000, button, Clutter.ButtonState.RELEASED);
    vmouse.notify_button(time + 100000, button, Clutter.ButtonState.PRESSED);
    vmouse.notify_button(time + 150000, button, Clutter.ButtonState.RELEASED);
    return true;
}

export function mouseDown(x, y, button) {
    const vmouse = _createPointer();
    const now = GLib.get_monotonic_time();
    vmouse.notify_absolute_motion(now, x, y);
    vmouse.notify_button(now + 10000, button, Clutter.ButtonState.PRESSED);
    return true;
}

export function mouseUp(x, y, button) {
    const vmouse = _createPointer();
    const now = GLib.get_monotonic_time();
    vmouse.notify_absolute_motion(now, x, y);
    vmouse.notify_button(now + 10000, button, Clutter.ButtonState.RELEASED);
    return true;
}

export function mouseDrag(x1, y1, x2, y2, button) {
    const vmouse = _createPointer();
    let time = GLib.get_monotonic_time();
    vmouse.notify_absolute_motion(time, x1, y1);
    vmouse.notify_button(time + 10000, button, Clutter.ButtonState.PRESSED);
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const cx = Math.round(x1 + (x2 - x1) * t);
        const cy = Math.round(y1 + (y2 - y1) * t);
        time += 20000;
        vmouse.notify_absolute_motion(time, cx, cy);
    }
    time += 10000;
    vmouse.notify_button(time, button, Clutter.ButtonState.RELEASED);
    return true;
}

export function mouseScroll(x, y, dx, dy) {
    const vmouse = _createPointer();
    const now = GLib.get_monotonic_time();
    vmouse.notify_absolute_motion(now, x, y);
    vmouse.notify_scroll_continuous(now + 10000, dx, dy,
        Clutter.ScrollFinishFlags.NONE);
    return true;
}
