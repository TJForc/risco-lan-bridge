/* 
 *  Package: risco-lan-bridge
 *  File: constants.js
 *  
 *  MIT License
 *  
 *  Copyright (c) 2021 TJForc
 *  
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the "Software"), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *  
 *  The above copyright notice and this permission notice shall be included in all
 *  copies or substantial portions of the Software.
 *  
 *  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 *  SOFTWARE.
 */

'use strict';

// Array of 256 value for CRC Data
const CRCArray_base64 = 'WzAsNDkzNDUsNDk1MzcsMzIwLDQ5OTIxLDk2MCw2NDAsNDk3MjksNTA2ODksMTcyOCwxOTIwLDUxMDA5LDEyODAsNTA2MjUsNTAzMDUsMTA4OCw1MjIyNSwzMjY0LDM0NTYsNTI1NDUsMzg0MCw1MzE4NSw1Mjg2NSwzNjQ4LDI1NjAsNTE5MDUsNTIwOTcsMjg4MCw1MTQ1NywyNDk2LDIxNzYsNTEyNjUsNTUyOTcsNjMzNiw2NTI4LDU1NjE3LDY5MTIsNTYyNTcsNTU5MzcsNjcyMCw3NjgwLDU3MDI1LDU3MjE3LDgwMDAsNTY1NzcsNzYxNiw3Mjk2LDU2Mzg1LDUxMjAsNTQ0NjUsNTQ2NTcsNTQ0MCw1NTA0MSw2MDgwLDU3NjAsNTQ4NDksNTM3NjEsNDgwMCw0OTkyLDU0MDgxLDQzNTIsNTM2OTcsNTMzNzcsNDE2MCw2MTQ0MSwxMjQ4MCwxMjY3Miw2MTc2MSwxMzA1Niw2MjQwMSw2MjA4MSwxMjg2NCwxMzgyNCw2MzE2OSw2MzM2MSwxNDE0NCw2MjcyMSwxMzc2MCwxMzQ0MCw2MjUyOSwxNTM2MCw2NDcwNSw2NDg5NywxNTY4MCw2NTI4MSwxNjMyMCwxNjAwMCw2NTA4OSw2NDAwMSwxNTA0MCwxNTIzMiw2NDMyMSwxNDU5Miw2MzkzNyw2MzYxNywxNDQwMCwxMDI0MCw1OTU4NSw1OTc3NywxMDU2MCw2MDE2MSwxMTIwMCwxMDg4MCw1OTk2OSw2MDkyOSwxMTk2OCwxMjE2MCw2MTI0OSwxMTUyMCw2MDg2NSw2MDU0NSwxMTMyOCw1ODM2OSw5NDA4LDk2MDAsNTg2ODksOTk4NCw1OTMyOSw1OTAwOSw5NzkyLDg3MDQsNTgwNDksNTgyNDEsOTAyNCw1NzYwMSw4NjQwLDgzMjAsNTc0MDksNDA5NjEsMjQ3NjgsMjQ5NjAsNDEyODEsMjUzNDQsNDE5MjEsNDE2MDEsMjUxNTIsMjYxMTIsNDI2ODksNDI4ODEsMjY0MzIsNDIyNDEsMjYwNDgsMjU3MjgsNDIwNDksMjc2NDgsNDQyMjUsNDQ0MTcsMjc5NjgsNDQ4MDEsMjg2MDgsMjgyODgsNDQ2MDksNDM1MjEsMjczMjgsMjc1MjAsNDM4NDEsMjY4ODAsNDM0NTcsNDMxMzcsMjY2ODgsMzA3MjAsNDcyOTcsNDc0ODksMzEwNDAsNDc4NzMsMzE2ODAsMzEzNjAsNDc2ODEsNDg2NDEsMzI0NDgsMzI2NDAsNDg5NjEsMzIwMDAsNDg1NzcsNDgyNTcsMzE4MDgsNDYwODEsMjk4ODgsMzAwODAsNDY0MDEsMzA0NjQsNDcwNDEsNDY3MjEsMzAyNzIsMjkxODQsNDU3NjEsNDU5NTMsMjk1MDQsNDUzMTMsMjkxMjAsMjg4MDAsNDUxMjEsMjA0ODAsMzcwNTcsMzcyNDksMjA4MDAsMzc2MzMsMjE0NDAsMjExMjAsMzc0NDEsMzg0MDEsMjIyMDgsMjI0MDAsMzg3MjEsMjE3NjAsMzgzMzcsMzgwMTcsMjE1NjgsMzk5MzcsMjM3NDQsMjM5MzYsNDAyNTcsMjQzMjAsNDA4OTcsNDA1NzcsMjQxMjgsMjMwNDAsMzk2MTcsMzk4MDksMjMzNjAsMzkxNjksMjI5NzYsMjI2NTYsMzg5NzcsMzQ4MTcsMTg2MjQsMTg4MTYsMzUxMzcsMTkyMDAsMzU3NzcsMzU0NTcsMTkwMDgsMTk5NjgsMzY1NDUsMzY3MzcsMjAyODgsMzYwOTcsMTk5MDQsMTk1ODQsMzU5MDUsMTc0MDgsMzM5ODUsMzQxNzcsMTc3MjgsMzQ1NjEsMTgzNjgsMTgwNDgsMzQzNjksMzMyODEsMTcwODgsMTcyODAsMzM2MDEsMTY2NDAsMzMyMTcsMzI4OTcsMTY0NDhd';

// Type of Panel
const PanelType = Object.freeze({
    'RW132':1,
    'RW232':2,
    'RW332':3,
    'RP432':4,
    'RP512':5
});

const Log_Level = Object.freeze({
    'ERROR': 'error',
    'WARN': 'warn',
    'INFO': 'info',
    'VERBOSE': 'verbose',
    'DEBUG': 'debug'
});

const ZoneTypeStr = Object.freeze({
    0: 'Not Used',
    1: 'Exit/Entry 1',
    2: 'Exit/Entry 2',
    3: 'Exit Open/Entry 1',
    4: 'Entry Follower',
    5: 'Instant',
    6: 'Internal + Exit/Entry 1',
    7: 'Internal + Exit/Entry 2',
    8: 'Internal + Exit Open/Entry 1',
    9: 'Internal + Entry Follower',
    10: 'Internal + Instant',
    11: 'UO Trigger',
    12: 'Day',
    13: '24 Hour',
    14: 'Fire',
    15: 'Panic',
    16: 'Special',
    17: 'Pulsed Key-Switch',
    18: 'Final Exit',
    19: 'Latched Key-Switch',
    20: 'Entry Follower + Stay',
    21: 'Pulsed Key-Switch Delayed',
    22: 'Latched Key-Switch Delayed',
    23: 'Tamper',
    24: 'Technical',
    25: 'Exit Open/Entry 2',
    26: 'Internal + Exit Open/Entry 2',
    27: 'Water',
    28: 'Gas',
    29: 'CO',
    30: 'Exit Terminator',
    31: 'High Temperature',
    32: 'Low Temperature',
    33: 'Key Box',
    34: 'Keyswitch Arm',
    35: 'Keyswitch Delayed Arm'
});

const ZoneTypeEnum = Object.freeze({
    NOTUSED: 0,
    EXITENTRY1: 1,
    EXITENTRY2: 2,
    EXITOPENENTRY1: 3,
    EXITOPENENTRY2: 25,
    ENTRYFOLLOWER: 4,
    INSTANT: 5,
    INTERNALEXITENTRY1: 6,
    INTERNALEXITENTRY2: 7,
    INTERNALEXITOPENENTRY1: 8,
    INTERNALEXITOPENENTRY2: 26,
    INTERNALENTRYFOLLOWER: 9,
    INTERNALINSTANT: 10,
    UOTRIGGER: 11,
    DAY: 12,
    HOUR24: 13,
    FIRE: 14,
    PANIC: 15,
    SPECIAL: 16,
    PULSEDKEYSWITCH: 17,
    FINALEXIT: 18,
    LATCHEDKEYSWITCH: 19,
    ENTRYFOLLOWERSTAY: 20,
    PULSEDKEYSWITCHDELAYED: 21,
    LATCHEDKEYSWITCHDELAYED: 22,
    TAMPER: 23,
    TECHNICAL: 24,
    WATER: 27,
    GAS: 28,
    CO: 29,
    EXITTERMINATOR: 30,
    HIGHTEMPERATURE: 31,
    LOWTEMPERATURE: 32,
    KEYBOX: 33,
    KEYSWITCHARM: 34,
    KEYSWITCHDELAYEDARM: 35
});

const TimeZoneStr = Object.freeze({
    0: '-12:00',
    1: '-11:00',
    2: '-10:00',
    3: '-09:00',
    4: '-08:00',
    5: '-07:00',
    6: '-06:00',
    7: '-05:00',
    8: '-04:30',
    9: '-04:00',
    10: '-03:30',
    11: '-03:00',
    12: '-02:00',
    13: '-01:00',
    14: '+00:00',
    15: '+01:00',
    16: '+02:00',
    17: '+03:00',
    18: '+03:30',
    19: '+04:00',
    20: '+04:30',
    21: '+05:00',
    22: '+05:30',
    23: '+05:45',
    24: '+06:00',
    25: '+06:30',
    26: '+07:00',
    27: '+08:00',
    28: '+09:00',
    29: '+09:30',
    30: '+10:00',
    31: '+11:00',
    32: '+12:00',
    33: '+13:00'
});

const RiscoError = Object.freeze({
    BCK2: 'Callback Error',
    N01: 'Error',
    N02: 'Unknow Error N02',
    N03: 'Unknow Error N03',
    N04: 'CRC Error',
    N05: 'Invalid parameter',
    N06: 'Invalid Value',
    N07: 'System Armed',
    N08: 'System Alarm',
    N09: 'Default Jumper',
    N10: 'System Not In Prog Mode',
    N11: 'System In Prog Mode',
    N12: 'System Not Ready to Arm',
    N13: 'General Error',
    N14: 'Device Does Not Support This Operation',
    N15: 'MS Locked',
    N16: 'System Busy',
    N17: 'Pin Code In Use',
    N18: 'System In RF Allocation Mode',
    N19: 'Device Doesn\'t Exists',
    N20: 'TEOL Termination Not Supported',
    N21: 'Unknow Error N21',
    N22: 'Unknow Error N22',
    N23: 'Unknow Error N23',
    N24: 'System in Remote Upgrade',
    N25: 'CW Test Failed'
});

// Mixin Object for adding event handling to classes derived from Array Object
let eventMixin = {
    /**
     * Subscribe to event, usage:
     *  menu.on('select', function(item) { ... }
    */
    on(eventName, handler) {
        if (!this._eventHandlers) this._eventHandlers = {};
            if (!this._eventHandlers[eventName]) {
                this._eventHandlers[eventName] = [];
            }
        this._eventHandlers[eventName].push(handler);
    },

    /**
     * Cancel the subscription, usage:
     *  menu.off('select', handler)
     */
    off(eventName, handler) {
        let handlers = this._eventHandlers[eventName];
        if (!handlers) return;
            for (let i = 0; i < handlers.length; i++) {
            if (handlers[i] === handler) {
                handlers.splice(i--, 1);
            }
        }
    },

    /**
     * Generate an event with the given name and data
     *  this.trigger('select', data1, data2);
     */
    emit(eventName, ...args) {
        if ((this._eventHandlers === undefined) || (!this._eventHandlers[eventName])) {
            return; // no handlers for that event name
        }

        // call the handlers
        this._eventHandlers[eventName].forEach(handler => handler.apply(this, args));
    }
};

module.exports = Object.freeze({
    PanelType: PanelType,
    Log_Level: Log_Level,
    CRCArray_base64: CRCArray_base64,
    eventMixin: eventMixin,
    ZoneTypeStr: ZoneTypeStr,
    ZoneTypeEnum: ZoneTypeEnum,
    TimeZoneStr: TimeZoneStr,
    RiscoError: RiscoError
});