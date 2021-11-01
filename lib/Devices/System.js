/* 
 *  Package: risco-lan-bridge
 *  File: System.js
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

//const TimeZoneStr = require('../constants').TimeZoneStr;

class MBSystem extends EventEmitter {
    constructor(Label, SStatus) {
        super();
        this.Label = Label || '';
        this.SStatus = SStatus || '---------------------' ;
        this.NeedUpdateConfig = false;

        // B
        this.LowBatteryTrouble = false;
        // A
        this.ACTrouble = false;
        // P
        this.PhoneLineTrouble = false;
        // C
        this.ClockTrouble = false;
        // D
        this.DefaultSwitch = false;
        // 1
        this.MS1ReportTrouble = false;
        // 2
        this.MS2ReportTrouble = false;
        // 3
        this.MS3ReportTrouble = false;
        // X
        this.BoxTamper = false;
        // J
        this.JammingTrouble = false;
        // I
        this.ProgMode = false;
        // L
        this.LearnMode = false;
        // M
        this.ThreeMinBypass = false;
        // W
        this.WalkTest = false;
        // U
        this.AuxTrouble = false;
        // R
        this.Rs485BusTrouble = false;
        // S
        this.LsSwitch = false;
        // F
        this.BellSwitch = false;
        // E
        this.BellTrouble = false;
        // Y
        this.BellTamper = false;
        // V
        this.ServiceExpired = false;
        // T
        this.PaymentExpired = false;
        // Z
        this.ServiceMode = false;
        // Q
        this.DualPath = false;

        if (this.SStatus !== '---------------------') {
            this.Status = this.SStatus;
        }
        this.FirstStatus = true;
    }

    set Status(value) {
        if ((value !== undefined) && (typeof(value) === 'string')){
            let StateArray = Array(
                ['B', 'this.LowBatteryTrouble', 'LowBattery', 'BatteryOk'],
                ['A', 'this.ACTrouble', 'ACUnplugged', 'ACPlugged'],
                ['P', 'this.PhoneLineTrouble', 'PhoneLineTrouble', 'PhoneLineOk'],
                ['C', 'this.ClockTrouble', 'ClockTrouble', 'ClockOk'],
                ['D', 'this.DefaultSwitch', 'DefaultSwitchOn', 'DefaultSwitchOff'],
                ['1', 'this.MS1ReportTrouble', 'MS1ReportTrouble', 'MS1ReportOk'],
                ['2', 'this.MS2ReportTrouble', 'MS2ReportTrouble', 'MS2ReportOk'],
                ['3', 'this.MS3ReportTrouble', 'MS3reportTrouble', 'MS3ReportOk'],
                ['X', 'this.BoxTamper', 'BoxTamperOpen', 'BoxTamperClosed'],
                ['J', 'this.JammingTrouble', 'JammingTrouble', 'JammingOk'],
                ['I', 'this.ProgMode', 'ProgModeOn', 'ProgModeOff'],
                ['L', 'this.LearnMode', 'LearnModeOn', 'LearnModeOff'],
                ['M', 'this.ThreeMinBypass', 'ThreeMinBypassOn', 'ThreeMinBypassOff'],
                ['W', 'this.WalkTest', 'WalkTestOn', 'WalkTestOff'],
                ['U', 'this.AuxTrouble', 'AuxTrouble', 'AuxOk'],
                ['R', 'this.Rs485BusTrouble', 'Rs485BusTrouble', 'Rs485BusOk'],
                ['S', 'this.LsSwitch', 'LsSwitchOn', 'LsSwitchOff'],
                ['F', 'this.BellSwitch', 'BellSwitchOn', 'BellSwitchOff'],
                ['E', 'this.BellTrouble', 'BellTrouble', 'BellOk'],
                ['Y', 'this.BellTamper', 'BellTamper', 'BellTamperOk'],
                ['V', 'this.ServiceExpired', 'ServiceExpired', 'ServiceOk'],
                ['T', 'this.PaymentExpired', 'PaymentExpired', 'PaymentOk'],
                ['Z', 'this.ServiceMode', 'ServiceModeOn', 'ServiceModeOff'],
                ['Q', 'this.DualPath', 'DualPathOn', 'DualPathOff']
            );

            StateArray.forEach(StateValue => {
                let previousStateValue = eval(StateValue[1]);
                if (value.includes(StateValue[0])) {
                    eval(`${StateValue[1]} = true;`);
                    if (!previousStateValue) {
                        if (!this.FirstStatus) {
                            this.emit(`SStatusChanged`, StateValue[2]);
                            this.emit(StateValue[2]);
                        }
                    }
                } else {
                    eval(`${StateValue[1]} = false;`);
                    if (previousStateValue) {
                        if (!this.FirstStatus) {
                            this.emit(`SStatusChanged`, StateValue[3]);
                            this.emit(StateValue[3]);
                        }
                    }
                }
            });
            this.FirstStatus = false;
        }
    }
}

module.exports = {
	MBSystem:  MBSystem
}