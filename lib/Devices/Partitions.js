/* 
 *  Package: risco-lan-bridge
 *  File: Partitions.js
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


class Partition extends EventEmitter {
    constructor(Id, RiscoComm, Label, PStatus) {
        super();
        this.Id = Id || 1;
        this.RiscoComm = RiscoComm;
        this.Label = Label || '';
        this.PStatus = PStatus || '-----------------' ;
        this.FirstStatus = true;
        this.NeedUpdateConfig = false;

        // a
        this.Alarm = false;
        // D
        this.Duress = false;
        // C
        this.FalseCode = false;
        // F
        this.Fire = false;
        // P
        this.Panic = false;
        // M
        this.Medic = false;
        // N
        this.NoActivity = false;
        // A
        this.Arm = false;
        // H
        this.HomeStay = false;
        // R
        // Ready: In the sense that the partition is capable of being armed
        this.Ready = false;
        // O
        // true if at least 1 zone of the partition is active
        // false if all the zones of the partition are inactive
        this.Open = false;
        // E
        this.Exist = false;
        // S
        this.ResetRequired = false;
        // 1
        this.GrpAArm = false;
        // 2
        this.GRPBArm = false;
        // 3
        this.GrpCArm = false;
        // 4
        this.GRPDArm = false;
        // T
        this.Trouble = false;
        if (this.PStatus !== '-----------------') {
            this.Status = this.PStatus;
        }
    }

    set Status(value) {
        if ((value !== undefined) && (typeof(value) === 'string')){
            let StateArray = Array(
                ['a', 'this.Alarm', 'Alarm', 'StandBy'],
                ['D', 'this.Duress', 'Duress', 'Free'],
                ['C', 'this.FalseCode', 'FalseCode', 'CodeOk'],
                ['F', 'this.Fire', 'Fire', 'NoFire'],
                ['P', 'this.Panic', 'Panic', 'NoPanic'],
                ['M', 'this.Medic', 'Medic', 'NoMedic'],
                ['A', 'this.Arm', 'Armed', 'Disarmed'],
                ['H', 'this.HomeStay', 'HomeStay', 'HomeDisarmed'],
                ['R', 'this.Ready', 'Ready', 'NotReady'],
                ['O', 'this.Open', 'ZoneOpen', 'ZoneClosed'],
                ['E', 'this.Exist', 'Exist', 'NotExist'],
                ['S', 'this.ResetRequired', 'MemoryEvent', 'MemoryAck'],
                ['N', 'this.NoActivity', 'ActivityAlert', 'ActivityOk'],
                ['1', 'this.GrpAArm', 'GrpAArmed', 'GrpADisarmed'],
                ['2', 'this.GrpBArm', 'GrpBArmed', 'GrpBDisarmed'],
                ['3', 'this.GrpCArm', 'GrpCArmed', 'GrpCDisarmed'],
                ['4', 'this.GrpDArm', 'GrpDArmed', 'GrpDDisarmed'],
                ['T', 'this.Trouble', 'Trouble', 'Ok'],
            );
            StateArray.forEach(StateValue => {
                let previousStateValue = eval(StateValue[1]);
                if (value.includes(StateValue[0])) {
                    eval(`${StateValue[1]} = true;`);
                    if (!previousStateValue) {
                        if (!this.FirstStatus) {
                            this.emit(`PStatusChanged`, this.Id, StateValue[2]);
                            this.emit(StateValue[2], this.Id);
                        }
                    }
                } else {
                    eval(`${StateValue[1]} = false;`);
                    if (previousStateValue) {
                        if (!this.FirstStatus) {
                            this.emit(`PStatusChanged`, this.Id, StateValue[3]);
                            this.emit(StateValue[3], this.Id);
                        }
                    }
                }
            });
            this.FirstStatus = false;
        }
    }
}

class PartitionsList extends Array {
    constructor(len, RiscoComm) {
        if (len !== undefined) {
            super(len);

            // Add Arm/Stay/Disarm function to Prototype Partition
            Partition.prototype.AwayArm = function() {
                return new Promise( async (resolve, reject) => {
                    try {
                        this.RiscoComm.logger(this.RiscoComm.log, 'debug', `Request for Full Arming a Partition.`);
                        if (!this.Ready || this.Open) {
                            resolve(false);
                        }
                        if (this.Arm && !this.HomeStay) {
                            resolve(true);
                        } else {
                            let ArmResult = await this.RiscoComm.TCPSocket.GetAckResult(`ARM=${this.Id}`);
                            resolve(ArmResult);
                        }
                    } catch (err) {
                        this.RiscoComm.logger(this.RiscoComm.log, 'error', `Failed to Full Arming the Partition : ${this.Id}`);
                        resolve(false)
                    }
                });
            };
            Partition.prototype.HomeStayArm = function() {
                return new Promise( async (resolve, reject) => {
                    try {
                        this.RiscoComm.logger(this.RiscoComm.log, 'debug', `Request for Stay Arming a Partition.`);
                        if (!this.Ready || this.Open) {
                            resolve(false);
                        }
                        if (this.HomeStay && !this.Arm) {
                            resolve(true);
                        } else {
                            let ArmResult = await this.RiscoComm.TCPSocket.GetAckResult(`STAY=${this.Id}`);
                            resolve(ArmResult);
                        }
                    } catch (err) {
                        this.RiscoComm.logger(this.RiscoComm.log, 'error', `Failed to Stay Arming the Partition : ${this.Id}`);
                        resolve(false)
                    }
                });
            };
            Partition.prototype.Disarm = function() {
                return new Promise( async (resolve, reject) => {
                    try {
                        this.RiscoComm.logger(this.RiscoComm.log, 'debug', `Request for Disarming a Partition.`);
                        if (!this.Arm && !this.HomeStay) {
                            resolve(true);
                        } else {
                            let DisarmResult = await this.RiscoComm.TCPSocket.GetAckResult(`DISARM=${this.Id}`);
                            resolve(DisarmResult);
                        }
                    } catch (err) {
                        this.RiscoComm.logger(this.RiscoComm.log, 'error', `Failed to disarm the Partition : ${this.Id}`);
                        resolve(false);
                    }
                });
            };

            for (let i = 0 ; i < len; i++) {
                this[i] = new Partition(i + 1, RiscoComm);
            }

            // Add event capability
            this.prototype = Array.prototype;
            Object.assign(this.prototype, eventMixin);

            this.forEach(partitions => {
                partitions.on('PStatusChanged', (Id, EventStr) => {
                    this.emit('PStatusChanged', Id, EventStr);
                });
            });
        }
    }

    ById(value) {
        if ((this instanceof PartitionsList) && (value !== undefined)) {
            return this[value - 1];
          }
    }
}

module.exports = {
	Partition:  Partition,
    PartitionsList: PartitionsList
}