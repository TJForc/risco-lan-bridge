/* 
 *  Package: risco-lan-bridge
 *  File: RiscoComm.js
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
const DirectSocket = require('./RiscoChannels').Risco_DirectTCP_Socket;
const ProxySocket = require('./RiscoChannels').Risco_ProxyTCP_Socket;
const Crypt = require('./RCrypt').Risco_Crypt;

const constants = require('./constants');
const Log_Level = constants.Log_Level;
const Risco_ErrorCode = constants.RiscoError;

const logger = require('./Logger').logger;
const log = require('./Logger').log;

const MBSystem = require('./Devices/System').MBSystem;
const ZoneList = require('./Devices/Zones').ZoneList;
const OutputList = require('./Devices/Outputs').OutputList;
const PartitionsList = require('./Devices/Partitions').PartitionsList;

const PanelType = constants.PanelType;

class RiscoComm extends EventEmitter {

    constructor(Options) {
        super();

        this.logger = ((Options.logger !== undefined) ? Options.logger : logger);
        this.log = ((Options.log !== undefined) ? Options.log : log);

        this.SocketOptions = {
            "Panel_Ip": (Options.Panel_IP || '192.168.0.100'),
            "Panel_Port": (Options.Panel_Port || 1000),
            "RCrypt": undefined,
            "Encoding": (Options.Encoding || 'utf-8'),
            "Password": (isNaN(Options.Panel_Password) ? 5678 : Options.Panel_Password),
            "DiscoverCode": ((Options.DiscoverCode !== undefined) ? Options.DiscoverCode : true),
            "ListeningPort": undefined,
            "CloudPort": undefined,
            "CloudUrl": undefined,
            "logger": this.logger,
            "log": this.log
        };

        this.CryptOptions = {
            "Panel_Id": (Options.Panel_Id || '0001'),
            "Encoding": (Options.Encoding || 'utf-8'),
            "logger": this.logger,
            "log": this.log
        };

        this.ReconnectDelay = (Options.ReconnectDelay || 10000);
        this.AutoConnect = ((Options.AutoConnect !== undefined) ? Options.AutoConnect : true);
        this.DisableRC = ((Options.Disable_RiscoCloud !== undefined) ? Options.Disable_RiscoCloud : true);
        this.EnableRC = ((Options.Enable_RiscoCloud !== undefined) ? Options.Enable_RiscoCloud : true);
        this.NtpServer = (Options.NtpServer || 'pool.ntp.org');
        this.NtpPort = (Options.NtpPort || '123');
        this.ProxyMode = ((Options.SocketMode !== undefined) ? Options.SocketMode : 'direct');

        switch (this.ProxyMode) {
            case 'proxy':
                this.SocketOptions.ListeningPort = (Options.ListeningPort || 33000);
                this.SocketOptions.CloudPort = (Options.CloudPort || 33000);
                this.SocketOptions.CloudUrl = (Options.CloudUrl || 'www.riscocloud.com');
                break;
            case 'rs232':
            case 'direct':
            default:
                break;
        }

        // this.MaxZones = Options.MaxZones;
        // this.MaxParts = Options.MaxParts;
        // // For future use
        // // this.MaxGroups = Options.MaxGroups;
        // this.MaxOutputs = Options.MaxOutputs;

        let now = new Date();
        this.GMT_TZ = (() => {
            let localTZ = (new Date(now.getFullYear(), 0, 1).getTimezoneOffset()) * -1;
            let hours = (Math.abs(Math.floor(localTZ / 60))).toLocaleString('en-US', {
                minimumIntegerDigits: 2,
                useGrouping: false
            });
            let minutes = (Math.abs(localTZ % 60)).toLocaleString('en-US', {
                minimumIntegerDigits: 2,
                useGrouping: false
            });
            let prefix = (localTZ >= 0) ? '+' : '-';
            this.logger(this.log, Log_Level.DEBUG, `Local GMT Timezone is : ${prefix}${hours}:${minutes}`);
            return `${prefix}${hours}:${minutes}`;
        })();

        this.Panel_FW = 0.0;

        this.IsConnected = false;

        this.AutoReConnectTimer = undefined;

        if (this.AutoConnect) {
            this.InitRPSocket();
        }
    }

    /*
     * Main function
     * Complete initialization of the Socket and connection to the control Panel.
     */
    async InitRPSocket() {
        this.logger(this.log, Log_Level.VERBOSE, `Start Connection to Panel`);
        //verify if listener exist before kill it
        if (this.TCPSocket !== undefined) {
            this.logger(this.log, Log_Level.DEBUG, `TCP Socket is already created, Connect It`);
            this.TCPSocket.removeAllListeners();
            await this.TCPSocket.TCPConnect();
        } else {
            this.logger(this.log, Log_Level.DEBUG, `TCP Socket is not already created, Create It`);
            this.RCrypt = null;
            this.TCPSocket = null;
            this.RCrypt = new Crypt(this.CryptOptions);
            this.SocketOptions.RCrypt = this.RCrypt;
            switch (this.ProxyMode) {
                case 'proxy':
                    this.TCPSocket = new ProxySocket(this.SocketOptions);
                    break;
                case 'rs232':
                case 'direct':
                default:
                    this.TCPSocket = new DirectSocket(this.SocketOptions);
                    break;
            }
        }
        this.logger(this.log, Log_Level.DEBUG, `TCP Socket must be created now`);

        this.TCPSocket.on('Disconnected', () => {
            this.logger(this.log, Log_Level.ERROR, `TCP Socket Disconnected`);
            if ((this.AutoConnect) && (this.AutoReConnectTimer === undefined)) {
                this.AutoReConnectTimer = setTimeout(r => {
                    this.AutoReConnectTimer = undefined;
                    this.InitRPSocket();
                }, this.ReconnectDelay);
            }
        });

        this.TCPSocket.on('DataReceived', async (data) => {
            await this.DataFromPanel(data);
        });

        this.TCPSocket.on('DataSent', async (data, sequence_Id) => {
            await this.DataFromPlugin(data, sequence_Id);
        });

        this.TCPSocket.on('PanelConnected', async () => {
            this.logger(this.log, Log_Level.DEBUG, `Risco Panel Connected.`);
            await this.GetPanel_Type();
            await this.GetPanel_FwVersion();
            this.applyPanelOptions();
            const CommandsArr = await this.VerifyPanelConfiguration();

            if ((CommandsArr !== undefined) && (CommandsArr.length >= 1)) {
                await this.TCPSocket.ModifyPanelConfig(CommandsArr);
                do {
                    await new Promise(r => setTimeout(r, 5000));
                } while (this.TCPSocket.InProg)
            }
            // Finally, Communication is ready
            this.emit('PanelCommReady');
        });
    }

    /*
     * Compare Received data with different (and possible) value
     * @param {string}
     */
    async DataFromPanel(data) {
        this.logger(this.log, Log_Level.DEBUG, `Received From Panel : ${data}`);
        switch (true) {
            case (data.includes('ACK')):
                break;
            case (data.startsWith('N')):
            case (data.startsWith('B')):
                if ((Object.keys(Risco_ErrorCode)).includes(data)) {
                    this.logger(this.log, Log_Level.VERBOSE, `Receipt of an error code: ${Risco_ErrorCode[data]}`);
                } else {
                    this.logger(this.log, Log_Level.VERBOSE, `Data incomprehensible : ${data}`);
                }
                break;
            case (data.startsWith('OSTT')):
                this.logger(this.log, Log_Level.DEBUG, `Output Status data.`);
                this.emit('NewOutputStatusFromPanel', data);
                break;
            case (data.startsWith('PSTT')):
                this.logger(this.log, Log_Level.DEBUG, `Partition Status data.`);
                this.emit('NewPartitionStatusFromPanel', data);
                break;
            case (data.startsWith('SSTT')):
                this.logger(this.log, Log_Level.DEBUG, `System Status datas.`);
                if (this.TCPSocket.InProg && (data.includes('I') !== true)) {
                    this.TCPSocket.InProg = false;
                    this.logger(this.log, Log_Level.DEBUG, `Control unit exiting Programming mode.`);
                }
                this.emit('NewMBSystemStatusFromPanel', data);
                break;
            case (data.startsWith('ZSTT')):
                this.logger(this.log, Log_Level.DEBUG, `Zone Status datas.`);
                this.emit('NewZoneStatusFromPanel', data);
                break;
            case (data.startsWith('CLOCK')):
                this.logger(this.log, Log_Level.DEBUG, `Clock datas.`);
                this.emit('Clock', data);
                break;
            case (data.includes('STT')):
                // for hardawre state (Keypad, Zone Extension, ....)
                this.logger(this.log, Log_Level.DEBUG, `Hardware Status datas.`);
                break;
        }
    }

    /*
     *  For debug only
     */
    async DataFromPlugin(data, Sequence_Id) {
        this.logger(this.log, Log_Level.DEBUG, `Sequence : ${Sequence_Id} - Data Sent : ${data}`);
    }

    /*
     * Retrieve and store the panel type
     */
    async GetPanel_Type() {
        let PType = undefined;
        do {
            PType = await this.TCPSocket.GetResult('PNLCNF');
        } while (PType === undefined);
        this.PanelTypeName = PType;
        this.Panel_Type = PanelType[PType];
    }

    applyPanelOptions() {
        switch (this.Panel_Type) {
            case PanelType.RW132:
                this.PanelModel = 'Agility';
                this.MaxZones = 36;
                this.MaxParts = 3;
                this.MaxOutputs = 4;
                this.SupportPirCam = false;
                break;
            case PanelType.RW232:
                this.PanelModel = 'WiComm';
                this.MaxZones = 36;
                this.MaxParts = 3;
                this.MaxOutputs = 4;
                this.SupportPirCam = false;
                break;
            case PanelType.RW332:
                this.PanelModel = 'WiCommPro';
                this.MaxZones = 36;
                this.MaxParts = 3;
                this.MaxOutputs = 4;
                this.SupportPirCam = false;
                break;
            case PanelType.RP432:
                this.PanelModel = 'LightSys';
                this.MaxParts = 4;
                if (this.CompareVersion(this.Panel_FW, '3.0') >= 0) {
                    this.MaxZones = 50;
                    this.MaxOutputs = 32;
                } else {
                    this.MaxZones = 32;
                    this.MaxOutputs = 14;
                }
                this.SupportPirCam = false;
                break;
            case PanelType.RP512:
                this.PanelModel = 'ProsysPlus|GTPlus';
                this.MaxParts = 32;
                this.MaxOutputs = 262;
                // At the moment, only zones up to 128.
                // This plugin does not currently manage zones requiring the activation of a license.
                if (this.CompareVersion(this.Panel_FW, '1.2.0.7') >= 0) {
                    this.MaxZones = 128;
                } else {
                    this.MaxZones = 64;
                }
                this.logger(this.log, Log_Level.DEBUG, `${this.MaxZones} zones enabled`);

                if (this.CompareVersion(this.Panel_FW, '1.4.0.0') >= 0) {
                    this.logger(this.log, Log_Level.VERBOSE, 'PirCam not supported for now.');
                    this.SupportPirCam = false;
                } else {
                    this.logger(this.log, Log_Level.VERBOSE, 'PirCam not supported for now (Too Low Firmware version).');
                    this.SupportPirCam = false;
                }
                break;
            default: throw new Error(`Unsupported panel type : ${this.Panel_Type}`)
        }
        this.logger(this.log, Log_Level.INFO, `Panel info: ${this.PanelModel}/${this.PanelTypeName}, FW ${this.Panel_FW || 'Unknown'}`);
        this.logger(this.log, Log_Level.INFO, `Panel options: ${this.MaxParts} parts, ${this.MaxZones} zones, ${this.MaxOutputs} outputs, Pir Cam support: ${this.SupportPirCam}`);
    }

    /*
     * Retrieve the version of Panel (only for LightSys and Prosys Plus)
     * This information is needed to set the hardware limits that have 
     * been changed from some firmware versions.
     */
    async GetPanel_FwVersion() {
        if (this.Panel_Type === PanelType.RP432 || this.Panel_Type === PanelType.RP512) {
            let FwVersion = '';
            try {
                FwVersion = await this.TCPSocket.GetResult('FSVER?');
                FwVersion = FwVersion.substring(0, FwVersion.indexOf(' '));
            } catch (err) {
                this.logger(this.log, Log_Level.ERROR, `Cannot retrieve Firmware Version.`);
            }
            this.Panel_FW = (FwVersion !== '') ? FwVersion : this.Panel_FW;
            this.logger(this.log, Log_Level.DEBUG, `Panel Firmware Version : ${this.Panel_FW}`);
        }
    }

    /*
     * Checks if the panel programming needs to be changed according to the options selected
     * @return  {Array of String}     String Command to be send to the Panel
     */
    async VerifyPanelConfiguration() {
        // Check the programming of the Risco Cloud according to the deactivation parameters
        let CommandArray = new Array(0);
        this.logger(this.log, Log_Level.DEBUG, `Checking the configuration of the control unit.`);

        if (this.DisableRC && !this.EnableRC) {

            // Disabling RiscoCloud can lead to a time desynchronization if the control panel time 
            // zone is not correctly configured (when the riscoCloud is configured, it is it 
            // which keeps the system on time).
            let RCloudStatus = await this.TCPSocket?.GetIntResult('ELASEN?');
            if (RCloudStatus) {
                CommandArray.push('ELASEN=0');
                this.logger(this.log, Log_Level.DEBUG, `Prepare Panel for Disabling RiscoCloud.`);
            }
            // Check if the time zone is correctly configured
            let PanelTZ = await this.TCPSocket.GetResult('TIMEZONE?');
            let PanelNtpServer = await this.TCPSocket.GetResult('INTP?');
            let PanelNtpPort = await this.TCPSocket.GetResult('INTPP?');
            let PanelNtpProto = await this.TCPSocket.GetResult('INTPPROT?');

            let TimeZoneStr = constants.TimeZoneStr;
            if (TimeZoneStr[PanelTZ] !== this.GMT_TZ) {
                const newPanelTZ = Object.keys(TimeZoneStr).find(key => TimeZoneStr[key] === this.GMT_TZ);
                CommandArray.push(`TIMEZONE=${newPanelTZ}`);
                this.logger(this.log, Log_Level.DEBUG, `Prepare Panel for Updating TimeZone.`);
            }
            if (PanelNtpServer !== this.NtpServer) {
                CommandArray.push(`INTP=${this.NtpServer}`);
                this.logger(this.log, Log_Level.DEBUG, `Prepare Panel for Updating NTP Server Address.`);
            }
            if (PanelNtpPort !== this.NtpPort) {
                CommandArray.push(`INTPP=${this.NtpPort}`);
                this.logger(this.log, Log_Level.DEBUG, `Prepare Panel for Updating NTP Server Port.`);
            }
            if (PanelNtpProto !== '1') {
                CommandArray.push('INTPPROT=1');
                this.logger(this.log, Log_Level.DEBUG, `Prepare Panel for Enabling Server.`);
            }
        } else if (this.EnableRC && !this.DisableRC) {
            // Enabling RiscoCloud
            let RCloudStatus = await this.TCPSocket.GetIntResult('ELASEN?');
            if (!RCloudStatus) {
                CommandArray.push('ELASEN=1');
                this.logger(this.log, Log_Level.DEBUG, `Enabling RiscoCloud.`);
            }
        }

        if ((this.Panel_Type !== PanelType.RP432) && (this.Panel_Type !== PanelType.RP512) && (this.SupportPirCam)) {
            //Check 'Photo Server' Config
        }
        return CommandArray;
    }

    /* 
     * Version comparison function
     * @param   {String}      vPanel (Panel version Number)
     * @param   {String}      vNewCapacity (version unlocking new features)
     */
    CompareVersion(vPanel, vNewCapacity) {
        if (vPanel === vNewCapacity) {
            return 0;
        }
        let vPanel_components = vPanel.split('.');
        let vNewCapacity_components = vNewCapacity.split('.');
        let len = Math.min(vPanel_components.length, vNewCapacity_components.length);

        // loop while the components are equal
        for (let i = 0; i < len; i++) {
            // A bigger than B
            if (parseInt(vPanel_components[i]) > parseInt(vNewCapacity_components[i])) {
                return 1;
            }
            // B bigger than A
            if (parseInt(vPanel_components[i]) < parseInt(vNewCapacity_components[i])) {
                return -1;
            }
        }
    }

    /*
     * Causes the TCP socket to disconnect
     */
    async Disconnect() {
        if (this.TCPSocket !== undefined) {
            await this.TCPSocket.Disconnect();
        }
    }

    /*
     * function alias to the function of the same name included 
     * in the class Risco_DirectTCP_Socket
     */
    async DisableRiscoCloud() {
        if (this.DisableRC) {
            await this.TCPSocket.DisableRiscoCloud();
        } else {
            this.logger(this.log, Log_Level.DEBUG, `Disabling RiscoCloud functionality is not allowed.`);
        }
    }

    /*
     * function alias to the function of the same name included 
     * in the class Risco_DirectTCP_Socket 
     */
    async EnableRiscoCloud() {
        if (this.EnableRC) {
            await this.TCPSocket.EnableRiscoCloud();
        } else {
            this.logger(this.log, Log_Level.DEBUG, `Enabling RiscoCloud functionality is not allowed.`);
        }
    }

    /*
     * Queries the panel to retrieve information for all zones
     * @param   {ZoneList}    ZoneList Object     Empty Object 
     * @return  {ZoneList}    ZoneList Object     Populated Object or new Object if fails
     */
    GetAllZonesDatas(ZonesLst) {
        return new Promise(async (resolve, reject) => {
            this.logger(this.log, Log_Level.DEBUG, `Retrieving the configuration of the Zones.`);
            try {
                let MaxZ = this.MaxZones;
                for (let i = 0; i < (MaxZ / 8); i++) {
                    let min = (i * 8) + 1;
                    let max = ((i + 1) * 8);
                    max = (max > MaxZ) ? MaxZ : max;

                    let ZType = await this.TCPSocket.GetResult(`ZTYPE*${min}:${max}?`);
                    ZType = ZType.replace(/ /g, '').split('\t');
                    let ZParts = await this.TCPSocket.GetResult(`ZPART&*${min}:${max}?`);
                    ZParts = ZParts.replace(/ /g, '').split('\t');
                    let ZGroups = await this.TCPSocket.GetResult(`ZAREA&*${min}:${max}?`);
                    ZGroups = ZGroups.replace(/ /g, '').split('\t');
                    let ZLabels = await this.TCPSocket.GetResult(`ZLBL*${min}:${max}?`);
                    ZLabels = ZLabels.split('\t');
                    let ZStatus = await this.TCPSocket.GetResult(`ZSTT*${min}:${max}?`);
                    ZStatus = ZStatus.replace(/ /g, '').split('\t');
                    let ZTechno = new Array(max - min + 1).fill(0);
                    for (let j = 0; j < (max - min + 1); j++) {
                        ZTechno[j] = await this.TCPSocket.GetResult(`ZLNKTYP${min + j}?`);
                    }

                    for (let j = 0; j < (max - min + 1); j++) {
                        let Item = ZonesLst.ById(min + j);
                        Item.Id = min + j;
                        Item.Label = ZLabels[j];
                        Item.Type = ZType[j];
                        Item.Techno = ZTechno[j];
                        Item.Partitions = ZParts[j];
                        Item.Groups = ZGroups[j];
                        Item.Status = ZStatus[j];
                    }
                }
                resolve([true, ZonesLst]);
            } catch (err) {
                resolve([false, new ZoneList(this.MaxZones, this)]);
            }
        });
    }

    /*
     * Queries the panel to retrieve up to date information for specified zone
     * @param   {Integer}     Zone Id           Id of the Selected Zone
     * @param   {ZoneList}    ZoneList Object   
     * @return  {Zones}       Zone Object       Object representing the Zone
     */
    GetZoneStatus(Id, ZonesLst) {
        return new Promise(async (resolve, reject) => {
            this.logger(this.log, Log_Level.DEBUG, `Retrieving the zone's status.`);
            try {
                let ZType = await this.TCPSocket.GetResult(`ZTYPE*${Id}?`);
                let ZParts = await this.TCPSocket.GetResult(`ZPART&*${Id}?`);
                let ZGroups = await this.TCPSocket.GetResult(`ZAREA&*${Id}?`);
                let ZLabels = await this.TCPSocket.GetResult(`ZLBL*${Id}?`);
                let ZStatus = await this.TCPSocket.GetResult(`ZSTT*${Id}?`);
                let ZTechno = await this.TCPSocket.GetResult(`ZLNKTYP${Id}?`);
                //TODO: use constants.RiscoError
                ZTechno = (!ZTechno.startsWith('N')) ? ZTechno : 'E';

                let Item = ZonesLst.ById(Id);
                Item.Label = ZLabels.trim();
                Item.Type = ZType;
                Item.Techno = ZTechno;
                Item.Partitions = ZParts;
                Item.Groups = ZGroups;
                Item.Status = ZStatus;
                resolve([true, ZonesLst.ById(Id)]);
            } catch (err) {
                resolve([false, ZonesLst.ById(Id)]);
            }
        });
    }

    /*
     * Queries the panel to retrieve information from all outputs
     * @param   {OutputList}    OutputList Object     Empty Object 
     * @return  {OutputList}    OutputList Object     Populated Object or new Object if fails
     */
    GetAllOutputsDatas(OutputLst) {
        return new Promise(async (resolve, reject) => {
            this.logger(this.log, Log_Level.DEBUG, `Retrieving the configuration of the Outputs.`);
            try {
                let MaxO = this.MaxOutputs;
                for (let i = 0; i < (MaxO / 8); i++) {
                    let min = (i * 8) + 1;
                    let max = ((i + 1) * 8);
                    max = (max > MaxO) ? MaxO : max;

                    let OType = await this.TCPSocket.GetResult(`OTYPE*${min}:${max}?`);
                    OType = OType.replace(/ /g, '').split('\t');
                    let OLabels = await this.TCPSocket.GetResult(`OLBL*${min}:${max}?`);
                    OLabels = OLabels.split('\t');
                    let OStatus = await this.TCPSocket.GetResult(`OSTT*${min}:${max}?`);
                    OStatus = OStatus.replace(/ /g, '').split('\t');
                    let OGrops = await this.TCPSocket.GetResult(`OGROP*${min}:${max}?`);
                    OGrops = OGrops.replace(/ /g, '').split('\t');
                    for (let j = 0; j < (max - min + 1); j++) {
                        let Item = OutputLst.ById(min + j);
                        Item.Id = min + j;
                        Item.Label = OLabels[j].trim();
                        Item.Type = OType[j];
                        if (OType[j] % 2 === 0) {
                            let OPulseDelay = await this.TCPSocket.GetResult(`OPULSE${min + j}?`);
                            Item.PulseDelay = parseInt(OPulseDelay.replace(/ /g, ''), 10) * 1000;
                        } else {
                            Item.PulseDelay = 0;
                        }
                        Item.Status = OStatus[j];
                        Item.UserUsuable = OGrops[j] === '4';
                    }
                }
                resolve([true, OutputLst]);
            } catch (err) {
                resolve([false, new OutputList(this.MaxOutputs, this)]);
            }
        });
    }

    /*
     * Queries the panel to retrieve information for specified output
     * @param   {Integer}     Output Id         Id of the Selected Output
     * @param   {OutputList}  OutputList Object
     * @return  {Output}      Output Object     Object representing the Output
     */
    GetOutputStatus(Id, OutputLst) {
        return new Promise(async (resolve, reject) => {
            this.logger(this.log, Log_Level.DEBUG, `Retrieving the Output's status.`);
            try {
                let OType = await this.TCPSocket.GetResult(`OTYPE${Id}?`);
                let OLabels = await this.TCPSocket.GetResult(`OLBL${Id}?`);
                let OStatus = await this.TCPSocket.GetResult(`OSTT*${Id}?`);

                let Item = OutputLst.ById(Id);
                Item.Label = OLabels.trim();
                Item.Type = OType;
                Item.Status = OStatus;
                resolve([true, OutputLst.ById(Id)]);
            } catch (err) {
                resolve([false, OutputLst.ById(Id)]);
            }
        });
    }

    /*
     * Queries the panel to retrieve information from all Partition
     * @param   {PartitionsList}    PartitionsList Object     Empty Object 
     * @return  {PartitionsList}    PartitionsList Object     Populated Object or new Object if fails
     */
    GetAllPartitionsDatas(PartitionsLst) {
        return new Promise(async (resolve, reject) => {
            this.logger(this.log, Log_Level.DEBUG, `Retrieving the configuration of the Partitions.`);
            try {
                let MaxP = this.MaxParts;
                for (let i = 0; i < (MaxP / 8); i++) {
                    let min = (i * 8) + 1;
                    let max = ((i + 1) * 8);
                    max = (max > MaxP) ? MaxP : max;

                    let PLabels = await this.TCPSocket.GetResult(`PLBL*${min}:${max}?`);
                    PLabels = PLabels.split('\t');
                    let PStatus = await this.TCPSocket.GetResult(`PSTT*${min}:${max}?`);
                    PStatus = PStatus.replace(/ /g, '').split('\t');

                    for (let j = 0; j < (max - min + 1); j++) {
                        let Item = PartitionsLst.ById(min + j);
                        Item.Id = min + j;
                        Item.Label = PLabels[j].trim();
                        Item.Status = PStatus[j];
                    }
                }
                resolve([true, PartitionsLst]);
            } catch (err) {
                resolve([false, new PartitionsList(this.MaxParts, this)]);
            }
        });
    }

    /*
     * Queries the panel to retrieve information for specified Partition
     * @param   {Integer}           Partition Id            Id of the Selected Partition
     * @param   {PartitionsList}    PartitionsList Object
     * @return  {Output}            Partition Object        Object representing the Partition
     */
    GetPartitionsStatus(Id, PartitionsLst) {
        return new Promise(async (resolve, reject) => {
            this.logger(this.log, Log_Level.DEBUG, `Retrieving the Partition's status.`);
            try {
                let PLabels = await this.TCPSocket.GetResult(`PLBL${Id}?`);
                let PStatus = await this.TCPSocket.GetResult(`PSTT${Id}?`);

                let Item = PartitionsLst.ById(Id);
                Item.Label = PLabels.trim();
                Item.Status = PStatus;

                resolve([true, PartitionsLst.ById(Id)]);
            } catch (err) {
                resolve([false, PartitionsLst.ById(Id)]);
            }
        });
    }

    /*
     * Queries needed info for System Object
     * @return  {MBSystem}    MBSystem Object     Populated Object or new Object if fails
     */
    GetSystemDatas() {
        return new Promise(async (resolve, reject) => {
            this.logger(this.log, Log_Level.DEBUG, `Retrieving System's Information.`);
            try {
                let SLabel = await this.TCPSocket.GetResult(`SYSLBL?`);
                let SStatus = await this.TCPSocket.GetResult(`SSTT?`);

                resolve([true, new MBSystem(SLabel, SStatus)]);
            } catch (err) {
                resolve([false, new MBSystem('', '---------------------')]);
            }
        });
    }
}

module.exports = {
    RiscoComm: RiscoComm
}