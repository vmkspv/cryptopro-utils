import GLib from 'gi://GLib';
import St from 'gi://St';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const CommandMenuPopup = GObject.registerClass(
    class CommandMenuPopup extends PanelMenu.Button {
        _init(ext) {
            super._init(0.5);
            ext.redrawMenu(this);
        }
    }
);

export default class CommandMenuExtension extends Extension {
    commandMenuPopup = null;
    commands = {};

    populateMenuItems = async (menu, cmds, level = 0) => {
        for (const cmd of cmds) {
            if (cmd.type === 'separator') {
                menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            } else if (cmd.title) {
                if (cmd.type === 'submenu' && level === 0 && cmd.submenu) {
                    const wantIcon = Boolean(cmd.icon);
                    const submenu = new PopupMenu.PopupSubMenuMenuItem(cmd.title, wantIcon);
                    if (wantIcon) {
                        submenu.icon.icon_name = cmd.icon;
                    }
                    await this.populateMenuItems(submenu.menu, cmd.submenu, level + 1);
                    menu.addMenuItem(submenu);
                } else if (cmd.command) {
                    const item = cmd.icon ?
                        new PopupMenu.PopupImageMenuItem(cmd.title, cmd.icon) :
                        new PopupMenu.PopupMenuItem(cmd.title);
                    item.connect('activate', () => GLib.spawn_command_line_async(cmd.command));
                    menu.addMenuItem(item);
                }
            }
        }
    };

    redrawMenu = (popUpMenu) => {
        popUpMenu.menu.removeAll();
        const menuTitle = this.commands.title || '';
        const box = new St.BoxLayout();
        const icon = new St.Icon({
            icon_name: this.commands.icon || 'application-certificate-symbolic',
            style_class: 'system-status-icon'
        });
        if (this.commands.showIcon !== false || !menuTitle) {
            box.add_child(icon);
        }
        const label = new St.Label({ text: menuTitle, y_expand: true, y_align: Clutter.ActorAlign.CENTER });
        box.add_child(label);
        popUpMenu.add_child(box);

        if (Array.isArray(this.commands.menu) && this.commands.menu.length > 0) {
            this.populateMenuItems(popUpMenu.menu, this.commands.menu);
        } else {
            popUpMenu.menu.addMenuItem(new PopupMenu.PopupMenuItem('Нет доступных команд'));
        }
    };

    loadConfiguration = async () => {
        const filePath = "/cryptopro-utils@vmkspv.github.com/actions.json";
        const file = Gio.File.new_for_path(GLib.get_home_dir() + "/.local/share/gnome-shell/extensions" + filePath);
        try {
            const [ok, contents] = await new Promise((resolve, reject) => {
                file.load_contents_async(null, (obj, res) => {
                    try {
                        resolve(file.load_contents_finish(res));
                    } catch (e) {
                        reject(e);
                    }
                });
            });
            if (ok) {
                const textDecoder = new TextDecoder('utf-8');
                const jsonContent = JSON.parse(textDecoder.decode(contents));
                this.commands = Array.isArray(jsonContent) ? { menu: jsonContent } : jsonContent;
            } else {
                this.commands = { menu: [] };
            }
        } catch {
            this.commands = { menu: [] };
        }
    };

    addCommandMenu = async () => {
        await this.loadConfiguration();
        this.commandMenuPopup = new CommandMenuPopup(this);
        Main.panel.addToStatusArea('commandMenuPopup', this.commandMenuPopup, 1);
    };

    enable = () => {
        this.addCommandMenu();
    };

    disable = () => {
        if (this.commandMenuPopup) {
            this.commandMenuPopup.destroy();
            this.commandMenuPopup = null;
        }
        this.commands = {};
    };
}
