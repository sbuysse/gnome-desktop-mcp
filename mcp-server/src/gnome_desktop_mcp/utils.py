"""Key name mapping, base64 encoding, temp file cleanup."""

import base64
import os
from pathlib import Path

# Friendly name -> Clutter key name
_KEY_NAME_MAP = {
    "Ctrl": "Control_L",
    "Control": "Control_L",
    "Shift": "Shift_L",
    "Alt": "Alt_L",
    "Super": "Super_L",
    "Win": "Super_L",
    "Meta": "Super_L",
    "Tab": "Tab",
    "Return": "Return",
    "Enter": "Return",
    "Escape": "Escape",
    "Esc": "Escape",
    "Backspace": "BackSpace",
    "Delete": "Delete",
    "Del": "Delete",
    "Space": "space",
    "Up": "Up",
    "Down": "Down",
    "Left": "Left",
    "Right": "Right",
    "Plus": "plus",
    "Minus": "minus",
    "Equal": "equal",
}

# Add F1-F12
for _i in range(1, 13):
    _KEY_NAME_MAP[f"F{_i}"] = f"F{_i}"

# Clutter key name -> X11 keyval
_KEYVAL_MAP = {
    "Control_L": 65507,
    "Control_R": 65508,
    "Shift_L": 65505,
    "Shift_R": 65506,
    "Alt_L": 65513,
    "Alt_R": 65514,
    "Super_L": 65515,
    "Super_R": 65516,
    "Tab": 65289,
    "Return": 65293,
    "Escape": 65307,
    "BackSpace": 65288,
    "Delete": 65535,
    "space": 32,
    "Up": 65362,
    "Down": 65364,
    "Left": 65361,
    "Right": 65363,
    # Punctuation. For these the X11 keysym is the ASCII code, and the canonical
    # keysym name is what a combo should spell: "Ctrl+plus", not "Ctrl++",
    # because '+' is the separator.
    "plus": 43,
    "minus": 45,
    "equal": 61,
    "comma": 44,
    "period": 46,
    "slash": 47,
    "backslash": 92,
    "semicolon": 59,
    "apostrophe": 39,
    "grave": 96,
    "bracketleft": 91,
    "bracketright": 93,
}

# Add F1-F12
for _i in range(1, 13):
    _KEYVAL_MAP[f"F{_i}"] = 65469 + _i


def friendly_to_clutter_name(key: str) -> str:
    """Translate a friendly key name to a Clutter key name."""
    if key in _KEY_NAME_MAP:
        return _KEY_NAME_MAP[key]
    return key


def friendly_to_keyval(key: str) -> int:
    """Translate a friendly key name to an X11 keyval."""
    clutter_name = friendly_to_clutter_name(key)
    if clutter_name in _KEYVAL_MAP:
        return _KEYVAL_MAP[clutter_name]
    if len(clutter_name) == 1:
        codepoint = ord(clutter_name)
        # Latin-1 codepoints double as X11 keysyms; anything above needs the
        # Unicode keysym convention, the same rule input.js applies in
        # typeText().
        if codepoint <= 0xFF:
            return codepoint
        return 0x01000000 | codepoint
    raise ValueError(f"Unknown key: {key}")


def combo_to_keyvals(combo: str) -> list[int]:
    """Translate a friendly combo like 'Ctrl+Alt+t' into X11 keyvals.

    The lookup happens on this side rather than in the extension because
    Clutter exposes no name-to-keyval function for the Shell to call: it has
    keyval_name() for the reverse direction, and nothing for this one.
    """
    parts = [part.strip() for part in combo.split("+")]
    if not parts or any(not part for part in parts):
        raise ValueError(
            f"Malformed key combo {combo!r}. Use names joined by '+', as in "
            "'Ctrl+Alt+t'; for the + key itself use its keysym name, 'plus'."
        )
    return [friendly_to_keyval(part) for part in parts]


def file_to_base64(filepath: str) -> str:
    """Read a file and return its base64-encoded content."""
    data = Path(filepath).read_bytes()
    return base64.b64encode(data).decode("ascii")


def cleanup_file(filepath: str) -> None:
    """Remove a temp file if it exists."""
    try:
        os.unlink(filepath)
    except OSError:
        pass
