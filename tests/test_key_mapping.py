import pytest

from gnome_desktop_mcp.utils import (
    combo_to_keyvals,
    friendly_to_clutter_name,
    friendly_to_keyval,
)


def test_ctrl_maps_to_control_l():
    assert friendly_to_clutter_name("Ctrl") == "Control_L"


def test_control_maps_to_control_l():
    assert friendly_to_clutter_name("Control") == "Control_L"


def test_shift_maps_to_shift_l():
    assert friendly_to_clutter_name("Shift") == "Shift_L"


def test_alt_maps_to_alt_l():
    assert friendly_to_clutter_name("Alt") == "Alt_L"


def test_super_maps_to_super_l():
    assert friendly_to_clutter_name("Super") == "Super_L"


def test_win_maps_to_super_l():
    assert friendly_to_clutter_name("Win") == "Super_L"


def test_meta_maps_to_super_l():
    assert friendly_to_clutter_name("Meta") == "Super_L"


def test_enter_maps_to_return():
    assert friendly_to_clutter_name("Enter") == "Return"


def test_return_maps_to_return():
    assert friendly_to_clutter_name("Return") == "Return"


def test_esc_maps_to_escape():
    assert friendly_to_clutter_name("Esc") == "Escape"


def test_del_maps_to_delete():
    assert friendly_to_clutter_name("Del") == "Delete"


def test_space_maps_to_space():
    assert friendly_to_clutter_name("Space") == "space"


def test_f_keys():
    for i in range(1, 13):
        assert friendly_to_clutter_name(f"F{i}") == f"F{i}"


def test_arrow_keys():
    assert friendly_to_clutter_name("Up") == "Up"
    assert friendly_to_clutter_name("Down") == "Down"
    assert friendly_to_clutter_name("Left") == "Left"
    assert friendly_to_clutter_name("Right") == "Right"


def test_explicit_right_modifier():
    assert friendly_to_clutter_name("Control_R") == "Control_R"


def test_single_letter():
    assert friendly_to_clutter_name("a") == "a"
    assert friendly_to_clutter_name("z") == "z"


def test_combo_to_keyvals():
    assert combo_to_keyvals("Ctrl+Alt+t") == [65507, 65513, ord("t")]
    assert combo_to_keyvals("Shift+F5") == [65505, 65474]
    assert combo_to_keyvals("Super+l") == [65515, ord("l")]


def test_combo_to_keyvals_tolerates_spaces():
    assert combo_to_keyvals(" Ctrl + c ") == [65507, ord("c")]


def test_combo_to_keyvals_single_key():
    assert combo_to_keyvals("Return") == [65293]


def test_combo_to_keyvals_punctuation():
    # "Ctrl++" is ambiguous, so the + key is spelled by its keysym name.
    assert combo_to_keyvals("Ctrl+plus") == [65507, 43]
    assert combo_to_keyvals("Ctrl+Plus") == [65507, 43]
    assert combo_to_keyvals("Ctrl+minus") == [65507, 45]


@pytest.mark.parametrize("combo", ["", "+", "Ctrl+", "+a", "Ctrl++a", "Ctrl + + a"])
def test_combo_to_keyvals_rejects_malformed(combo):
    with pytest.raises(ValueError):
        combo_to_keyvals(combo)


def test_combo_to_keyvals_rejects_unknown_key():
    with pytest.raises(ValueError):
        combo_to_keyvals("Ctrl+NoSuchKey")


def test_keyval_known_keys():
    assert friendly_to_keyval("Return") == 65293
    assert friendly_to_keyval("Escape") == 65307
    assert friendly_to_keyval("Tab") == 65289
    assert friendly_to_keyval("BackSpace") == 65288
    assert friendly_to_keyval("Space") == 32


def test_keyval_ctrl():
    assert friendly_to_keyval("Ctrl") == 65507


def test_keyval_single_char():
    assert friendly_to_keyval("a") == ord("a")
    assert friendly_to_keyval("Z") == ord("Z")


def test_keyval_latin1_char_is_its_codepoint():
    # Latin-1 codepoints are X11 keysyms as-is.
    assert friendly_to_keyval("\u00e4") == 0xE4


def test_keyval_beyond_latin1_uses_unicode_keysym():
    # Above Latin-1, X11 wants 0x01000000 | codepoint.
    assert friendly_to_keyval("\u20ac") == 0x01000000 | 0x20AC


def test_keyval_rejects_unknown_name():
    with pytest.raises(ValueError):
        friendly_to_keyval("NoSuchKey")
