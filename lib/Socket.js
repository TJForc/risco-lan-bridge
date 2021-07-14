/* 
 *  Package: risco-lan-bridge
 *  File: Socket.js
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

const Socket = require('net').Socket;
const EventEmitter = require('events').EventEmitter;
const Risco_ErrorCode = require('./constants').RiscoError;
const Log_Level = require('./constants').Log_Level;

class Risco_Socket extends EventEmitter {

    constructor(Panel_Ip, Panel_Port, RCrypt, Encoding, Password, DiscoverCode, logger, log) {
        super();
        this.Host = Panel_Ip;
        this.Port = Panel_Port;
        this.RCrypt = RCrypt;
        this.Password = Password;
        this.DiscoverCode = DiscoverCode || false;
        this.logger = logger;
        this.log = log;

        this.Encoding = Encoding || 'utf-8';

        this.IsConnected = false;
        this.Sequence_Id = 1;
        this.ReSendData = false;
        this.WatchDogTimer;
        this.BadCRCTimer;
        this.BadCRCCount = 0;
        this.BadCRCLimit = 10;
        this.InProg = false;
        this.Discovering = false;
        this.InCryptTest = false;
        this.LastReceivedBuffer = undefined;
        this.LastMisunderstoodData = undefined;
        this.Password_length = 1;

        this.TCPConnect();
   }

    /*
     * Create TCP Connection
     * @return  {Promise}
     */
    TCPConnect() {
        this.Socket = new Socket();
        this.Socket.setTimeout(30000);
        if (this.Socket.connecting !== true) {
            return new Promise((resolve, reject) => {
                try {
                    this.on('BadCode', async () => {
                        // The AccessCode is incorrect.
                        // We go into a search mode to test all the codes between 0 and
                        // 999999 (maximum value).
                        // In the worst case (code 999999) the search can take up to several hours
                        // (around 100ms per test for an IPC2 card on the control panel, ie around 30 hours).
                        // Attention, access codes with one or more '0' prefixes are seen differently
                        // from the same code without the '0':
                        // 5678 != 05678 != 005678
                        const max_Password_Value = 999999;
                        if (this.DiscoverCode) {
                            this.logger(this.log, Log_Level.DEBUG, `Discovery Mode Enabled.`);
                            if (this.Discovering) {
                                do {
                                    if ((this.Password > max_Password_Value) && (this.Password_length < 6)){
                                        this.Password_length++;
                                        this.Password = 0;
                                    } else if (this.Password > max_Password_Value) {
                                        this.Disconnect();
                                    } else {
                                        this.Password++;
                                    }
                                } while ((this.Password_length <= this.Password.toString().length) && (this.Password_length > 1));
                            } else {
                                this.logger(this.log, Log_Level.ERROR, `Bad Access Code : ${this.Password}`);
                                this.Discovering = true;
                                this.Password = 0;
                                this.Password_length = 1;
                                this.once('AccessCodeOk', () => {
                                    this.logger(this.log, Log_Level.VERBOSE, `Discovered Access Code : ${this.Password}`);
                                    this.Discovering = false;
                                });
                            }
                            let code_len = (this.Password.toString().length >= this.Password_length) ? this.Password.toString().length : this.Password_length;
                            this.Sequence_Id = 1;
                            this.PanelConnect(code_len);
                        } else {
                            this.logger(this.log, Log_Level.ERROR, `Discovery Mode Is not Enabled. To Discovering Access Code, Enable it!!`);
                        }
                    });
                    this.Socket.once('ready', async () => {
                        this.IsConnected = true;
                        this.logger(this.log, Log_Level.VERBOSE, `Socket Connected.`);
                        this.PanelConnect();
                    });
                    this.Socket.once('error', (data) => {
                        this.logger(this.log, Log_Level.ERROR, `Socket Error : ${data.toString()}`);
                        this.IsConnected = false;
                        this.Disconnect();
                    });
                    this.Socket.once('close', () => {
                        this.logger(this.log, Log_Level.ERROR, `Socket Closed.`);
                        this.IsConnected = false;
                        this.Disconnect();
                    });
                    this.Socket.once('timeout', () => {
                        this.logger(this.log, Log_Level.ERROR, `Socket Timeout.`);
                        this.IsConnected = false;
                        this.Disconnect();
                    });
                    this.Socket.once('data', (new_data) => {
                        this.NewDataHandler(new_data);
                    });
                    this.Socket.connect(this.Port, this.Host);
                    resolve(true);
                } catch (error) {
                    this.logger(this.log, Log_Level.ERROR, `Socket Error : ${error}`);
                    resolve(false);
                }
            });
        }
    }

    /*
     * Send Data to Socket and Wait for a response
     * @param   {Buffer}
     * @return  {Promise}
     */
    async SendCommand(CommandStr, ProgCmd) {
        ProgCmd = ProgCmd || false;
        let WaitResponse = true;
        let ReceivedResponse = undefined;
        let TimeoutDelay = 5000;
        let IsTimedOut = false;
        let ReSendData = false;

        if (this.InCryptTest) {
            TimeoutDelay = 500;
        }
        this.logger(this.log, Log_Level.DEBUG, `Sending Command : ${CommandStr}`);
        return new Promise(async (resolve, reject) => {
            try {
                const errFunc = (err) => {
                    resolve(err);
                };
                const CommandSent = (response) => {
                    WaitResponse = false;
                    ReceivedResponse = response;
                    if (this.InCryptTest) {
                        this.CryptKeyValidity = true;
                    }
                };
                while (this.InProg && !ProgCmd) {
                    // if we are in programmation mode, wait 5s before retry
                    await new Promise(r => setTimeout(r, 5000));
                }
                try {
                    this.Socket.on('error', errFunc);

                    let Cmd_Id = this.Sequence_Id.toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping:false});
                    this.once(`CmdResponse_${Cmd_Id}`, CommandSent);

                    let EncryptedCmd = this.RCrypt.GetCommande(CommandStr, Cmd_Id);

                    if (!this.Socket.destroyed) {
                        this.Socket.write(EncryptedCmd);
                        this.logger(this.log, Log_Level.DEBUG, `Command Sent.`);
                        //Emit data to RiscoPanel Object
                        this.emit('DataSent', CommandStr, this.Sequence_Id);
                        let TimeOutTimer = setTimeout(() => {
                            IsTimedOut = true;
                        }, TimeoutDelay);
                        if (this.IsConnected) {
                            do {
                                await new Promise(r => setTimeout(r, 10));
                            } while ((WaitResponse && !IsTimedOut) || (this.InProg && !ProgCmd));
                            clearTimeout(TimeOutTimer);

                            if (this.LastMisunderstoodData !== undefined) {
                                if (!this.InCryptTest) {
                                    this.logger(this.log, Log_Level.DEBUG, `Need to re-sent data.`);
                                    ReSendData = true;
                                } else {
                                    ReceivedResponse = this.LastMisunderstoodData;
                                }
                            }
                            if (ReSendData) {
                                ReSendData = false;
                                ReceivedResponse = await this.SendCommand(CommandStr);
                            }
                        } else {
                            resolve(false);
                        }
                        this.Socket.off('error', errFunc);
                        this.logger(this.log, Log_Level.DEBUG, `SendCommand receive this response : ${ReceivedResponse}`);
                        resolve(ReceivedResponse);
                    } else {
                        this.logger(this.log, Log_Level.ERROR, `Socket Destroyed while using it.`);
                        this.Socket.off('error', errFunc);
                        this.IsConnected = false;
                        this.Disconnect();
                    }
                } catch (err){
                    this.Socket.off('error', errFunc);
                    resolve(false);
                }
            } catch {
                resolve(false);
            }
        });
    }

    /*
     * Send 'ACK' for acknowledge received datas
     * The response must match with the data sent.
     * The data ID number is used to identify the response.
     * @param   {String}    String matches Id
     */
    SendAck(Id) {
        this.logger(this.log, Log_Level.DEBUG, `Sending Ack.`);
        let EncryptedCmd = this.RCrypt.GetCommande('ACK', Id.toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping:false}));
        this.Socket.write(EncryptedCmd);
    }

    /*
     * Processing of received datas.
     * @param   {Buffer}    Encrypted Datas from Panel
     */
    NewDataHandler(data) {
        // Sometimes, Panel send multiple datas in same time
        // This behavior occurs in the event of a slowdown on the client side,
        // several data sets are then put in the reception buffer.
        let DataSeparator = `${String.fromCharCode(3)}${String.fromCharCode(2)}`;
        let lastReceivedId = 0;
        do {
            let subData = data;
            if (data.includes(DataSeparator)) {
                let SeparatorPos = data.indexOf(DataSeparator) + 1;
                subData = data.slice(0, SeparatorPos);
                data = data.slice(SeparatorPos);
            }
            this.LastReceivedBuffer = new Buffer.from(subData);
            let StringedBuffer = (() => {
                let result = new Array(0);
                for (const value of this.LastReceivedBuffer) {
                    result.push(value);
                }
                return `[${result.join(',')}]`;
            })();
            this.logger(this.log, Log_Level.DEBUG, `Received data Buffer : ${StringedBuffer}`);
            let [Receive_Id, ReceiveCommandStr, IsCRCOK] = this.RCrypt.DecodeMessage(subData);
            this.LastMisunderstoodData = undefined;

            // If the CRC does not match, it is a communication error.
            // In this case, we increase the bad CRC counter for communication
            // cut-off after a certain number of errors (10)
            if (!IsCRCOK) {
                if (!this.InCryptTest) {
                    this.LastMisunderstoodData = ReceiveCommandStr;
                    this.BadCRCCount++;
                    this.ReSendData = true;
                    if (this.BadCRCCount > this.BadCRCLimit) {
                        this.logger(this.log, Log_Level.ERROR, `Too bad CRC value.`);
                        this.emit('BadCRCLimit');
                        this.Disconnect();
                        return;
                    } else {
                        // A timer is started to reset the counter to zero in the event of a temporary disturbance.
                        // This counter is canceled with each new error and then immediately restarted.
                        clearTimeout(this.BadCRCTimer);
                        this.BadCRCTimer = setTimeout( () => {
                            this.BadCRCCount = 0;
                        }, 60000);
                        this.logger(this.log, Log_Level.WARN, `Wrong CRC value for the response.`);
                        this.emit('BadCRCData');
                    }
                } else {
                    lastReceivedId = Receive_Id;
                    this.CryptKeyValidity = false ;
                    this.LastMisunderstoodData = ReceiveCommandStr;
                }
            } else {
                // Don't do anything if it's a repeated Message
                if (lastReceivedId != Receive_Id) {
                    if (Receive_Id == '' && this.IsErrorCode(ReceiveCommandStr)) {
                        this.LastMisunderstoodData = ReceiveCommandStr;
                    } else if (Receive_Id >= 50) {
                        //it's an info from panel
                        //Send 'ACK' for acknowledge received datas
                        this.logger(this.log, Log_Level.DEBUG, `Data from Panel, need to send an ACK.`);
                        this.SendAck(Receive_Id);
                    } else {
                        //it's a response from panel
                        this.logger(this.log, Log_Level.DEBUG, `Response from Panel.`);
                        let response_Id = parseInt(Receive_Id, 10);
                        if (response_Id == this.Sequence_Id) {
                            this.logger(this.log, Log_Level.DEBUG, `Expected response for Command Id : ${Receive_Id}.`);
                            this.emit(`CmdResponse_${Receive_Id}`, ReceiveCommandStr);
                            this.IncreaseSequenceId();
                        }
                        //Else, Unexpected response, we do not treat
                    }
                    if (this.IsConnected) {
                        //Whether the data is expected or not, it is transmitted for analysis
                        this.emit('DataReceived', ReceiveCommandStr);
                    }
                    lastReceivedId = Receive_Id;
                }
            }
        } while (data.includes(DataSeparator));
        // We go back to 'listening' mode
        this.Socket.once('data', (new_data) => {
            this.NewDataHandler(new_data);
        });
    }

    /*
     * Increase the sequence number.
     * The sequence number must be between 1 and 49 inclusive.
     */
    IncreaseSequenceId() {
        if (this.Sequence_Id >= 49 ) {
            this.Sequence_Id = 0;
        }
        this.Sequence_Id++;
    }

    /*
     * Compare Response with Risco ErrorCode
     * @return  {boolean}
     */
    IsErrorCode(data) {
        if ((Object.keys(Risco_ErrorCode)).includes(data)) {
            return true;
        } else {
            return false;
        }
    }

    /*
     * Panel connection mechanism.
     * Send command RMT + Connection password
     * Send LCL command
     * After this point, the data is encrypted.
     * @paran   {Integer}   code length (between -6)
     * @return  {Boolean}   true/false if connected or not
     */
    async PanelConnect(code_len) {
        code_len = (code_len !== undefined) ? code_len : 4;

        if (!(this.IsConnected)) {
            await this.TCPConnect();
            //wait 100ms for avoid slow connection
            await new Promise(r => setTimeout(r, 100));
        }

        let PossibleKey = 9999;
        let ConnectPanel;
        let Panel_Id = this.RCrypt.Panel_Id;

        ConnectPanel = await this.SendCommand(`RMT=${this.Password.toString().padStart(code_len, '0')}`)
        .then( async (data) => {
            if (data.includes('ACK') === true) {
                if (this.Discovering) {
                    this.logger(this.log, Log_Level.DEBUG, `Access Code is Ok : ${this.Password}`);
                    this.emit('AccessCodeOk');
                    this.Discovering = false;
                }
                return await this.SendCommand(`LCL`);
            } else if (this.IsErrorCode(data)) {
                this.emit('BadCode');
                return false;
            } else {
                return false;
            }
        })
        .then( async (data) => {
            if (data && data.includes('ACK') === true) {
                // Now, Encrypted channel is enabled
                let CryptResult = true;
                let TestBuffer;
                this.RCrypt.CryptCommand = true;
                await new Promise(r => setTimeout(r, 1000));
                this.InCryptTest = true;
                [CryptResult, TestBuffer] = await this.CryptTableTester(`CUSTLST?`);
                if (this.DiscoverCode && !this.CryptKeyValidity) {
                    this.logger(this.log, Log_Level.DEBUG, `Bad Panel Id : ${this.RCrypt.Panel_Id}.`);
                    let CryptedResponseBuffer = new Buffer.from(TestBuffer);
                    this.emit('BadCryptKey');
                    this.once('CryptKeyOk', () => {
                        this.logger(this.log, Log_Level.VERBOSE, `Discovered Panel Id : ${this.RCrypt.Panel_Id}.`);
                        this.InCryptTest = false;
                    });
                    let TestResultOk = false;
                    do {
                        do {
                            // Because the Buffer is modified by reference during decryption, a new Buffer is created on each attempt.
                            let TestBufferData = new Buffer.from(CryptedResponseBuffer);
                            this.RCrypt.Panel_Id = PossibleKey;
                            this.RCrypt.UpdatePseudoBuffer();
                            let [Receive_Id, ReceiveCommandStr, IsCRCOK] = this.RCrypt.DecodeMessage(TestBufferData);
                            TestResultOk = (() => {
                                if ((Receive_Id == '') && (this.IsErrorCode(ReceiveCommandStr)) && IsCRCOK) {
                                    this.logger(this.log, Log_Level.DEBUG, `Panel Id is possible candidate : ${PossibleKey}`);
                                    return true;
                                } else {
                                    this.logger(this.log, Log_Level.DEBUG, `Panel Id is not : ${PossibleKey}`);
                                    PossibleKey--;
                                    return false;
                                }
                            })();
                        } while ((PossibleKey >=0) && !TestResultOk);

                        [CryptResult, ] = await this.CryptTableTester(`CUSTLST`);
                        if ((PossibleKey >= 0) && (CryptResult)) {
                            await new Promise(r => setTimeout(r, 1000));
                            this.InCryptTest = false;
                            this.emit('CryptKeyOk');
                        } else if ((PossibleKey < 0)) {
                            this.InCryptTest = false;
                        } else {
                            this.InCryptTest = true;
                            //reauth and restart test from actual PossibleKey
                            await new Promise(r => setTimeout(r, 1000));
                            PossibleKey--;
                        }
                    } while (!ConnectPanel && this.InCryptTest);
                    //empty buffer socket???
                    await new Promise(r => setTimeout(r, 2000));
                }
                this.InCryptTest = false;
                return CryptResult;
            } else {
                return false;
            }
        })
        .catch( (err) => {
            return false;
        });

        if (!this.Discovering) {
            if (ConnectPanel !== false) {
                this.logger(this.log, Log_Level.DEBUG, `Connection to the control panel successfully established.`);
                this.IsConnected = true;
                this.emit('PanelConnected');
            } else {
                this.logger(this.log, Log_Level.ERROR, `Error when connecting to the control panel.`);
                this.IsConnected = false;
                this.emit('Disconnected');
            }
        }
    }

    /*
     *  Function used to test the encryption table.
     *  If the result does not match, it means that the panel Id is not the correct one
     * and that it must be determined (provided that the option is activated).
     */
    async CryptTableTester(Test_Cmd) {
        return new Promise(async (resolve, reject) => {
            try {
                this.CryptKeyValidity = undefined;
                // To avoid false positives, this command provides a long response which
                // allows only few possible errors when calculating the CRC
                await this.SendCommand(`${Test_Cmd}?`)
                    .then( async (response) => {
                        while (this.CryptKeyValidity === undefined) {
                            await new Promise(r => setTimeout(r, 10));
                        }
                        this.logger(this.log, Log_Level.DEBUG, `Response crypt: ${response}`);
                        resolve([this.CryptKeyValidity && !this.IsErrorCode(response), this.LastReceivedBuffer]);
                    })
                    .catch( (err) => {
                        resolve([false, undefined]);
                    });
            } catch {
                resolve([false, undefined]);
            }
        });
    }

    /*
     * For reasons of sustainability, it is preferable to deactivate the RiscoCloud.
     * This function performs this operation.
     * @return  {boolean}       true/false if success/fails
     */
    async DisableRiscoCloud() {
        if (await this.EnableProgMode()) {
            this.logger(this.log, Log_Level.DEBUG, `Disabling RiscoCloud.`);
            await this.SendCommand(`ELASEN=0`, true)
            .then( async (data) => {
                if (data.includes('ACK') === true) {
                    let ExitProg = await this.DisableProgMode();
                    return ExitProg;
                } else {
                    return false;
                }
            })
            .then( result => {
                if (result) {
                    this.logger(this.log, Log_Level.DEBUG, `RiscoCloud Successfully disabled.`);
                } else {
                    this.logger(this.log, Log_Level.DEBUG, `RiscoCloud not Diasbled.`);
                }
                return result;
            })
            .catch( (err) => {
                this.logger(this.log, Log_Level.ERROR, `Error on Disabling: ${err.toString()}`);
                return false;
            });
        } else {
            this.Disconnect();
        }
    }
    /*
     * Modification of the configuration of the control unit according to the
     * parameters of the plugin and the suitability of the configuration
     * @param   {Array of String}   Command to be executed for modification
     * @return  {boolean}           true/false if success/fails
     */
    async ModifyPanelConfig(CommandsArr) {
        this.logger(this.log, Log_Level.DEBUG, `Modifying Panel Configuration.`);
        if (await this.EnableProgMode()) {
            CommandsArr.forEach(async (command) => {
                await this.SendCommand(command, true)
                    .then(async (data) => {
                        if (data.includes('ACK') === true) {
                            let ExitProg = await this.DisableProgMode();
                            return ExitProg;
                        } else {
                            return false;
                        }
                    })
                    .catch(async (err) => {
                        await this.DisableProgMode();
                        return false;
                    });
            });
            let ExitProgMode = await this.DisableProgMode();
            return ExitProgMode;
        } else {
            this.Disconnect();
        }
    }

    /*
     * Switches the control unit to programming mode
     * @return  {Promise}
     */
    async EnableProgMode() {
        return new Promise(async (resolve, reject) => {
            await this.SendCommand(`PROG=1`, true)
                .then( data => {
                    if (data.includes('ACK') === true) {
                        this.logger(this.log, Log_Level.DEBUG, `Entering Programmation Mode.`);
                        this.InProg = true;
                        resolve(true);
                    } else {
                        this.logger(this.log, Log_Level.DEBUG, `Cannot Entering Programmation Mode.`);
                        resolve(false);
                    }
                })
                .catch( (err) => {
                    resolve(false);
                });
        });
    }

    /*
     * Switches the control unit out of programming mode
     * @return  {Promise}
     */
    async DisableProgMode() {
        return new Promise(async (resolve, reject) => {
            await this.SendCommand(`PROG=2`, true)
                .then( async (data) => {
                    if (data.includes('ACK') === true) {
                        this.logger(this.log, Log_Level.DEBUG, `Exiting Programmation Mode.`);
                        resolve(true);
                    } else {
                        this.logger(this.log, Log_Level.DEBUG, `Cannot Exiting Programmation Mode.`);
                        resolve(false);
                    }
                })
                .catch( (err) => {
                    resolve(false);
                });
        });
    }

    /*
     * Send a request every 5 seconds to maintain the connection
     */
    async WatchDog() {
        this.WatchDogTimer = setTimeout(async () => {
            if (this.IsConnected) {
                this.WatchDog();
                if (!this.InProg) {
                    return await this.SendCommand(`CLOCK`);
                }
            }
        }, 5000);
    }

    /*
     * Disconnects the Socket and stops the WatchDog function
     */
    async Disconnect() {
        if (!this.Socket.destroyed) {
            this.IsConnected = false;
            clearTimeout(this.WatchDogTimer);
            await this.SendCommand('DCN');
            this.Socket.destroy();
            this.logger(this.log, Log_Level.DEBUG, `Socket Destroyed.`);
        }
        this.emit('Disconnected');
        this.logger(this.log, Log_Level.DEBUG, `Socket Disconnected.`);
    }
}

module.exports = {
    Risco_Socket: Risco_Socket
};