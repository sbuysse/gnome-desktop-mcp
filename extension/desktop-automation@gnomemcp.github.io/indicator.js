import GObject from 'gi://GObject';
import St from 'gi://St';
import GLib from 'gi://GLib';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

export const AutomationIndicator = GObject.registerClass(
class AutomationIndicator extends PanelMenu.Button {
    _init(service) {
        super._init(0.0, 'Desktop Automation');
        this._service = service;
        this._activityTimerId = null;
        this._flashTimerId = null;
        this._hasFlashed = false;

        this._icon = new St.Icon({
            icon_name: 'preferences-desktop-remote-desktop-symbolic',
            style_class: 'system-status-icon desktop-automation-indicator idle',
        });
        this.add_child(this._icon);

        // Status
        this._statusItem = new PopupMenu.PopupMenuItem('Status: Idle', { reactive: false });
        this.menu.addMenuItem(this._statusItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Toggle
        this._toggleItem = new PopupMenu.PopupSwitchMenuItem('Allow Automation', false);
        this._toggleItem.connect('toggled', (_item, state) => {
            this._service.enabled = state;
            this._hasFlashed = false;
            this._updateStatus();
        });
        this.menu.addMenuItem(this._toggleItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Activity log
        this._logHeader = new PopupMenu.PopupMenuItem('Recent Activity', { reactive: false });
        this.menu.addMenuItem(this._logHeader);

        this._logItems = [];
        for (let i = 0; i < 5; i++) {
            const item = new PopupMenu.PopupMenuItem('  --', { reactive: false });
            item.label.style = 'font-size: 0.85em; color: #888;';
            this.menu.addMenuItem(item);
            this._logItems.push(item);
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Disconnect
        const disconnectItem = new PopupMenu.PopupMenuItem('Disconnect');
        disconnectItem.connect('activate', () => {
            this._service.enabled = false;
            this._toggleItem.setToggleState(false);
            this._hasFlashed = false;
            this._updateStatus();
        });
        this.menu.addMenuItem(disconnectItem);

        this._service.onActivity = this._onActivity.bind(this);
    }

    _onActivity(_entry) {
        if (this._activityTimerId) {
            GLib.source_remove(this._activityTimerId);
            this._activityTimerId = null;
        }

        // Flash on first connection
        if (!this._hasFlashed && this._service.enabled) {
            this._hasFlashed = true;
            this._icon.add_style_class_name('flash');
            if (this._flashTimerId)
                GLib.source_remove(this._flashTimerId);
            this._flashTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
                this._icon.remove_style_class_name('flash');
                this._flashTimerId = null;
                return GLib.SOURCE_REMOVE;
            });
        }

        this._icon.remove_style_class_name('idle');
        this._icon.add_style_class_name('active');
        this._statusItem.label.text = 'Status: Connected';

        // Update log
        const log = this._service.activityLog;
        const recent = log.slice(-5).reverse();
        for (let i = 0; i < 5; i++) {
            if (i < recent.length) {
                const time = recent[i].timestamp.split('T')[1]?.split('.')[0] || '';
                this._logItems[i].label.text = `  ${time} — ${recent[i].method}`;
            } else {
                this._logItems[i].label.text = '  --';
            }
        }

        // Go idle after 5s
        this._activityTimerId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT, 5, () => {
                this._icon.remove_style_class_name('active');
                this._icon.add_style_class_name('idle');
                this._statusItem.label.text = 'Status: Idle';
                this._activityTimerId = null;
                return GLib.SOURCE_REMOVE;
            });
    }

    _updateStatus() {
        if (this._service.enabled) {
            this._statusItem.label.text = 'Status: Enabled (waiting)';
        } else {
            this._icon.remove_style_class_name('active');
            this._icon.add_style_class_name('idle');
            this._statusItem.label.text = 'Status: Disabled';
        }
    }

    destroy() {
        if (this._activityTimerId) {
            GLib.source_remove(this._activityTimerId);
            this._activityTimerId = null;
        }
        if (this._flashTimerId) {
            GLib.source_remove(this._flashTimerId);
            this._flashTimerId = null;
        }
        super.destroy();
    }
});
