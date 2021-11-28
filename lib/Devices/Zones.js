/* 
 *  Package: risco-lan-bridge
 *  File: Zones.js
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

const EventEmitter = require('events');

let eventMixin = require('../constants').eventMixin;

const ZoneTypeStr = require('../constants').ZoneTypeStr;


class Zone extends EventEmitter {
    constructor(Id, RiscoComm, Label, Type, Techno, Partitions, Groups, ZStatus) {
        super();
        this.Id = Id || 0;
        this.RiscoComm = RiscoComm;
        this.Label = Label || `Zone ${this.Id}`;
        this.Type = Type || 0;
        this.TypeStr = ZoneTypeStr[this.Type];
        this.ZTech = Techno ||'N';
        this.Parts = Partitions || 1;
        this.Grps = Groups || 0;
        this.ZStatus = ZStatus || '------------' ;
        this.FirstStatus = true;
        this.NeedUpdateConfig = false;

        // O
        this.Open = false;
        // A
        this.Arm = false;
        // a
        this.Alarm = false;
        // T
        this.Tamper = false;
        // R
        this.Trouble = false;
        // L
        this.Lost = false;
        // B
        this.LowBattery = false;
        // Y
        this.Bypass = false;
        // C
        this.CommTrouble = false;
        // S
        this.SoakTest = false;
        // H
        this.Hours24 = false;
        // N
        this.NotUsed = true;

        if (this.Zstatus !== '------------') {
            this.Status = this.ZStatus;
        }
        this.Techno = this.ZTech;
    }

    set Techno(value) {
        switch(value) {
            case 'E':
                this.ZTech = 'Wired Zone';
                this.NotUsed = false;
                break;
            case 'B' :
            case 'I' :
                this.ZTech = 'Bus Zone';
                this.NotUsed = false;
                break;
            case 'W' :
                this.ZTech = 'Wireless Zone';
                this.NotUsed = false;
                break;
            case 'N':
                this.ZTech = 'None';
                this.NotUsed = true;
                this.emit(`ZStatusChanged`, this.Id, 'ZoneNotUsed');
                this.emit('ZoneNotUsed', this.Id);
                break;
        }
        if ((this.FirstStatus) && (!this.NotUsed)) {
            this.emit(`ZStatusChanged`, this.Id, 'ZoneUsed');
            this.emit('ZoneUsed', this.Id);
        }
    }

    get Techno() {
        return this.ZTech;
    }

    set Partitions(value) {
        this.Parts = [];
        if (value.length === 1) {
            var letter = parseInt(value, 16);
            if (letter & 1) {
                this.Parts.push(1);
            }
            if (letter & 2) {
                this.Parts.push(2);
            }
            if (letter & 4) {
                this.Parts.push(3);
            }
            if (letter & 8) {
                this.Parts.push(4);
            }
        } else {
            //ProsysPlus/GTPlus
            for (var i = 0; i < value.length; i++) {
                var letter = parseInt(value.charAt(i), 16);
                if (letter & 1) {
                    this.Parts.push((i *4 ) + 1);
                }
                if (letter & 2) {
                    this.Parts.push((i *4 ) + 2);
                }
                if (letter & 4) {
                    this.Parts.push((i *4 ) + 3);
                }
                if (letter & 8) {
                    this.Parts.push((i *4 ) + 4);
                }
              }
        }
    }

    get Partitions() {
        return this.Parts;
    }

    set Groups(value) {
        let Grpsval = parseInt(value, 16);
        this.Grps = [];
        if (Grpsval & 1) {
            this.Grps.push('A');
        }
        if (Grpsval & 2) {
            this.Grps.push('B');
        }
        if (Grpsval & 4) {
            this.Grps.push('C');
        }
        if (Grpsval & 8) {
            this.Grps.push('D');
        }
    }

    get Groups() {
        return this.Grps;
    }

    set Status(value) {
        if ((value !== undefined) && (typeof(value) === 'string')){
            let StateArray = Array(
                ['O', 'this.Open', 'Open', 'Closed'],
                ['A', 'this.Arm', 'Armed', 'Disarmed'],
                ['a', 'this.Alarm', 'Alarm', 'StandBy'],
                ['T', 'this.Tamper', 'Tamper', 'Hold'],
                ['R', 'this.Trouble', 'Trouble', 'Sureness'],
                ['L', 'this.Lost', 'Lost', 'Located'],
                ['B', 'this.LowBattery', 'LowBattery', 'BatteryOk'],
                ['Y', 'this.Bypass', 'Bypassed', 'UnBypassed'],
                ['C', 'this.CommTrouble', 'CommTrouble', 'CommOk'],
                ['S', 'this.SoakTest', 'SoakTest', 'ExitSoakTest'],
                ['H', 'this.Hours24', '24HoursZone', 'NormalZone'],
                // Removal of NotUsed from the logic because otherwise its value 
                // is never correctly defined (does not always appear in the status value).
                // ['N', 'this.NotUsed', 'ZoneNotUsed', 'ZoneUsed']
            );
            
            StateArray.forEach(StateValue => {
                let previousStateValue = eval(StateValue[1]);
                if (value.includes(StateValue[0])) {
                    eval(`${StateValue[1]} = true;`);
                    if (!previousStateValue) {
                        if (!this.FirstStatus) {
                            this.emit(`ZStatusChanged`, this.Id, StateValue[2]);
                            this.emit(StateValue[2], this.Id);
                        }
                    }
                } else {
                    eval(`${StateValue[1]} = false;`);
                    if (previousStateValue) {
                        if (!this.FirstStatus) {
                            this.emit(`ZStatusChanged`, this.Id, StateValue[3]);
                            this.emit(StateValue[3], this.Id);
                        }
                    }
                }
            });

            this.FirstStatus = false;
        }
    }

}

class ZoneList extends Array {
    constructor(len, RiscoComm) {
        if (len !== undefined) {
            super(len);

            // Add Bypass/UnBypass function to zone Prototype
            // In this context, this = Zone Object
            Zone.prototype.ToggleBypass = function() {
                return new Promise( async (resolve, reject) => {
                    try {
                        this.RiscoComm.logger(this.RiscoComm.log, 'debug', `Request for Bypassing/UnBypassing a Zone.`);
                        let BypassResult = await this.RiscoComm.TCPSocket.GetAckResult(`ZBYPAS=${this.Id}`);
        
                        resolve(BypassResult);
                    } catch (err) {
                        this.RiscoComm.logger(this.RiscoComm.log, 'error', `Failed to Bypass/UnBypass Zone : ${this.Id}`);
                        resolve(false);
                    }
                });
            };

            for (let i = 0 ; i < len; i++) {
                this[i] = new Zone(i + 1, RiscoComm);
            }

            // Add event capability
            this.prototype = Array.prototype;
            Object.assign(this.prototype, eventMixin);

            this.forEach(zone => {
                zone.on('ZStatusChanged', (Id, EventStr) => {
                    this.emit('ZStatusChanged', Id, EventStr);
                });
            });
        }
    }

    ById(value) {
        if ((this instanceof ZoneList) && (value !== undefined)) {
            return this[value - 1];
          }
    }
}

module.exports = {
	Zone:  Zone,
    ZoneList: ZoneList
}