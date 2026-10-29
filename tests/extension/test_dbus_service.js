// Tests for the D-Bus service's access control.
//
// This is the security-relevant half of the extension: everything a caller on
// the session bus can reach goes through DbusService, and the panel indicator
// shows only what this service tells it. The tests below pin down the parts
// that are easy to "simplify" back into a hole.
//
// Only methods that refuse early are exercised against a live service -- the
// bodies that reach Clutter, Shell or `global` need a running compositor, so
// they are called only in the disabled state, where the gate returns first.

import Gio from 'gi://Gio';
import { DbusService } from '../../extension/desktop-automation@gnomemcp.github.io/dbus.js';
import { check, finish, mockInvocation, section } from './harness.js';

section('default state');
{
    const service = new DbusService();
    check('automation is off until something turns it on',
        service.enabled === false);
    check('activity log starts empty', service.activityLog.length === 0);
}

section('SetEnabled cannot arm automation over D-Bus');
{
    const service = new DbusService();
    const invocation = mockInvocation();
    service.SetEnabledAsync([true], invocation);

    check('SetEnabled(true) is refused',
        invocation.error !== null && invocation.value === null);
    check('refusal uses ACCESS_DENIED',
        invocation.error?.code === Gio.DBusError.ACCESS_DENIED,
        `got ${invocation.error?.code}`);
    check('refusal names the only way in',
        /AccessDenied/.test(invocation.error?.message ?? '') &&
        /top bar/.test(invocation.error?.message ?? ''),
        invocation.error?.message);
    check('service stays disabled after a refused enable',
        service.enabled === false);
    check('refused enable is logged as blocked',
        service.activityLog.at(-1)?.method === 'SetEnabled' &&
        service.activityLog.at(-1)?.allowed === false);
}
{
    // Being already enabled must not make SetEnabled(true) succeed: otherwise a
    // caller could use the reply to confirm it had armed automation itself.
    const service = new DbusService();
    service.enabled = true;
    const invocation = mockInvocation();
    service.SetEnabledAsync([true], invocation);
    check('SetEnabled(true) is refused even when already enabled',
        invocation.error !== null && invocation.value === null);
    check('a refused enable does not disturb the current state',
        service.enabled === true);
}

section('SetEnabled can still disarm automation');
{
    const service = new DbusService();
    service.enabled = true;
    const invocation = mockInvocation();
    service.SetEnabledAsync([false], invocation);

    check('SetEnabled(false) succeeds',
        invocation.error === null && invocation.value !== null);
    check('automation is now off', service.enabled === false);
    check('the disable is logged as allowed',
        service.activityLog.at(-1)?.allowed === true);
}

section('every automation method is gated');
{
    // One representative from each capability group. All are called while
    // disabled, so the gate returns before any of them reach the compositor.
    const gated = [
        ['Screenshot', (s, i) => s.ScreenshotAsync([false], i)],
        ['ScreenshotArea', (s, i) => s.ScreenshotAreaAsync([0, 0, 1, 1, false], i)],
        ['PickColor', (s, i) => s.PickColorAsync([0, 0], i)],
        ['CleanupScreenshots', (s, i) => s.CleanupScreenshotsAsync([], i)],
        ['ListWindows', (s, i) => s.ListWindowsAsync([], i)],
        ['GetWindow', (s, i) => s.GetWindowAsync([1], i)],
        ['FocusWindow', (s, i) => s.FocusWindowAsync([1], i)],
        ['CloseWindow', (s, i) => s.CloseWindowAsync([1], i)],
        ['ListWorkspaces', (s, i) => s.ListWorkspacesAsync([], i)],
        ['ActivateWorkspace', (s, i) => s.ActivateWorkspaceAsync([0], i)],
        ['KeyPress', (s, i) => s.KeyPressAsync([65], i)],
        ['KeyCombo', (s, i) => s.KeyComboAsync([[65507, 99]], i)],
        ['TypeText', (s, i) => s.TypeTextAsync(['hello'], i)],
        ['MouseMove', (s, i) => s.MouseMoveAsync([0, 0], i)],
        ['MouseClick', (s, i) => s.MouseClickAsync([0, 0, 1], i)],
        ['MouseDown', (s, i) => s.MouseDownAsync([0, 0, 1], i)],
        ['MouseUp', (s, i) => s.MouseUpAsync([0, 0, 1], i)],
        ['MouseDrag', (s, i) => s.MouseDragAsync([0, 0, 1, 1, 1], i)],
        ['MouseScroll', (s, i) => s.MouseScrollAsync([0, 0, 0, 1], i)],
        ['GetMonitors', (s, i) => s.GetMonitorsAsync([], i)],
    ];

    for (const [name, call] of gated) {
        const service = new DbusService();
        const invocation = mockInvocation();
        call(service, invocation);

        check(`${name} is refused while disabled`,
            invocation.value === null &&
            /Disabled/.test(invocation.error?.message ?? ''),
            invocation.error?.message ?? 'returned a value instead of an error');
        check(`${name} is logged as blocked`,
            service.activityLog.at(-1)?.method === name &&
            service.activityLog.at(-1)?.allowed === false,
            JSON.stringify(service.activityLog.at(-1)));
    }
}

section('KeyCombo argument validation');
{
    // Enabled, but an empty combo must be rejected before input.js is reached:
    // the virtual keyboard needs a compositor, so this also proves the check
    // happens in the service rather than further down.
    const service = new DbusService();
    service.enabled = true;
    const invocation = mockInvocation();
    service.KeyComboAsync([[]], invocation);

    check('an empty combo is refused',
        invocation.value === null &&
        /InputFailed/.test(invocation.error?.message ?? ''),
        invocation.error?.message ?? 'returned a value instead of an error');
    check('refusal uses INVALID_ARGS',
        invocation.error?.code === Gio.DBusError.INVALID_ARGS,
        `got ${invocation.error?.code}`);
}

section('status methods stay reachable while disabled');
{
    const service = new DbusService();

    const ping = mockInvocation();
    service.PingAsync([], ping);
    check('Ping answers while disabled',
        ping.error === null && ping.value !== null);

    const getEnabled = mockInvocation();
    service.GetEnabledAsync([], getEnabled);
    check('GetEnabled answers while disabled',
        getEnabled.error === null && getEnabled.value !== null);
    check('GetEnabled reports disabled',
        getEnabled.value?.deepUnpack?.()[0] === false,
        JSON.stringify(getEnabled.value?.deepUnpack?.()));
}

section('activity log');
{
    const service = new DbusService();
    service.PingAsync([], mockInvocation());
    const entry = service.activityLog.at(-1);

    check('entry records the method name', entry?.method === 'Ping');
    check('entry records an ISO timestamp',
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(entry?.timestamp ?? ''),
        entry?.timestamp);
    check('entry carries nothing but method, timestamp and verdict',
        JSON.stringify(Object.keys(entry).sort()) ===
        JSON.stringify(['allowed', 'method', 'timestamp']),
        JSON.stringify(Object.keys(entry)));
}
{
    // The README promises the log holds "name + timestamp only, no data".
    const service = new DbusService();
    const secret = 'correct-horse-battery-staple';
    service.TypeTextAsync([secret], mockInvocation());
    check('typed text never reaches the activity log',
        !JSON.stringify(service.activityLog).includes(secret));
}
{
    const service = new DbusService();
    for (let i = 0; i < 30; i++)
        service.PingAsync([], mockInvocation());
    check('log is capped at 20 entries',
        service.activityLog.length === 20, `${service.activityLog.length}`);
}

section('enabled-change notification (what the indicator follows)');
{
    const service = new DbusService();
    const seen = [];
    service.onEnabledChanged = value => seen.push(value);

    service.enabled = true;
    check('setter notifies on enable',
        seen.length === 1 && seen[0] === true, JSON.stringify(seen));

    service.enabled = true;
    check('no notification when the value is unchanged',
        seen.length === 1, JSON.stringify(seen));

    service.enabled = false;
    check('setter notifies on disable',
        seen.length === 2 && seen[1] === false, JSON.stringify(seen));

    service.enabled = 'yes';
    check('notification carries a real boolean, not the raw value',
        seen.length === 3 && seen[2] === true, JSON.stringify(seen));
}
{
    // If this regresses, the panel toggle keeps reading "on" after any process
    // on the bus turns automation off.
    const service = new DbusService();
    service.enabled = true;
    const seen = [];
    service.onEnabledChanged = value => seen.push(value);
    service.SetEnabledAsync([false], mockInvocation());
    check('the D-Bus disable path notifies the indicator',
        seen.length === 1 && seen[0] === false, JSON.stringify(seen));
}

finish('dbus service');
