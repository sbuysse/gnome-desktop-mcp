// Minimal assertion helpers for the gjs-based extension tests.
//
// There is no test framework here on purpose: gjs has no bundled runner, and
// pulling one in would mean carrying node_modules in a GNOME extension repo
// that otherwise ships nothing but plain ES modules.

import System from 'system';

let _pass = 0;
let _fail = 0;
const _failed = [];

/** Fake Gio.DBusMethodInvocation that records what the service returned. */
export function mockInvocation() {
    return {
        value: null,
        error: null,
        return_value(variant) {
            this.value = variant;
        },
        return_error_literal(_domain, code, message) {
            this.error = { code, message };
        },
    };
}

export function section(name) {
    print(`\n  ${name}`);
}

export function check(name, condition, detail = '') {
    if (condition) {
        _pass++;
        print(`    ok   ${name}`);
    } else {
        _fail++;
        _failed.push(name);
        print(`    FAIL ${name}${detail ? ` -- ${detail}` : ''}`);
    }
}

/** Print the tally and exit non-zero if anything failed. */
export function finish(suite) {
    print(`\n  ${suite}: ${_pass} passed, ${_fail} failed`);
    if (_fail > 0) {
        print(`  failed: ${_failed.join(', ')}`);
        System.exit(1);
    }
    System.exit(0);
}
