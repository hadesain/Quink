/**
 * Quink, Copyright (c) 2013-2014 IMD - International Institute for Management Development, Switzerland.
 *
 * This file is part of Quink.
 * 
 * Quink is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Quink is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Quink.  If not, see <http://www.gnu.org/licenses/>.
 */

define([
    'jquery',
    'Underscore',
    'util/PubSub',
    'keyhandler/InsertKeyHandler',
    'keyhandler/CommandKeyHandler',
    'hithandler/HitHandler'
], function ($, _, PubSub, InsertKeyHandler, CommandKeyHandler, HitHandler) {
    'use strict';

    var KeyHandlerMgr = function () {
        this.insertKeyHandler = null;
        this.commandKeyHandler = null;
        this.keyHandler = null;
        PubSub.subscribe('plugin.open', _.bind(this.onPluginOpen, this));
        PubSub.subscribe('plugin.saved', _.bind(this.onPluginClose, this));
        PubSub.subscribe('plugin.exited', _.bind(this.onPluginClose, this));
    };

    KeyHandlerMgr.prototype.init = function (selector) {
        this.editable = $(selector);
        this.insertKeyHandler = new InsertKeyHandler(selector, this);
        this.commandKeyHandler = new CommandKeyHandler(selector, this);
        this.keyHandler = this.insertKeyHandler;
        this.keyHandler.start();
    };

    KeyHandlerMgr.prototype.switchMode = function () {
        this.keyHandler =
            this.keyHandler === this.insertKeyHandler ? this.commandKeyHandler : this.insertKeyHandler;
        this.keyHandler.start();
        PubSub.publish('keyhandler.mode.command', this.isCommandMode());
    };

    KeyHandlerMgr.prototype.isCommandMode = function () {
        return this.keyHandler === this.commandKeyHandler;
    };

    KeyHandlerMgr.prototype.onPluginOpen = function () {
        this.keyHandler.stop();
    };

    KeyHandlerMgr.prototype.onPluginClose = function () {
        this.keyHandler.start();
    };

    var insertKeyBindings;

    /**
     * Fetches the keymaps from the given url and loads them into the command key handler.
     * Publishes the mode switch key and adds it to the COMMAND_MAP to ensure that the key used
     * to enter command mode is also used to leave command mode.
     */
    function fetchCommandMap(url) {
        $.getJSON(url).done(function (data) {
            var msk;
            $.each(data, function (mapName, map) {
                if (mapName === 'mode-switch-key') {
                    msk = map;
                } else {
                    CommandKeyHandler.prototype[mapName] = map;
                }
            });
            CommandKeyHandler.prototype.COMMAND_MAP[msk] = 'exit';
            InsertKeyHandler.prototype.MODE_SWITCH_KEY_CODE = parseInt(msk, 10);
            if (insertKeyBindings) {
                onInsertKeybindings(insertKeyBindings);
                insertKeyBindings = null;
            }
            CommandKeyHandler.prototype.map = CommandKeyHandler.prototype.COMMAND_MAP;
            console.log('keymap downloaded');
        }).fail(function (jqxhr, textStatus, error) {
            console.log('Failed to fetch keymap from: ' + url + '. ' + jqxhr.status + '. ' + error);
        });
    }

    /**
     * If this publication arrives before the key maps are initialised, save the keybindings
     * and process them when the maps have downloaded.
     */
    function onInsertKeybindings(keyBindings) {
        var map = CommandKeyHandler.prototype.INSERT_MAP;
        if (map) {
            keyBindings.forEach(function (key) {
                map[key] = 'insert.' + key;
            });
        } else {
            insertKeyBindings = keyBindings;
        }
    }

    function initSubscriptions() {
        PubSub.subscribe('plugin.insert.keybindings', onInsertKeybindings);
    }

    var managers = [];

    function getActiveMgr() {
        var editable = HitHandler.getCurrentEditable();
        return _.find(managers, function (mgr) {
            return mgr.editable[0] === editable;
        });
    }

    function isCommandMode() {
        var mgr = getActiveMgr();
        return mgr ? mgr.isCommandMode() : false;
    }

    function create(selector) {
        $(selector).each(function () {
            var mgr = new KeyHandlerMgr();
            mgr.init(this);
            managers.push(mgr);
        });
    }

    function init(selector, keyMapUrl) {
        initSubscriptions();
        fetchCommandMap(keyMapUrl);
        create(selector);
    }

    return {
        init: init,
        isCommandMode: isCommandMode
    };
});
