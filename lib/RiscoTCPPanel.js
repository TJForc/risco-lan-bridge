/* 
 *  Package: risco-lan-bridge
 *  File: RiscoPanel.js
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

const EventEmitter = require('events').EventEmitter;
const RiscoDirectTCP = require('./RiscoDirectTCP').RiscoDirectTCP;
const Socket = require('./Socket').Risco_Socket;
const Crypt = require('./RCrypt').Risco_Crypt;

const logger = require('./Logger').logger;
const log = require('./Logger').log;

const MBSystem = require('./Devices/System').MBSystem;
const ZoneList = require('./Devices/Zones').ZoneList;
const OutputList = require('./Devices/Outputs').OutputList;
const PartitionsList = require('./Devices/Partitions').PartitionsList;

const constants = require('./constants');
const Log_Level = constants.Log_Level;
const PanelType = constants.PanelType;


class RiscoPanel extends EventEmitter {
    constructor(Options) {
        super();
        this.logger = ((Options.logger !== undefined) ? Options.logger : logger);
        this.log = ((Options.log !== undefined) ? Options.log : log);
        this.AutoDiscover = ((Options.AutoDiscover !== undefined) ? Options.AutoDiscover : true);
        
        this.MaxZones = Options.MaxZones;
        this.MaxParts = Options.MaxParts;
        // this.MaxGroups = Options.MaxGroups;
        this.MaxOutputs = Options.MaxOutputs;

        this.RiscoComm = new RiscoDirectTCP(Options);        

        this.Zones = undefined;
        this.Outputs = undefined;
        this.Partitions = undefined;
        this.Groups = undefined;
        this.MBSystem = undefined;

        this.ZonesReady = false;
        this.OutputsReady = false;
        this.PartitionsReady = false;
        this.GroupsReady = false;
        this.SystemReady = false;

        this.IsConnected = false;

        this.RiscoComm.on('PanelCommReady', async () => {
            if (Options.Panel_Type == PanelType.RP512) {
                this.MaxZones = this.RiscoComm.MaxZones;
            } else if (Options.Panel_Type == PanelType.RP432) {
                this.MaxZones = this.RiscoComm.MaxZones;
                this.MaxOutputs = this.RiscoComm.MaxOutputs;
            }
            this.MBSystem = new MBSystem('', '---------------------');
            this.MBSystem.on('ProgModeOff', () => {
                this.logger(this.log, Log_Level.DEBUG, `Control unit exiting Programming mode.`);
                this.RiscoComm.TCPSocket.InProg = false;
            });
            this.Zones = new ZoneList(this.MaxZones, this.RiscoComm);
            this.Outputs = new OutputList(this.MaxOutputs, this.RiscoComm);
            this.Partitions = new PartitionsList(this.MaxParts, this.RiscoComm);
            if (this.AutoDiscover) {
                this.logger(this.log, Log_Level.DEBUG, `Beginning of device discovery.`);
                [this.SystemReady, this.MBSystem] = await this.RiscoComm.GetSystemDatas();
                [this.ZonesReady, this.Zones] = await this.RiscoComm.GetAllZonesDatas(this.Zones);
                [this.OutputsReady, this.Outputs] = await this.RiscoComm.GetAllOutputsDatas(this.Outputs);
                [this.PartitionsReady, this.Partitions] = await this.RiscoComm.GetAllPartitionsDatas(this.Partitions);
                this.logger(this.log, Log_Level.DEBUG, `End of device discovery.`);
            }
            this.RiscoComm.Zones = this.Zones;
            this.RiscoComm.Outputs = this.Outputs;
            this.RiscoComm.Partitions = this.Partitions;
            this.RiscoComm.Groups = undefined;
            this.RiscoComm.MBSystem = this.MBSystem;

            this.MBSystem.on('SStatusChanged', (EventStr) => {
                this.logger(this.log, Log_Level.DEBUG, `this.MBSystem Status Changed :\n New Status: ${EventStr}`);
            });
            this.Zones.on('ZStatusChanged', (Id, EventStr) => {
                this.logger(this.log, Log_Level.DEBUG, `this.Zones Status Changed :\n Zone Id ${Id}\n New Status: ${EventStr}`);
            });
            this.Outputs.on('OStatusChanged', (Id, EventStr) => {
                this.logger(this.log, Log_Level.DEBUG, `this.Outputs Status Changed :\n Output Id ${Id}\n New Status: ${EventStr}`);
            });
            this.Partitions.on('PStatusChanged', (Id, EventStr) => {
                this.logger(this.log, Log_Level.DEBUG, `this.Partition Status Changed :\n Partition Id ${Id}\n New Status: ${EventStr}`);
            });
            // Finally, system is ready
            this.emit('SystemInitComplete');
            this.logger(this.log, Log_Level.VERBOSE, `System initialization completed.`);
            this.WatchDog();
        });

        process.on('SIGINT', () => {
            this.logger(this.log, Log_Level.DEBUG, `Received SIGINT, Disconnecting`);
            this.Disconnect();
        });
        process.on('SIGTERM', () => {
            this.logger(this.log, Log_Level.DEBUG, `Received SIGTERM, Disconnecting`);
            this.Disconnect();
        });
        process.on('exit', () => {
            this.logger(this.log, Log_Level.DEBUG, `Process Exit, Disconnecting`);
            this.Disconnect();
        });
    }

    /*
     * Alias for the InitRPSocket function
     * For external call and manual Connexion
     */
    Connect() {
        this.RiscoComm.InitRPSocket();
    }

    /*
     * Causes the TCP socket to disconnect
     */
    Disconnect() {
        this.logger(this.log, Log_Level.VERBOSE, `Disconnecting from Panel.`);
        this.RiscoComm.Disconnect();
        this.ZonesReady = false;
        this.OutputsReady = false;
        this.PartitionsReady = false;
        this.SystemReady = false;
    }

    /*
     * Send a request every 5 seconds to maintain the connection
     */
    async WatchDog() {
        this.WatchDogTimer = setTimeout(async () => {
            if (this.RiscoComm.TCPSocket.IsConnected) {
                this.WatchDog();
                if (!this.RiscoComm.TCPSocket.InProg) {
                    return await this.RiscoComm.TCPSocket.SendCommand(`CLOCK`);
                }
            }
        }, 5000);
    }
}

class Agility extends RiscoPanel{
    constructor(Options) {
        Options.Panel_Type = PanelType.RW132;
        Options.Encoding = 'utf-8';
        // 32 natives zones + 4 zones with the X-10 Module
        Options.MaxZones = 36;
        Options.MaxParts = 3;
        // Options.MaxGroups = 4;
        // Only without X-10 Module
        Options.MaxOutputs = 4;
        super(Options);
    }
}

class WiComm extends RiscoPanel{
    constructor(Options) {
        Options.Panel_Type = PanelType.RW232;
        Options.Encoding = 'utf-8';
        // 32 natives zones + 4 zones with the X-10 module
        Options.MaxZones = 36;
        Options.MaxParts = 3;
        // Options.MaxGroups = 0;
        // Only with X-10 Module
        Options.MaxOutputs = 4;
        super(Options);
    }
}

class WiCommPro extends RiscoPanel{
    constructor(Options) {
        Options.Panel_Type = PanelType.RW332;
        Options.Encoding = 'utf-8';
        // 32 natives zones + 4 zones with the X-10 module
        Options.MaxZones = 36;
        Options.MaxParts = 3;
        // Options.MaxGroups = 0;
        // Only with X-10 Module
        Options.MaxOutputs = 4;
        // Maybe for future use 
        // Options.DoorLock = 3;
        super(Options);
    }
}

class LightSys extends RiscoPanel{
    constructor(Options) {
        Options.Panel_Type = PanelType.RP432;
        Options.Encoding = 'utf-8';
        Options.FWVersion_50Z_32O = '3.0';
        Options.MaxParts = 4;
        // Options.MaxGroups = 4;
        Options.MaxZones = (Panel_FW) => {
            if (this.RiscoComm.CompareVersion(Panel_FW, Options.FWVersion_50Z_32O) >= 0) {
                this.logger(this.log, Log_Level.DEBUG, `50 zones enabled`);
                return 50;
            } else {
                this.logger(this.log, Log_Level.DEBUG, `32 zones enabled`);
                return 32;
            }
        };
        Options.MaxOutputs = (Panel_FW) => {
            if (this.RiscoComm.CompareVersion(Panel_FW, Options.FWVersion_50Z_32O) >= 0) {
                this.logger(this.log, Log_Level.DEBUG, `32 outputs enabled`);
                return 32;
            } else {
                this.logger(this.log, Log_Level.DEBUG, `14 outputs enabled`);
                return 14;
            }
        };
        super(Options);
    }
}

class ProsysPlus extends RiscoPanel{
    constructor(Options) {
        Options.Panel_Type = PanelType.RP512;
        Options.Encoding = 'utf-8';
        Options.FWVersion_128Z = '1.2.0.7';
        Options.FWVersion_Pircam = '1.4.0.0';
        Options.MaxParts = 32;
        Options.MaxOutputs = 262;
        // Options.MaxGroups = 4;

        Options.MaxZones = (Panel_FW) => {
            // At the moment, only zones up to 128.
            // This plugin does not currently manage zones requiring the activation of a license.
            if (this.RiscoComm.CompareVersion(Panel_FW, Options.FWVersion_128Z) >= 0) {
                return 128;
            } else {
                return 64;
            }
        };
        super(Options);
    }
}

class GTPlus extends ProsysPlus{
    constructor(Options) {
        super(Options);
    }
}

module.exports = {
    Agility: Agility,
    WiComm: WiComm,
    WiCommPro: WiCommPro,
    LightSys: LightSys,
    ProsysPlus: ProsysPlus,
    GTPlus: GTPlus
}