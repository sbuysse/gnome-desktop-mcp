// Tests for screenshot file handling.
//
// Two properties matter here and neither is visible from the Python side:
//
//   1. Captures land under XDG_RUNTIME_DIR, not /tmp. XDG_RUNTIME_DIR is
//      user-owned and mode 0700, so another local user cannot pre-create the
//      directory, swap it for a symlink, or read what is written into it.
//   2. cleanupScreenshots() deletes only the files this module created. It used
//      to delete every child of the directory.
//
// The runner points XDG_RUNTIME_DIR at a throwaway directory, so these tests
// never touch real captures.

import GLib from 'gi://GLib';
import System from 'system';
import Gio from 'gi://Gio';
import { cleanupScreenshots } from '../../extension/desktop-automation@gnomemcp.github.io/screenshot.js';
import { check, finish, section } from './harness.js';

const RUNTIME_DIR = GLib.get_user_runtime_dir();
const SHOT_DIR = GLib.build_filenamev([RUNTIME_DIR, 'gnome-mcp']);

function plant(name, contents = 'x') {
    GLib.file_set_contents(GLib.build_filenamev([SHOT_DIR, name]), contents);
}

function exists(name) {
    return Gio.File.new_for_path(
        GLib.build_filenamev([SHOT_DIR, name])).query_exists(null);
}

function reset() {
    GLib.mkdir_with_parents(SHOT_DIR, 0o700);
    const dir = Gio.File.new_for_path(SHOT_DIR);
    const children = dir.enumerate_children(
        'standard::name', Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
    let info;
    while ((info = children.next_file(null)) !== null) {
        const child = dir.get_child(info.get_name());
        try {
            child.delete(null);
        } catch (e) {
            // a non-empty directory from a previous run; leave it
        }
    }
    children.close(null);
}

// Guard against ever running this against a real session's captures.
if (!RUNTIME_DIR.startsWith('/tmp/') && !RUNTIME_DIR.includes('gnome-mcp-test')) {
    printerr(`refusing to run: XDG_RUNTIME_DIR looks real (${RUNTIME_DIR}).`);
    printerr('Run these tests through tests/extension/run.sh, which isolates it.');
    System.exit(2);
}

section('captures are stored under XDG_RUNTIME_DIR');
{
    reset();
    plant('screenshot-1700000000000-1.png');
    // If SCREENSHOT_DIR were still hardcoded to /tmp/gnome-mcp, cleanup would
    // look somewhere else entirely and find nothing here.
    const removed = cleanupScreenshots();
    check('cleanup acts on $XDG_RUNTIME_DIR/gnome-mcp',
        removed === 1 && !exists('screenshot-1700000000000-1.png'),
        `removed ${removed}`);
}

section('cleanup removes only this module\'s captures');
{
    reset();
    plant('screenshot-1700000000000-1.png');
    plant('screenshot-1700000000000-2.png');
    plant('important-notes.txt', 'do not delete me');
    plant('config.json', '{}');
    plant('screenshot-1700000000000-3.jpg');
    plant('notes-screenshot-1.png');
    GLib.mkdir_with_parents(GLib.build_filenamev([SHOT_DIR, 'subdir']), 0o700);

    const removed = cleanupScreenshots();

    check('reports the number actually deleted', removed === 2, `${removed}`);
    check('deletes screenshot-*.png',
        !exists('screenshot-1700000000000-1.png') &&
        !exists('screenshot-1700000000000-2.png'));
    check('keeps unrelated files', exists('important-notes.txt') && exists('config.json'));
    check('keeps a non-png with the screenshot prefix',
        exists('screenshot-1700000000000-3.jpg'));
    check('keeps a png that merely contains the prefix',
        exists('notes-screenshot-1.png'));
    check('keeps subdirectories', exists('subdir'));
}

section('cleanup on an absent directory');
{
    reset();
    const dir = Gio.File.new_for_path(SHOT_DIR);
    try {
        dir.delete(null);
    } catch (e) {
        // leftover subdir from the previous case; good enough
    }
    let threw = null;
    let removed = -1;
    try {
        removed = cleanupScreenshots();
    } catch (e) {
        threw = e;
    }
    check('returns 0 rather than throwing',
        threw === null && removed === 0,
        threw ? threw.message : `removed ${removed}`);
}

finish('screenshot');
