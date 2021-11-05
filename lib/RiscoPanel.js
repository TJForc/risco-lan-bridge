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
const RiscoComm = require('./RiscoComm').RiscoComm;

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
        this.WatchDogInterval = ((Options.WatchDogInterval !== undefined) ? Options.WatchDogInterval : 5000);
        this.RiscoComm = new RiscoComm(Options);

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

        this.RiscoComm.TCPSocket.on('IncomingRemoteConnection', () => {
            this.logger(this.log, Log_Level.DEBUG, `Start of remote connection detected.`);
            if (this.WatchDogTimer !== undefined) {
                clearTimeout(this.WatchDogTimer);
            }
        });
        this.RiscoComm.TCPSocket.on('EndIncomingRemoteConnection', () => {
            this.logger(this.log, Log_Level.DEBUG, `Remote connection end detected.`);
            if (this.RiscoComm.TCPSocket.IsConnected) {
                this.WatchDog();
            }
        });
        this.RiscoComm.on('PanelCommReady', async () => {

            this.MaxZones = this.RiscoComm.MaxZones;
            this.MaxParts = this.RiscoComm.MaxParts;
            // this.MaxGroups = Options.MaxGroups;
            this.MaxOutputs = this.RiscoComm.MaxOutputs;

            this.MBSystem = new MBSystem('', '---------------------');
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

            this.MBSystem.on('SStatusChanged', (EventStr) => {
                this.logger(this.log, Log_Level.DEBUG, `MBSystem Status Changed :\n New Status: ${EventStr}`);
            });
            this.MBSystem.on('ProgModeOn', () => {
                if (!this.MBSystem.NeedUpdateConfig) {
                    Object.values(this.Zones).forEach(zone => {
                        zone.NeedUpdateConfig = true;
                    });
                    Object.values(this.Outputs).forEach(output => {
                        output.NeedUpdateConfig = true;
                    });
                    Object.values(this.Partitions).forEach(partition => {
                        partition.NeedUpdateConfig = true;
                    });
                    this.MBSystem.NeedUpdateConfig = true;
                    const WarnUpdate = () => {
                        this.logger(this.log, Log_Level.ERROR, `Panel configuration has been changed since connection was established.`);
                        this.logger(this.log, Log_Level.ERROR, `Please restart your plugin and its configuration to take into account the changes and avoid any abnormal behavior.`);
                    }
                    WarnUpdate();
                    setInterval(r => {
                        WarnUpdate();
                    }, 60000);
                }
            });
            this.Zones.on('ZStatusChanged', (Id, EventStr) => {
                this.logger(this.log, Log_Level.DEBUG, `Zones Status Changed :\n Zone Id ${Id}\n New Status: ${EventStr}`);
            });
            this.Outputs.on('OStatusChanged', (Id, EventStr) => {
                this.logger(this.log, Log_Level.DEBUG, `Outputs Status Changed :\n Output Id ${Id}\n New Status: ${EventStr}`);
            });
            this.Partitions.on('PStatusChanged', (Id, EventStr) => {
                this.logger(this.log, Log_Level.DEBUG, `Partition Status Changed :\n Partition Id ${Id}\n New Status: ${EventStr}`);
            });

            // Listen Event for new Status from Panel
            this.RiscoComm.on('NewZoneStatusFromPanel', (data) => {
                if (this.Zones !== undefined) {
                    let ZId = parseInt(data.substring(data.indexOf('ZSTT') + 4, data.indexOf('=')), 10);
                    if (!isNaN(ZId)) {
                        let ZStatus = data.substring(data.indexOf('=') + 1);
                        this.Zones.ById(ZId).Status = ZStatus;
                    }
                }
            });
            this.RiscoComm.on('NewOutputStatusFromPanel', (data) => {
                if (this.Outputs !== undefined) {
                    let OId = parseInt(data.substring(data.indexOf('OSTT') + 4, data.indexOf('=')), 10);
                    if (!isNaN(OId)) {
                        let OStatus = data.substring(data.indexOf('=') + 1);
                        this.Outputs.ById(OId).Status = OStatus;
                    }
                }
            });
            this.RiscoComm.on('NewPartitionStatusFromPanel', (data) => {
                if (this.Partitions !== undefined) {
                    let PId = parseInt(data.substring(data.indexOf('PSTT') + 4, data.indexOf('=')), 10);
                    if (!isNaN(PId)) {
                        let PStatus = data.substring(data.indexOf('=') + 1);
                        this.Partitions.ById(PId).Status = PStatus;
                    }
                }
            });
            this.RiscoComm.on('NewMBSystemStatusFromPanel', (data) => {
                if (this.MBSystem !== undefined) {
                    let SStatus = data.substring(data.indexOf('=') + 1);
                    this.MBSystem.Status = SStatus;
                }
            });

            // Finally, system is ready
            this.emit('SystemInitComplete');
            this.logger(this.log, Log_Level.VERBOSE, `System initialization completed.`);
            this.WatchDog();
        });

        process.on('SIGINT', async () => {
            this.logger(this.log, Log_Level.DEBUG, `Received SIGINT, Disconnecting`);
            await this.Disconnect(true);
            process.exit(0)
        });
        process.on('SIGTERM', async () => {
            this.logger(this.log, Log_Level.DEBUG, `Received SIGTERM, Disconnecting`);
            await this.Disconnect(true);
            process.exit(0)
        });
    }

    /*
     * Alias for the InitRPSocket function
     * For external call and manual Connexion
     */
    async Connect() {
        await this.RiscoComm.InitRPSocket();
    }

    /*
     * Causes the TCP socket to disconnect
     */
    async Disconnect(clearAutoConnect) {
        this.logger(this.log, Log_Level.VERBOSE, `Disconnecting from Panel.`);
        if (clearAutoConnect) {
            this.RiscoComm.AutoConnect = false
        }
        await this.RiscoComm.Disconnect();
        this.ZonesReady = false;
        this.OutputsReady = false;
        this.PartitionsReady = false;
        this.SystemReady = false;
    }

    /*
     * Send a request at a fixed delay to maintain the connection
     */
    WatchDog() {
        this.WatchDogTimer = setTimeout(async () => {
            if (this.RiscoComm.TCPSocket.IsConnected) {
                this.WatchDog();
                if (!this.RiscoComm.TCPSocket.InProg) {
                    return await this.RiscoComm.TCPSocket.SendCommand(`CLOCK`);
                }
            }
        }, this.WatchDogInterval);
    }

    /*
     * Arm the selected partition
     * @param   {Integer}     Id          Id Of selected PArtition
     * @param   {Integer}     ArmType     Type of arm (immediat(0) or Partial/stay(1))
     * @return  {Boolean}
     * 
     * TODO : find command for temporised arming
     */
    ArmPart(Id, ArmType) {
        return new Promise(async (resolve, reject) => {
            this.logger(this.log, Log_Level.DEBUG, `Request for Full/Stay Arming a Partition.`);
            try {
                if ((Id > this.Partitions.length) || (Id < 0)) {
                    resolve(false);
                }
                let SelectedPart = this.Partitions.ById(Id);
                if (!SelectedPart.Ready && SelectedPart.Open) {
                    resolve(false);
                }
                if ((SelectedPart.Arm && (ArmType === 0)) || (SelectedPart.HomeStay && (ArmType === 1))) {
                    resolve(true);
                } else {
                    let ArmTypeStr = Object.freeze({
                        0: 'ARM',
                        1: 'STAY',
                    });
                    let ArmResult = await this.RiscoComm.TCPSocket.GetAckResult(`${ArmTypeStr[ArmType]}=${Id}`);

                    resolve(ArmResult);
                }
            } catch (err) {
                this.logger(this.log, Log_Level.ERROR, `Failed to Full/Stay Arming the Partition : ${Id}`);
                resolve(false)
            }
        });
    }

    /*
     * Disarm the selected partition
     * @param   {Integer}     Id          Id Of selected PArtition
     * @return  {Boolean}
     */
    DisarmPart(Id) {
        return new Promise(async (resolve, reject) => {
            this.logger(this.log, Log_Level.DEBUG, `Request for Disarming a Partition.`);
            try {
                if ((Id > this.Partitions.length) || (Id < 0)) {
                    resolve(false);
                }
                let SelectedPart = this.Partitions.ById(Id);
                if (!SelectedPart.Arm && !SelectedPart.HomeStay) {
                    resolve(true);
                } else {
                    let DisarmResult = await this.RiscoComm.TCPSocket.GetAckResult(`DISARM=${Id}`);
                    resolve(DisarmResult);
                }
            } catch (err) {
                this.logger(this.log, Log_Level.ERROR, `Failed to disarm the Partition : ${Id}`);
                resolve(false);
            }
        });
    }

    /*
     * Bypass or UnBypass the selected Zone
     * @param   {Integer}     Id          Id Of selected Zone
     * @return  {Boolean}
     */
    ToggleBypassZone(Id) {
        return new Promise(async (resolve, reject) => {
            this.logger(this.log, Log_Level.DEBUG, `Request for Bypassing/UnBypassing a Zone.`);
            try {
                if ((Id > this.Zones.length) || (Id < 0)) {
                    resolve(false);
                }
                let BypassResult = await this.RiscoComm.TCPSocket.GetAckResult(`ZBYPAS=${Id}`);

                resolve(BypassResult);
            } catch (err) {
                this.logger(this.log, Log_Level.ERROR, `Failed to Bypass/UnBypass Zone : ${Id}`);
                resolve(false);
            }
        });
    }

    /*
     * Toggle Output
     * @param   {Integer}     Id          Id Of selected Output
     * @return  {Boolean}
     */
    ToggleOutput(Id) {
        return new Promise(async (resolve, reject) => {
            this.logger(this.log, Log_Level.DEBUG, `Request for Toggle an Output.`);
            try {
                if ((Id > this.Outputs.length) || (Id < 0)) {
                    resolve(false);
                }
                let ActOutputResult = await this.RiscoComm.TCPSocket.GetAckResult(`ACTUO${Id}`);
                resolve(ActOutputResult);
            } catch (err) {
                this.logger(this.log, Log_Level.ERROR, `Failed to Toggle Output : ${Id}`);
                resolve(false);
            }
        });
    }
}

class Agility extends RiscoPanel {
    constructor(Options) {
        Options.Panel_Type = PanelType.RW132;
        super(Options);
    }
}

class WiComm extends RiscoPanel {
    constructor(Options) {
        Options.Panel_Type = PanelType.RW232;
        super(Options);
    }
}

class WiCommPro extends RiscoPanel {
    constructor(Options) {
        Options.Panel_Type = PanelType.RW332;
        super(Options);
    }
}

class LightSys extends RiscoPanel {
    constructor(Options) {
        Options.Panel_Type = PanelType.RP432;
        super(Options);
    }
}

class ProsysPlus extends RiscoPanel {
    constructor(Options) {
        Options.Panel_Type = PanelType.RP512;
        super(Options);
    }
}

class GTPlus extends ProsysPlus {
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
    GTPlus: GTPlus,
    RiscoPanel: RiscoPanel
}
