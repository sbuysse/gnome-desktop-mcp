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

const KEY_MAP = {
    'return': 0xff0d, 'enter': 0xff0d, 'backspace': 0xff08, 'tab': 0xff09,
    'escape': 0xff1b, 'esc': 0xff1b, 'delete': 0xffff, 'del': 0xffff,
    'insert': 0xff63, 'ins': 0xff63, 'home': 0xff50, 'end': 0xff57,
    'page_up': 0xff55, 'pageup': 0xff55, 'prior': 0xff55,
    'page_down': 0xff56, 'pagedown': 0xff56, 'next': 0xff56,
    'left': 0xff51, 'up': 0xff52, 'right': 0xff53, 'down': 0xff54,
    'control_l': 0xffe3, 'control_r': 0xffe4, 'ctrl': 0xffe3, 'control': 0xffe3,
    'shift_l': 0xffe1, 'shift_r': 0xffe2, 'shift': 0xffe1,
    'alt_l': 0xffe9, 'alt_r': 0xffea, 'alt': 0xffe9,
    'super_l': 0xffeb, 'super_r': 0xffec, 'super': 0xffeb, 'meta': 0xffeb, 'win': 0xffeb,
    'space': 0x0020,
    'f1': 0xffbe, 'f2': 0xffbf, 'f3': 0xffc0, 'f4': 0xffc1,
    'f5': 0xffc2, 'f6': 0xffc3, 'f7': 0xffc4, 'f8': 0xffc5,
    'f9': 0xffc6, 'f10': 0xffc7, 'f11': 0xffc8, 'f12': 0xffc9
};

function _keyvalFromName(k) {
    if (typeof Clutter.keyval_from_name === 'function') {
        const v = Clutter.keyval_from_name(k);
        if (v !== 0) return v;
    }
    const lower = k.toLowerCase();
    if (KEY_MAP[lower] !== undefined) {
        return KEY_MAP[lower];
    }
    if (Clutter['KEY_' + k] !== undefined) {
        return Clutter['KEY_' + k];
    }
    if (k.length === 1) {
        return k.codePointAt(0);
    }
    return 0;
}

export function keyCombo(combo) {
    const keys = combo.split('+').map(k => k.trim());
    const keyvals = keys.map(k => {
        const kv = _keyvalFromName(k);
        if (kv === 0)
            throw new Error(`Unknown key name: ${k}`);
        return kv;
    });

    const vkbd = _createKeyboard();
    let time = GLib.get_monotonic_time();

    for (const kv of keyvals) {
        vkbd.notify_keyval(time, kv, Clutter.KeyState.PRESSED);
        time += 10000;
    }

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
        Clutter.ScrollSource.WHEEL,
        Clutter.ScrollFinishFlags.NONE);
    return true;
}
