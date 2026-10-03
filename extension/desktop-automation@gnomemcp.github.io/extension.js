import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { DbusService, INTERFACE_XML } from './dbus.js';
import { AutomationIndicator } from './indicator.js';
import { showConsentDialog } from './consent.js';

const OBJECT_PATH = '/io/github/gnomemcp/DesktopAutomation';

export default class DesktopAutomationExtension extends Extension {
    enable() {
        this._settings = this.getSettings(
            'org.gnome.shell.extensions.desktop-automation');

        this._service = new DbusService();
        this._dbus = Gio.DBusExportedObject.wrapJSObject(
            INTERFACE_XML, this._service);
        this._dbus.export(Gio.DBus.session, OBJECT_PATH);

        this._indicator = new AutomationIndicator(this._service);
        Main.panel.addToStatusArea('desktop-automation', this._indicator);

        // Show consent dialog on first enable
        if (!this._settings.get_boolean('consent-acknowledged')) {
            showConsentDialog(
                () => {
                    this._settings.set_boolean('consent-acknowledged', true);
                },
                () => {
                    // User cancelled — they can re-enable from Extensions app
                }
            );
        }

        console.log('[DesktopAutomation] Extension enabled');
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        if (this._dbus) {
            this._dbus.unexport();
            this._dbus = null;
        }
        if (this._service) {
            this._service.destroy();
            this._service = null;
        }
        this._settings = null;
        console.log('[DesktopAutomation] Extension disabled');
    }
}
