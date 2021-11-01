/* 
 *  Package: risco-lan-bridge
 *  File: RiscoChannels.js
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

const Net = require('net');
const Socket = Net.Socket;
const EventEmitter = require('events').EventEmitter;
const Risco_ErrorCode = require('./constants').RiscoError;
const Log_Level = require('./constants').Log_Level;

class Risco_Base_Socket extends EventEmitter {

    constructor(SocketOptions) {
        super();

        this.ProxyInServer = undefined;
        this.CloudConnected = false;
        this.CloudSocket = undefined;

        this.Host = SocketOptions.Panel_Ip;
        this.Port = SocketOptions.Panel_Port;
        this.RCrypt = SocketOptions.RCrypt;
        this.Password = SocketOptions.Password;
        this.DiscoverCode = SocketOptions.DiscoverCode;
        this.logger = SocketOptions.logger;
        this.log = SocketOptions.log;

        this.Encoding = SocketOptions.Encoding || 'utf-8';

        this.LastRmtId = -5;
        this.IsConnected = false;
        this.Sequence_Id = 1;
        this.ReSendData = false;
        this.WatchDogTimer = undefined;
        this.BadCRCTimer = undefined;
        this.BadCRCCount = 0;
        this.BadCRCLimit = 10;
        this.InProg = false;
        this.Discovering = false;
        this.InCryptTest = false;
        this.LastReceivedBuffer = undefined;
        this.LastMisunderstoodData = undefined;
        this.Password_length = 1;
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
            let StringedBuffer = this.GetStringedBuffer(this.LastReceivedBuffer);

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
                        // it's an info from panel
                        // Send 'ACK' for acknowledge received datas
                        this.logger(this.log, Log_Level.DEBUG, `Data from Panel, need to send an ACK.`);
                        this.SendAck(Receive_Id);
                    } else {
                        // it's a response from panel
                        this.logger(this.log, Log_Level.DEBUG, `Response from Panel.`);
                        let response_Id = parseInt(Receive_Id, 10);
                        if (response_Id == this.Sequence_Id) {
                            this.emit(`CmdResponse_${Receive_Id}`, ReceiveCommandStr);
                            this.logger(this.log, Log_Level.DEBUG, `Expected response for Command Id : ${Receive_Id}.`);
                            this.IncreaseSequenceId();
                        }
                        // Else, Unexpected response, we do not treat
                    }
                    if (this.IsConnected) {
                        // Whether the data is expected or not, it is transmitted for analysis
                        this.emit('DataReceived', ReceiveCommandStr);
                    }
                    lastReceivedId = Receive_Id;
                }
            }
        } while (data.includes(DataSeparator));

        if (this.SocketMode === 'direct') {
            // We go back to 'listening' mode
            this.Socket.once('data', (new_input_data) => {
                this.NewDataHandler(new_input_data);
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
            if (this.SocketMode === 'proxy') {
                TimeoutDelay = 5000;
            } else {
                TimeoutDelay = 500;
            }
        } else if ((this.Discovering) && (this.SocketMode === 'proxy')) {
            TimeoutDelay = 100;
        }
        if (this.InProg) {
            TimeoutDelay = 29000;
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
                    if ((this.Socket !== undefined) && (this.Socket.listenerCount('error') === 0)) {
                        this.Socket.on('error', errFunc);
                    }

                    let Cmd_Id = this.Sequence_Id.toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping:false});
                    if (this.listenerCount(`CmdResponse_${Cmd_Id}`) === 0) {
                        this.once(`CmdResponse_${Cmd_Id}`, CommandSent);
                    }

                    let EncryptedCmd = this.RCrypt.GetCommande(CommandStr, Cmd_Id);

                    if ((this.Socket !== undefined) && (!this.Socket.destroyed)) {
                        this.Socket.write(EncryptedCmd);
                        this.logger(this.log, Log_Level.DEBUG, `Command Sent.`);
                        // Emit data to RiscoPanel Object
                        this.emit('DataSent', CommandStr, this.Sequence_Id);
                        let TimeOutTimer = setTimeout((Id, CommandStr, Resend) => {
                            IsTimedOut = true;
                            this.logger(this.log, Log_Level.DEBUG, `Command : '${Id} ${CommandStr}' Timeout!!!`);
                            this.off(`CmdResponse_${Id}`, CommandSent);
                            Resend = true;
                        }, TimeoutDelay, Cmd_Id, CommandStr, ReSendData);
                        if (this.IsConnected) {
                            do {
                                if (!this.InProg) {
                                    await new Promise(r => setTimeout(r, 10));
                                } else {
                                    await new Promise(r => setTimeout(r, 1000));
                                }
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
                        if ((this.Socket !== undefined) && (!this.Socket.destroyed)) {
                            this.Socket.off('error', errFunc);
                        }
                        this.logger(this.log, Log_Level.DEBUG, `SendCommand receive this response : ${ReceivedResponse}`);
                        resolve(ReceivedResponse);
                    } else {
                        this.logger(this.log, Log_Level.ERROR, `Socket Destroyed while using it.`);
                        if (this.Socket !== undefined) {
                            this.Socket.off('error', errFunc);
                        }
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
     * Compare Response with Risco ErrorCode
     * @return  {boolean}
     */
    IsErrorCode(data) {
        if ((data !== undefined) && (Object.keys(Risco_ErrorCode)).includes(data)) {
            return true;
        } else if ((this.SocketMode === 'proxy') && (data === undefined)) {
            return true;
        } else {
            return false;
        }
    }

    /*
     * Convert Buffer to string representation
     * @param   {Buffer}
     * @retrun  {string}
     */
    GetStringedBuffer(data) {
        let result = new Array(0);
        for (const value of data) {
            result.push(value);
        }
        return `[${result.join(',')}]`;
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
                    this.logger(this.log, Log_Level.DEBUG, `RiscoCloud Successfully Disabled.`);
                } else {
                    this.logger(this.log, Log_Level.DEBUG, `RiscoCloud not Diasbled.`);
                }
                return result;
            })
            .catch( (err) => {
                this.logger(this.log, Log_Level.ERROR, `Error on Disabling RiscoCloud: ${err.toString()}`);
                return false;
            });
        } else {
            this.Disconnect();
        }
    }

    /*
     * This function Activate RiscoCloud.
     * @return  {boolean}       true/false if success/fails
     */
    async EnableRiscoCloud() {
        if (await this.EnableProgMode()) {
            this.logger(this.log, Log_Level.DEBUG, `Enabling RiscoCloud.`);
            await this.SendCommand(`ELASEN=1`, true)
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
                    this.logger(this.log, Log_Level.DEBUG, `RiscoCloud Successfully Enabled.`);
                } else {
                    this.logger(this.log, Log_Level.DEBUG, `RiscoCloud not Enabled.`);
                }
                return result;
            })
            .catch( (err) => {
                this.logger(this.log, Log_Level.ERROR, `Error on Enabling RiscoCloud: ${err.toString()}`);
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
        let ExitProgMode = undefined;
        if (await this.EnableProgMode()) {
            CommandsArr.forEach(async (command) => {
                await this.SendCommand(command, true)
                    .then(async (data) => {
                        if (data.includes('ACK') === true) {
                            ExitProgMode = await this.DisableProgMode();
                            return ExitProgMode;
                        } else {
                            return false;
                        }
                    })
                    .catch(async (err) => {
                        await this.DisableProgMode();
                        return false;
                    });
            });
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
                        //this.InProg = false;
                        resolve(true);
                    } else {
                        this.logger(this.log, Log_Level.DEBUG, `Cannot Exiting Programmation Mode.`);
                        //this.InProg = false;
                        resolve(false);
                    }
                })
                .catch( (err) => {
                    this.InProg = false;
                    resolve(false);
                });
        });
    }
}

class Risco_DirectTCP_Socket extends Risco_Base_Socket {

    constructor(SocketOptions) {
        super(SocketOptions);

        this.SocketMode = 'direct';
        this.SocketTimeout = 30000;
        this.TCPConnect();
    }

    /*
     * Create TCP Connection
     * @return  {Promise}
     */
    async TCPConnect() {
        this.Socket = new Socket();
        this.Socket.setTimeout(this.SocketTimeout);
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
                        this.Disconnect();
                    });
                    this.Socket.once('close', () => {
                        this.logger(this.log, Log_Level.ERROR, `Socket Closed.`);
                        this.Disconnect();
                    });
                    this.Socket.once('timeout', () => {
                        this.logger(this.log, Log_Level.ERROR, `Socket Timeout.`);
                        this.Disconnect();
                    });
                    this.Socket.once('data', (new_input_data) => {
                        this.NewDataHandler(new_input_data);
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
            // Wait 100ms for avoid slow connection
            await new Promise(r => setTimeout(r, 100));
        }

        let PossibleKey = 9999;
        let ConnectPanel;

        ConnectPanel = await this.SendCommand(`RMT=${this.Password.toString().padStart(code_len, '0')}`)
        .then( async (data) => {
            if (data !== undefined) {
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
                            // Reauth and restart test from actual PossibleKey
                            await new Promise(r => setTimeout(r, 1000));
                            PossibleKey--;
                        }
                    } while (!ConnectPanel && this.InCryptTest);
                    // Empty buffer socket???
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
                this.Disconnect();
            }
        }
    }

    /*
     * Disconnects the Socket and stops the WatchDog function
     */
    async Disconnect() {
        this.emit('Disconnected');
        if ((this.Socket !== undefined) && (!this.Socket.destroyed)) {
            clearTimeout(this.WatchDogTimer);
            await this.SendCommand('DCN');
            this.Socket.destroy();
            this.logger(this.log, Log_Level.DEBUG, `Socket Destroyed.`);
            this.Socket.removeAllListeners();
            this.Socket = undefined;
        }
        this.IsConnected = false;
        this.logger(this.log, Log_Level.DEBUG, `Socket Disconnected.`);
    }
}

class Risco_ProxyTCP_Socket extends Risco_Base_Socket {

    constructor(SocketOptions) {
        super(SocketOptions);

        this.SocketMode = 'proxy';
        this.SocketTimeout = 120000;
        this.CloudRetryTimer = undefined;

        this.ListeningPort = SocketOptions.ListeningPort;
        this.CloudPort = SocketOptions.CloudPort;
        this.CloudUrl = SocketOptions.CloudUrl;

        this.TCPConnect();
   }

    /*
     * Create TCP Connection
     * @return  {Promise}
     */
    TCPConnect() {
        return new Promise((resolve, reject) => {
            try {
                if (this.ProxyInServer === undefined) { 
                    this.ProxyInServer = new Net.Server();
                    // Accept only 1 connections at the same time
                    this.ProxyInServer.maxConnections = 1;
                } else {
                    this.ProxyInServer.removeAllListeners();
                }
                this.ProxyInServer.on('error', (err) => {
                    if (err.code === 'EADDRINUSE') {
                      this.logger(this.log, Log_Level.ERROR, `Cannot start Proxy ; Address already in use, retrying within 5sec...`);
                      setTimeout(() => {
                        this.ProxyInServer.close();
                        this.ProxyInServer.listen(this.ListeningPort);
                      }, 5000);
                    }
                  });
                this.ProxyInServer.on('connection', (socket) => {
                    try {
                        this.Socket = socket;
                        this.CloudSocket = new Socket();
                        this.Socket.setTimeout(this.SocketTimeout);
                        this.CloudSocket.setTimeout(this.SocketTimeout);
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
                        this.CloudSocket.on('ready', async () => {
                            if (this.CloudRetryTimer !== undefined) {
                                clearTimeout(this.CloudRetryTimer);
                            }
                            this.logger(this.log, Log_Level.VERBOSE, `Panel Socket and RiscoCloud Socket Connected.`);
                            this.IsConnected = true;
                            do {
                                await new Promise(r => setTimeout(r, 1000));
                            } while ((this.CloudConnected !== true) || (this.InRemoteConn));
                            this.PanelConnect();
                        });
                        this.Socket.once('error', (error) => {
                            this.logger(this.log, Log_Level.ERROR, `Socket Error : ${error.toString()}`);
                            if (!this.CloudSocket.destroyed) {
                                this.CloudSocket.destroy(`Destroy RiscoCloud Socket due to Panel Socket Error`)
                            }
                        });
                        this.CloudSocket.on('error', (error) => {
                            if (error.code === 'ECONNREFUSED') {
                                this.logger(this.log, Log_Level.ERROR, `Cannot connect to RiscoCloud, retrying within 5sec...`);
                                this.CloudSocket.end();
                                this.CloudRetryTimer = setTimeout(() => {
                                    this.CloudSocket.connect(this.CloudPort, this.CloudUrl);
                                }, 5000);
                            } else {
                                this.logger(this.log, Log_Level.ERROR, `RiscoCloud Socket Error : ${error.toString()}`);
                                if (!this.Socket.destroyed) {
                                    this.Socket.destroy(`Destroy Panel Socket due to RiscoCloud Socket Error`);
                                }
                            }
                        });
                        this.CloudSocket.on('connect', () => {
                            if (this.CloudRetryTimer !== undefined) {
                                clearTimeout(this.CloudRetryTimer);
                            }
                        })
                        this.Socket.once('close', () => {
                            this.logger(this.log, Log_Level.ERROR, `Socket Closed.`);
                            if (this.CloudRetryTimer !== undefined) {
                                clearTimeout(this.CloudRetryTimer);
                            }
                            this.Disconnect();
                        });
                        this.CloudSocket.on('close', () => {
                            if (this.CloudRetryTimer === undefined) {
                                this.logger(this.log, Log_Level.ERROR, `RiscoCloud Socket Closed.`);
                                if (!this.Socket.destroyed) {
                                    this.Socket.end(`Close Panel Socket due to RiscoCloud Socket is Closed`);
                                    this.Disconnect();
                                }
                            }
                        });
                        this.Socket.on('timeout', () => {
                            this.logger(this.log, Log_Level.ERROR, `${new Date().toLocaleTimeString()} Panel Socket Timeout.`);
                            this.Disconnect();
                        });
                        this.CloudSocket.on('timeout', () => {
                            this.logger(this.log, Log_Level.ERROR, `${new Date().toLocaleTimeString()} RiscoCloud Socket Timeout.`);
                            if (!this.Socket.destroyed) {
                                this.Socket.end(`Close Panel Socket due to RiscoCloud Socket Timeout`);
                            }
                            this.Disconnect();
                        });
                        this.Socket.once('data', (data) => {
                            this.NewDataHandler_PanelSocket(data);
                        });
                        this.CloudSocket.once('data', (data) => {
                            this.NewDataHandler_CloudSocket(data);
                        });
                        this.CloudSocket.connect(this.CloudPort, this.CloudUrl);
                        resolve(true);
                    } catch (err) {
                        this.logger(this.log, Log_Level.ERROR, `RiscoCloud Socket Error : ${error}`);
                    }
                });
                this.ProxyInServer.on('listening', () => {
                    const ProxyInfo = this.ProxyInServer.address();
                    this.logger(this.log, Log_Level.INFO, `Listening on IP ${ProxyInfo.address} and Port ${ProxyInfo.port}`);
                });
                if (!this.ProxyInServer.listening) {
                    this.ProxyInServer.listen(this.ListeningPort);
                }
            } catch (err) {
                this.logger(this.log, Log_Level.ERROR, `Error on Internal Socket creation : ${err}`);
            }
        });
    }

    /*
     * Hanle new data Received on Panel Socket Side
     * @param   {Buffer}
     */
    async NewDataHandler_PanelSocket(new_output_data) {
        let StringedBuffer = this.GetStringedBuffer(new_output_data);
        if (new_output_data[1] === 19) {
            let DecryptedBuffer = new Buffer.from(new_output_data, this.Encoding).toString(this.Encoding);
            this.logger(this.log, Log_Level.DEBUG, `Received Cloud data Buffer from Panel : ${StringedBuffer}`);
            this.CloudSocket.write(new_output_data);
        } else {
            let DecryptedBuffer = new Buffer.from(new_output_data, this.Encoding).toString(this.Encoding);
            if (new_output_data[1] !== 17) {                
                this.logger(this.log, Log_Level.DEBUG, `Received data Buffer from Panel : ${StringedBuffer}`);
                if (this.InRemoteConn) {
                    this.CloudSocket.write(new_output_data);
                } else {
                    this.NewDataHandler(new_output_data);
                }
            } else if (new_output_data[1] === 17) {
                this.logger(this.log, Log_Level.DEBUG, `Received data Buffer from Panel : ${StringedBuffer}`);
                if (this.InRemoteConn) {
                    // To be able to correctly intercept the end of the remote connection, we must be able to decrypt
                    // the commands exchanged between the control panel and the RiscoCloud as soon as possible.
                    // As soon as a frame is long enough, we will check if we decode it correctly and if not we look 
                    // for the decryption key.
                    let [RmtId, RmtCommandStr, RmtIsCRCOK] = this.RCrypt.DecodeMessage(new Buffer.from(new_output_data));
                    if (!RmtIsCRCOK && (new_output_data.length > 90) && !this.InCryptTest) {
                        setTimeout( r => {
                            this.InCryptTest = true;
                            let PossibleKey = 9999;
                            let TestResultOk = false;
                            do {
                                // Because the Buffer is modified by reference during decryption, a new Buffer is created on each attempt.
                                let TestBufferData = new Buffer.from(new_output_data);
                                this.RCrypt.Panel_Id = PossibleKey;
                                this.RCrypt.UpdatePseudoBuffer();
                                [RmtId, RmtCommandStr, RmtIsCRCOK] = this.RCrypt.DecodeMessage(TestBufferData);
                                TestResultOk = (() => {
                                    if (RmtIsCRCOK) {
                                        this.logger(this.log, Log_Level.DEBUG, `Panel Id is possible candidate : ${PossibleKey}`);
                                        this.InCryptTest = false;
                                        return true;
                                    } else {
                                        this.logger(this.log, Log_Level.DEBUG, `Panel Id is not : ${PossibleKey}`);
                                        PossibleKey--;
                                        return false;
                                    }
                                })();
                            } while ((PossibleKey >=0) && !TestResultOk);
                        }, 50);
                    }
                    [RmtId, RmtCommandStr, RmtIsCRCOK] = this.RCrypt.DecodeMessage(new Buffer.from(new_output_data));
                    if (parseInt(RmtId, 10) === parseInt(this.LastRmtId, 10)) {
                        this.CloudSocket.write(new_output_data);
                    }
                    if (RmtCommandStr.includes('STT')) {
                        this.NewDataHandler(new_output_data);
                    }
                } else {
                    this.NewDataHandler(new_output_data);
                }
            }
        }
        this.Socket.once('data', (data) => {
            this.NewDataHandler_PanelSocket(data);
        });
    }

    /*
     * Handle new data received on Cloud Socket side
     * @param   {Buffer}
     */
    NewDataHandler_CloudSocket(new_input_data) {
        let StringedBuffer = this.GetStringedBuffer(new_input_data);
        if (new_input_data[1] === 19) {
            setTimeout(async () => {
                this.CloudConnected = true;
            }, 45000);
            this.logger(this.log, Log_Level.DEBUG, `Received Cloud data Buffer from RiscoCloud : ${StringedBuffer}`);
            this.Socket.write(new_input_data);
        } else {
            this.Socket.write(new_input_data);
            let DecryptedBuffer = new Buffer.from(new_input_data, this.Encoding).toString(this.Encoding);
            let RmtCommandStr = undefined;
            let RmtIsCRCOK = undefined;
            [this.LastRmtId, RmtCommandStr, RmtIsCRCOK] = this.RCrypt.DecodeMessage(new Buffer.from(new_input_data));
            if (new_input_data[1] !== 17) {
                this.logger(this.log, Log_Level.DEBUG, `Received Remote data Buffer from RiscoCloud : ${StringedBuffer}`);
                switch (true) {
                    case (RmtCommandStr.includes('RMT=')):
                        this.emit('IncomingRemoteConnection');
                        this.InRemoteConn = true;
                        if (this.IsConnected) {
                            const RmtPassword = RmtCommandStr.substring(RmtCommandStr.indexOf('=') + 1);
                            if (parseInt(RmtPassword, 10) === parseInt(this.Password, 10)){
                                const FakeResponse = this.RCrypt.GetCommande('ACK', this.LastRmtId, false);
                                this.logger(this.log, Log_Level.DEBUG, `Send Fake Response to RiscoCloud Socket : ${this.GetStringedBuffer(FakeResponse)}`);
                                this.CloudSocket.write(FakeResponse);
                            }
                        } else {
                            this.Socket.write(new_input_data);
                        }
                        break;
                    case (DecryptedBuffer.includes('LCL')):
                        if (this.IsConnected) {
                            const FakeResponse = this.RCrypt.GetCommande('ACK', this.LastRmtId, false);
                            this.logger(this.log, Log_Level.DEBUG, `Send Fake Response to RiscoCloud Socket : ${this.GetStringedBuffer(FakeResponse)}`);
                            this.CloudSocket.write(FakeResponse);
                        } else {
                            this.Socket.write(new_input_data);
                        }
                        break;
                    default:
                        this.Socket.write(new_input_data);
                        break;
                }
            } else if (new_input_data[1] === 17) {
                this.Socket.write(new_input_data);
                if (this.InRemoteConn && RmtIsCRCOK && RmtCommandStr.includes('DCN')) {
                    this.InRemoteConn = false;
                    const FakeResponse = this.RCrypt.GetCommande('ACK', this.LastRmtId, true);
                    this.logger(this.log, Log_Level.DEBUG, `Send Fake Response to RiscoCloud Socket : ${this.GetStringedBuffer(FakeResponse)}`);
                    this.CloudSocket.write(FakeResponse);
                    this.emit('EndIncomingRemoteConnection');
                }
            }
        }
        this.CloudSocket.once('data', (data) => {
            this.NewDataHandler_CloudSocket(data);
        });
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

        if (!(this.CloudConnected)) {
            await this.TCPConnect();
            // Wait 100ms for avoid slow connection
            await new Promise(r => setTimeout(r, 100));
        }

        let PossibleKey = 9999;
        let ConnectPanel;

        ConnectPanel = await this.SendCommand(`RMT=${this.Password.toString().padStart(code_len, '0')}`)
        .then( async (data) => {
            if ((data !== undefined) && data && (data.includes('ACK') === true)) {
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
                                if (IsCRCOK) {
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
                            // Reauth and restart test from actual PossibleKey
                            await new Promise(r => setTimeout(r, 100));
                            PossibleKey--;
                        }
                    } while (!ConnectPanel && this.InCryptTest);
                    // Empty buffer socket???
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
                this.Disconnect();
            }
        }
    }

    /*
     * Disconnects the Socket and stops the WatchDog function
     */
    async Disconnect() {
        this.ProxyInServer.close();
        this.emit('Disconnected');
        if ((this.Socket !== undefined) && (!this.Socket.destroyed)) {
            this.IsConnected = this.CloudConnected = false;
            clearTimeout(this.WatchDogTimer);
            await this.SendCommand('DCN');
            if (this.Socket !== undefined) {
                this.Socket.removeAllListeners();
                this.Socket.destroy();
                this.Socket = undefined;
                this.logger(this.log, Log_Level.DEBUG, `Socket Destroyed.`);
            }
        }
        if ((this.CloudSocket !== undefined) && (!this.CloudSocket.destroyed)) {
            this.CloudSocket.destroy();
            this.logger(this.log, Log_Level.DEBUG, `RiscoCloud Socket Destroyed.`);
            this.CloudSocket.removeAllListeners();
            this.CloudSocket = undefined;
        }
        this.CloudConnected = false;
    }
}

module.exports = {
    Risco_DirectTCP_Socket: Risco_DirectTCP_Socket,
    Risco_ProxyTCP_Socket: Risco_ProxyTCP_Socket
};