from unittest.mock import MagicMock, patch
import pytest
from gnome_desktop_mcp.dbus_client import (
    DbusClient, AutomationDisabledError, ExtensionNotFoundError,
    WindowNotFoundError, _translate_error,
)
from dasbus.error import DBusError


@pytest.fixture
def mock_proxy():
    with patch("dasbus.connection.SessionMessageBus") as mock_bus_cls:
        mock_bus = MagicMock()
        mock_bus_cls.return_value = mock_bus
        proxy = MagicMock()
        mock_bus.get_proxy.return_value = proxy
        client = DbusClient()
        yield client, proxy


def test_ping(mock_proxy):
    client, proxy = mock_proxy
    proxy.Ping.return_value = True
    assert client.ping() is True


def test_list_windows(mock_proxy):
    client, proxy = mock_proxy
    proxy.ListWindows.return_value = '[{"id": 1, "title": "Test"}]'
    result = client.list_windows()
    assert result == [{"id": 1, "title": "Test"}]


def test_screenshot(mock_proxy):
    client, proxy = mock_proxy
    proxy.Screenshot.return_value = "/run/user/1000/gnome-mcp/screenshot-123.png"
    result = client.screenshot(False)
    assert result == "/run/user/1000/gnome-mcp/screenshot-123.png"
    proxy.Screenshot.assert_called_once_with(False, timeout=5000)


def test_key_combo_sends_keyvals(mock_proxy):
    client, proxy = mock_proxy
    proxy.KeyCombo.return_value = True
    assert client.key_combo([65507, ord("c")]) is True
    proxy.KeyCombo.assert_called_once_with([65507, 99], timeout=5000)


def test_error_disabled():
    err = DBusError("io.github.gnomemcp.DesktopAutomation.Error.Disabled: Automation is disabled")
    result = _translate_error(err)
    assert isinstance(result, AutomationDisabledError)


def test_error_window_not_found():
    err = DBusError("WindowNotFound: No window with that ID")
    result = _translate_error(err)
    assert isinstance(result, WindowNotFoundError)


def test_connection_refused():
    with patch("dasbus.connection.SessionMessageBus") as mock_bus_cls:
        mock_bus_cls.side_effect = Exception("Connection refused")
        with pytest.raises(ExtensionNotFoundError):
            DbusClient()
