/* 
 *  Package: risco-lan-bridge
 *  File: Outputs.js
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

class Output extends EventEmitter {
    constructor(Id, Label, Type, OStatus) {
        super();
        this.Id = Id || 0;
        this.Label = Label || new String;
        
        this.Type = Type;
        this.OStatus = OStatus || '--' ;
        this.Pulsed = false;
        this.FirstStatus = true;

        // a
        this.Active = false;

        if (this.Ostatus !== '--') {
            this.Status = this.OStatus;
        }

    }
    /*
     * value can be :
     * Pulse NC = 0
     * Latch NC = 1
     * Pulse NO = 2
     * Latch NO = 3
     */
    set Type(value) {
        this.Pulsed = ((value%2 == 0) ? true : false);
    }

    get Type() {
        return ((this.Pulsed) ? 'Pulse' : 'Latch');
    }

    set Status(value) {
        if ((value !== undefined) && (typeof(value) === 'string')){
            let StateArray = Array(
                ['a', 'this.Active', 'Actived', 'Deactived', 'Pulsed']
            );
            
            StateArray.forEach(StateValue => {
                if (value.includes(StateValue[0])) {
                    if (!(eval(StateValue[1]))) {
                        this.emit(`OStatusChanged`, this.Id, StateValue[2]);
                        (this.Pulsed) ? this.emit(StateValue[3], this.Id) : this.emit(StateValue[2], this.Id);
                    }
                    eval(`${StateValue[1]} = true;`);
                } else {
                    if (eval(StateValue[1])) {
                        this.emit(`OStatusChanged`, this.Id, StateValue[3]);
                        if (!this.Pulsed) { this.emit(StateValue[3], this.Id); }
                    }
                    eval(`${StateValue[1]} = false;`);
                }
            });
            this.FirstStatus = false;
        }
    }

}

class OutputList extends Array {
    constructor(len) {
        if (len !== undefined) {
            super(len);
            for (let i = 0 ; i < len; i++) {
                this[i] = new Output(i + 1);
            }
            // Add event capability
            this.prototype = Array.prototype;
            Object.assign(this.prototype, eventMixin);

            this.forEach(output => {
                output.on('OStatusChanged', (Id, EventStr) => {
                    this.emit('OStatusChanged', Id, EventStr);
                });
            });
        }
    }

    ById(value) {
        if ((this instanceof OutputList) && (value !== undefined)) {
            return this[value - 1];
          }
    }
}

module.exports = {
	Output:  Output,
    OutputList: OutputList
}