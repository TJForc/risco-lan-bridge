/* 
 *  Package: risco-lan-bridge
 *  File: RiscoDirectTCP.js
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
const Socket = require('./Socket').Risco_Socket;
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

class RiscoDirectTCP extends EventEmitter {
    constructor(Options) {
        super();
        this.Host = (Options.Panel_IP|| '192.168.0.100');
        this.Port = (Options.Panel_Port || 1000);
        this.Password = (isNaN(Options.Panel_Password) ? 5678 : Options.Panel_Password);
        this.Panel_Id = (Options.Panel_Id || '0001');
        this.Panel_Type = (Options.Panel_Type || PanelType.RW132);
        
        this.logger = ((Options.logger !== undefined) ? Options.logger : logger);
        this.log = ((Options.log !== undefined) ? Options.log : log);

        this.ReconnectDelay = (Options.ReconnectDelay || 10000);
        this.AutoConnect = ((Options.AutoConnect !== undefined) ? Options.AutoConnect : true);
        this.DiscoverCode = ((Options.DiscoverCode !== undefined) ? Options.DiscoverCode : true);
        this.DisableRC = ((Options.Disable_RiscoCloud !== undefined) ? Options.Disable_RiscoCloud : true);
        this.NtpServer = (Options.NtpServer || 'pool.ntp.org');
        this.NtpPort = (Options.NtpPort || '123');

        this.MaxZones = Options.MaxZones;
        this.MaxParts = Options.MaxParts;
        // this.MaxGroups = Options.MaxGroups;
        this.MaxOutputs = Options.MaxOutputs;

        this.Zones = undefined;
        this.Outputs = undefined;
        this.Partitions = undefined;
        this.Groups = undefined;
        this.MBSystem = undefined;

        this.SupportPirCam = (() => {
            if ((this.Panel_Type == PanelType.RP432) || (this.Panel_Type == PanelType.RP512)) {
                this.logger(this.log, Log_Level.VERBOSE, 'PirCam cannot be supported.');
                return false;
            } else if (this.Panel_Type == PanelType.RP512) {
                if (this.CompareVersion(this.Panel_FW, this.FWVersion_Pircam) >= 0) {
                    // For future use
                    // return ((Options.SupportPirCam !== undefined) ? Options.SupportPirCam : false);
                    this.logger(this.log, Log_Level.VERBOSE, 'PirCam not supported for now.');
                    return false;
                } else {
                    this.logger(this.log, Log_Level.VERBOSE, 'PirCam not supported for now (Too Low Firmware version).');
                    return false;
                } 
            } else {
                // For future use
                // return ((Options.SupportPirCam !== undefined) ? Options.SupportPirCam : false);
                this.logger(this.log, Log_Level.VERBOSE, 'PirCam not supported for now.');
                return false;
            }
        });
        let now = new Date();
        this.GMT_TZ = (() => {
            let localTZ = (new Date(now.getFullYear(), 0, 1).getTimezoneOffset()) * -1 ;
            let hours = (Math.abs(Math.floor(localTZ / 60))).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping:false});
            let minutes = (Math.abs(localTZ % 60)).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping:false});
            let prefix = (localTZ >= 0)?'+':'-';
            this.logger(this.log, Log_Level.DEBUG, `Local GMT Timezone is : ${prefix}${hours}:${minutes}`);
            return `${prefix}${hours}:${minutes}`;
        })();

        this.Panel_FW = 0.0;

        this.IsConnected = false;

        if (this.AutoConnect) {
            this.InitRPSocket();
        }
    }

    /*
     * Main function
     * Complete initialization of the Socket and connection to the control Panel.
     */
    InitRPSocket() {
        this.logger(this.log, Log_Level.VERBOSE, `Start Connection to Panel`);
        //verify if listener exist before kill it
        if (this.TCPSocket !== undefined) {
            this.logger(this.log, Log_Level.DEBUG, `TCP Socket is already created, Connect It`);
            this.TCPSocket.removeAllListeners();
            this.TCPSocket.TCPConnect();
        } else {
            this.logger(this.log, Log_Level.DEBUG, `TCP Socket is not already created, Create It`);
            this.RCrypt = null;    
            this.TCPSocket = null;
            this.RCrypt = new Crypt(this.Panel_Id, this.Panel_Type, this.Encoding, this.logger, this.log);
            this.TCPSocket = new Socket(this.Host, this.Port, this.RCrypt, this.Encoding, this.Password, this.DiscoverCode, this.logger, this.log);
        }
        this.logger(this.log, Log_Level.DEBUG, `TCP Socket must be connected now`);

        this.TCPSocket.on('Disconnected', () => {
            this.logger(this.log, Log_Level.ERROR, `TCP Socket Disconnected`);
            this.IsConnected = false;
            setTimeout( r => this.InitRPSocket(), this.ReconnectDelay);
        });

        this.TCPSocket.on('DataReceived', (data) => {
            this.DataFromPanel(data);
        });

        this.TCPSocket.on('DataSent', (data, sequence_Id) => {
            this.DataFromPlugin(data, sequence_Id);
        });

        this.TCPSocket.on('PanelConnected', async () => {
            this.logger(this.log, Log_Level.DEBUG, `Risco Panel Conneted.`);
            await this.VerifyPanelType();
            await this.GetPanel_FwVersion();
            if (this.Panel_Type == PanelType.RP512) {
                this.MaxZones = this.MaxZones(this.Panel_FW);
            } else if (this.Panel_Type == PanelType.RP432) {
                this.MaxZones = this.MaxZones(this.Panel_FW);
                this.MaxOutputs = this.MaxOutputs(this.Panel_FW);
            }
            const CommandsArr = await this.VerifyPanelConfiguration();

            if ((CommandsArr !== undefined) && (CommandsArr.length >= 1)) {
                await this.TCPSocket.ModifyPanelConfig(CommandsArr);
                await new Promise(r => setTimeout(r, 5000));
            }
            // Finally, Communictaion is ready
            this.emit('PanelCommReady');
//            this.TCPSocket.WatchDog();
        });
    }

    /*
     * Compare Received data with different (and possible) value
     * @param {string}
     */
    async DataFromPanel(data) {
        this.logger(this.log, Log_Level.DEBUG, `Received From Panel : ${data}`);
        switch (true){
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
                if (this.Outputs !== undefined) {
                    let OId = parseInt(data.substring(data.indexOf('OSTT') + 4, data.indexOf('=')), 10);
                    if (!isNaN(OId)) {
                        let OStatus = data.substring(data.indexOf('=') + 1 );
                        (this.Outputs.ById(OId)).Status = OStatus;
                    }
                }
                break;
            case (data.startsWith('PSTT')):
                this.logger(this.log, Log_Level.DEBUG, `Partition Status data.`);
                if (this.Partitions !== undefined) {
                    let PId = parseInt(data.substring(data.indexOf('PSTT') + 4, data.indexOf('=')), 10);
                    if (!isNaN(PId)) {
                        let PStatus = data.substring(data.indexOf('=') + 1 );
                        (this.Partitions.ById(PId)).Status = PStatus;
                    }
                }
                break;
            case (data.startsWith('SSTT')):
                this.logger(this.log, Log_Level.DEBUG, `System Status datas.`);
                if (this.MBSystem !== undefined) {
                    let SStatus = data.substring(data.indexOf('=') + 1 );
                    this.MBSystem.Status = SStatus;
                }
                break;
            case (data.startsWith('ZSTT')):
                this.logger(this.log, Log_Level.DEBUG, `Zone Status datas.`);
                if (this.Zones !== undefined) {
                    let ZId = parseInt(data.substring(data.indexOf('ZSTT') + 4, data.indexOf('=')), 10);
                    if (!isNaN(ZId)) {
                        let ZStatus = data.substring(data.indexOf('=') + 1 );
                        (this.Zones.ById(ZId)).Status = ZStatus;
                    }
                }
                break;
            case (data.startsWith('CLOCK')):
                this.logger(this.log, Log_Level.DEBUG, `Clock datas.`);
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
     * Retrieve the type of Panel and check if the type matches the type of instantiated class
     */
    async VerifyPanelType() {
        let PType = undefined;
        do {
            PType = await this.TCPSocket.SendCommand('PNLCNF');
        } while (PType === undefined);
        
        PType = PType.substring(PType.indexOf('=') + 1);
        this.logger(this.log, Log_Level.DEBUG, `Connected Panel Type : ${PType}`);

        if (this.Panel_Type == PanelType[PType]) {
            this.logger(this.log, Log_Level.DEBUG, `The connected control unit corresponds to the type of control unit expected.`);
        } else {
            this.logger(this.log, Log_Level.ERROR, `The connected control unit is different from the expected type : ${PType}`);
            this.Disconnect();
        }
    }

    /*
     * Retrieve the version of Panel (only for LightSys and Prosys Plus)
     * This information is needed to set the hardware limits that have 
     * been changed from some firmware versions.
     */
    async GetPanel_FwVersion() {
        if (this.Panel_Type == PanelType.RP432 || this.Panel_Type == PanelType.RP512) {
            let FwVersion = new String;
            try {
                FwVersion = await this.TCPSocket.SendCommand('FSVER?');
                FwVersion = FwVersion.substring(FwVersion.indexOf('=') + 1);
                FwVersion = FwVersion.substring(0, FwVersion.indexOf(' '));
            } catch (err) {
                this.logger(this.log, Log_Level.ERROR, `Cannot retrieve Firmware Version.`);
            }
            this.Panel_FW = (FwVersion !== new String) ? FwVersion : this.Panel_FW;
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

        if (this.DisableRC) {
            
            // Disabling RiscoCloud can lead to a time desynchronization if the control panel time 
            // zone is not correctly configured (when the riscoCloud is configured, it is it 
            // which keeps the system on time).
            let RCloudStatus = await this.TCPSocket.SendCommand('ELASEN?');
            RCloudStatus = (RCloudStatus.substring(RCloudStatus.indexOf('=') + 1) == 1) ? true : false;
            if (RCloudStatus) {
                CommandArray.push('ELASEN=0');
                this.logger(this.log, Log_Level.DEBUG, `Prepare Panel for Disabling RiscoCloud.`);
            }
            // Check if the time zone is correctly configured
            let PanelTZ = await this.TCPSocket.SendCommand('TIMEZONE?');
            PanelTZ = PanelTZ.substring(PanelTZ.indexOf('=') + 1).trim();
            let PanelNtpServer = await this.TCPSocket.SendCommand('INTP?');
            PanelNtpServer = PanelNtpServer.substring(PanelNtpServer.indexOf('=') + 1).trim();
            let PanelNtpPort = await this.TCPSocket.SendCommand('INTPP?');
            PanelNtpPort = PanelNtpPort.substring(PanelNtpPort.indexOf('=') + 1).trim();
            let PanelNtpProto = await this.TCPSocket.SendCommand('INTPPROT?');
            PanelNtpProto = PanelNtpProto.substring(PanelNtpProto.indexOf('=') + 1).trim();

            let TimeZoneStr = constants.TimeZoneStr;
            if ( TimeZoneStr[PanelTZ] != this.GMT_TZ ) {
                const newPanelTZ = Object.keys(TimeZoneStr).find(key => TimeZoneStr[key] === this.GMT_TZ);
                CommandArray.push(`TIMEZONE=${newPanelTZ}`);
                this.logger(this.log, Log_Level.DEBUG, `Prepare Panel for Updating TimeZone.`);
            }
            if (PanelNtpServer != this.NtpServer ) {
                CommandArray.push(`INTP=${this.NtpServer}`);
                this.logger(this.log, Log_Level.DEBUG, `Prepare Panel for Updating NTP Server Address.`);
            }
            if (PanelNtpPort != this.NtpPort ) {
                CommandArray.push(`INTPP=${this.NtpPort}`);
                this.logger(this.log, Log_Level.DEBUG, `Prepare Panel for Updating NTP Server Port.`);
            }
            if (PanelNtpProto != 1) {
                CommandArray.push('INTPPROT=1');
                this.logger(this.log, Log_Level.DEBUG, `Prepare Panel for Enabling Server.`);
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
    Disconnect() {
        if (this.TCPSocket !== undefined) {
            this.TCPSocket.Disconnect();
        }
    }

    /*
     * function alias to the function of the same name included 
     * in the class Risco_Socket 
     */
    async DisableRiscoCloud(){
        if (this.DisableRC) {
            await this.TCPSocket.DisableRiscoCloud();
        } else {
            this.logger(this.log, Log_Level.DEBUG, `Disabling RiscoCloud functionnality is not enabled.`);
        }
    }

    /*
     * Queries the panel to retrieve information for all zones
     * @param   {ZoneList}    ZoneList Object     Empty Object 
     * @return  {ZoneList}    ZoneList Object     Populated Object or new Object if fails
     */
    GetAllZonesDatas(ZonesLst) {
        return new Promise( async (resolve, reject) => {
            this.logger(this.log, Log_Level.DEBUG, `Retrieving the configuration of the Zones.`);
            try {
                let MaxZ = this.MaxZones;
                for (let i = 0; i < (MaxZ / 8); i++) {
                    let min = (i *8) + 1;
                    let max = ((i+1) * 8);
                    max = (max > MaxZ) ? MaxZ : max;

                    let ZType = await this.TCPSocket.SendCommand(`ZTYPE*${min}:${max}?`);
                    ZType = ZType.substring(ZType.indexOf('=') + 1).replace(/ /g, '').split('\t');
                    let ZParts = await this.TCPSocket.SendCommand(`ZPART&*${min}:${max}?`);
                    ZParts = ZParts.substring(ZParts.indexOf('=') + 1).replace(/ /g, '').split('\t');
                    let ZGroups = await this.TCPSocket.SendCommand(`ZAREA&*${min}:${max}?`);
                    ZGroups = ZGroups.substring(ZGroups.indexOf('=') + 1).replace(/ /g, '').split('\t');
                    let ZLabels = await this.TCPSocket.SendCommand(`ZLBL*${min}:${max}?`);
                    ZLabels = ZLabels.substring(ZLabels.indexOf('=') + 1).split('\t');
                    let ZStatus = await this.TCPSocket.SendCommand(`ZSTT*${min}:${max}?`);
                    ZStatus = ZStatus.substring(ZStatus.indexOf('=') + 1).replace(/ /g, '').split('\t');
                    let ZTechnoArr = new Array(max - min +1).fill(0);
                    for (let j = 0; j < (max - min + 1); j++) {
                        ZTechnoArr[j] = await this.TCPSocket.SendCommand(`ZLNKTYP${min + j}?`);
                        ZTechnoArr[j] = ZTechnoArr[j].substring(ZTechnoArr[j].indexOf('=') + 1);
                    }
                    let ZTechno = `ZLNKTYP*?${min}:${max}=${ZTechnoArr.join(String.fromCharCode(9))}`;
                    ZTechno = ZTechno.substring(ZTechno.indexOf('=') + 1).replace(/ /g, '').split('\t');

                    for (let j = 0; j < (max - min + 1); j++) {
                        let Item = ZonesLst.ById(min + j);
                        Item.Id = min + j;
                        Item.Label = ZLabels[j].trim();
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
     * @param   {Integer}     Zone Id         Id of the Selected Zone
     * @return  {Zones}       Zone Object     Object representing the Zone
     */
    GetZoneStatus(Id) {
        return new Promise( async (resolve, reject) => {
            this.logger(this.log, Log_Level.DEBUG, `Retrieving the zone's status.`);
            try {
                let ZType = await this.TCPSocket.SendCommand(`ZTYPE*${Id}?`);
                ZType = ZType.substring(ZType.indexOf('=') + 1);
                let ZParts = await this.TCPSocket.SendCommand(`ZPART&*${Id}?`);
                ZParts = ZParts.substring(ZParts.indexOf('=') + 1);
                let ZGroups = await this.TCPSocket.SendCommand(`ZAREA&*${Id}?`);
                ZGroups = ZGroups.substring(ZGroups.indexOf('=') + 1);
                let ZLabels = await this.TCPSocket.SendCommand(`ZLBL*${Id}?`);
                ZLabels = ZLabels.substring(ZLabels.indexOf('=') + 1);
                let ZStatus = await this.TCPSocket.SendCommand(`ZSTT*${Id}?`);
                ZStatus = ZStatus.substring(ZStatus.indexOf('=') + 1);
                ZTechno = await this.TCPSocket.SendCommand(`ZLNKTYP${Id}?`);
                //TODO: use constants.RiscoError
                ZTechno = (!ZTechno.startsWith('N')) ? ZTechno : 'E';

                let Item = this.Zones.ById(Id);
                Item.Label = ZLabels.trim();
                Item.Type = ZType;
                Item.Techno = ZTechno;
                Item.Partitions = ZParts;
                Item.Groups = ZGroups;
                Item.Status = ZStatus;
                resolve([true, this.Zones.ById(Id)]);
            } catch (err) {
                resolve([false, this.Zones.ById(Id)]);
            }
        });
    }

    /*
     * Queries the panel to retrieve information from all outputs
     * @param   {OutputList}    OutputList Object     Empty Object 
     * @return  {OutputList}    OutputList Object     Populated Object or new Object if fails
     */
    GetAllOutputsDatas(OutputLst) {
        return new Promise( async (resolve, reject) => {
            this.logger(this.log, Log_Level.DEBUG, `Retrieving the configuration of the Outputs.`);
            try {
                let MaxO = this.MaxOutputs;
                for (let i = 0; i < (MaxO / 8); i++) {
                    let min = (i *8) + 1;
                    let max = ((i+1) * 8);
                    max = (max > MaxO) ? MaxO : max;

                    let OType = await this.TCPSocket.SendCommand(`OTYPE*${min}:${max}?`);
                    OType = OType.substring(OType.indexOf('=') + 1).replace(/ /g, '').split('\t');
                    let OLabels = await this.TCPSocket.SendCommand(`OLBL*${min}:${max}?`);
                    OLabels = OLabels.substring(OLabels.indexOf('=') + 1).split('\t');
                    let OStatus = await this.TCPSocket.SendCommand(`OSTT*${min}:${max}?`);
                    OStatus = OStatus.substring(OStatus.indexOf('=') + 1).replace(/ /g, '').split('\t');
                    let OGrops = await this.TCPSocket.SendCommand(`OGROP*${min}:${max}?`);
                    OGrops = OGrops.substring(OGrops.indexOf('=') + 1).replace(/ /g, '').split('\t');
                    for (let j = 0; j < (max - min + 1); j++) {
                        let Item = OutputLst.ById(min + j);
                        Item.Id = min + j;
                        Item.Label = OLabels[j].trim();
                        Item.Type = OType[j];
                        if (OType[j]%2 == 0) {
                            let OPulseDelay = await this.TCPSocket.SendCommand(`OPULSE${min + j}?`);
                            Item.PulseDelay = parseInt(OPulseDelay.substring(OPulseDelay.indexOf('=') + 1).replace(/ /g, ''), 10) * 1000;
                        } else {
                            Item.PulseDelay = 0;
                        }
                        Item.Status = OStatus[j];
                        Item.UserUsuable = ((OGrops[j] == 4 ) ? true : false);
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
     * @return  {Output}      Output Object     Object representing the Output
     */
    GetOutputStatus(Id) {
        return new Promise( async (resolve, reject) => {
            this.logger(this.log, Log_Level.DEBUG, `Retrieving the Output's status.`);
            try {
                let OType = await this.TCPSocket.SendCommand(`OTYPE${Id}?`);
                OType = OType.substring(OType.indexOf('=') + 1);
                let OLabels = await this.TCPSocket.SendCommand(`OLBL${Id}?`);
                OLabels = OLabels.substring(OLabels.indexOf('=') + 1);
                let OStatus = await this.TCPSocket.SendCommand(`OSTT*${Id}?`);
                OStatus = OStatus.substring(OStatus.indexOf('=') + 1);

                let Item = this.Outputs.ById(Id);
                Item.Label = OLabels.trim();
                Item.Type = OType;
                Item.Status = OStatus;
                resolve([true, this.Outputs.ById(Id)]);
            } catch (err) {
                resolve([false, this.Outputs.ById(Id)]);
            }
        });
    }

    /*
     * Queries the panel to retrieve information from all Partition
     * @param   {PartitionsList}    PartitionsList Object     Empty Object 
     * @return  {PartitionsList}    PartitionsList Object     Populated Object or new Object if fails
     */
    GetAllPartitionsDatas(PartitionsLst) {
        return new Promise( async (resolve, reject) => {
            this.logger(this.log, Log_Level.DEBUG, `Retrieving the configuration of the Partitions.`);
            try {
                let MaxP = this.MaxParts;
                for (let i = 0; i < (MaxP / 8); i++) {
                    let min = (i *8) + 1;
                    let max = ((i+1) * 8);
                    max = (max > MaxP) ? MaxP : max;

                    let PLabels = await this.TCPSocket.SendCommand(`PLBL*${min}:${max}?`);
                    PLabels = PLabels.substring(PLabels.indexOf('=') + 1).split('\t');
                    let PStatus = await this.TCPSocket.SendCommand(`PSTT*${min}:${max}?`);
                    PStatus = PStatus.substring(PStatus.indexOf('=') + 1).replace(/ /g, '').split('\t');

                    for (let j = 0; j < (max - min + 1); j++) {
                        let Item = PartitionsLst.ById(min + j);
                        Item.Id = min + j;
                        Item.Label = PLabels[j];
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
     * @param   {Integer}     Partition Id         Id of the Selected Partition
     * @return  {Output}      Partition Object     Object representing the Partition
     */
    GetPartitionsStatus(Id) {
        return new Promise( async (resolve, reject) => {
            this.logger(this.log, Log_Level.DEBUG, `Retrieving the Partition's status.`);
            try {
                let PLabels = await this.TCPSocket.SendCommand(`PLBL${Id}?`);
                PLabels = PLabels.substring(PLabels.indexOf('=') + 1);
                let PStatus = await this.TCPSocket.SendCommand(`PSTT${Id}?`);
                PStatus = PStatus.substring(PStatus.indexOf('=') + 1);

                let Item = this.Partitions.ById(Id);
                Item.Label = PLabels.trim();
                Item.Status = PStatus;

                resolve([true, this.Partitions.ById(Id)]);
            } catch (err) {
                resolve([false, this.Partitions.ById(Id)]);
            }
        });
    }

    /*
     * Queries needed info for System Object
     * @return  {MBSystem}    MBSystem Object     Populated Object or new Object if fails
     */
    GetSystemDatas() {
        return new Promise( async (resolve, reject) => {
            this.logger(this.log, Log_Level.DEBUG, `Retrieving System's Information.`);
            try {
                let SLabel = await this.TCPSocket.SendCommand(`SYSLBL?`);
                SLabel = SLabel.substring(SLabel.indexOf('=') + 1).trim();
                let SStatus = await this.TCPSocket.SendCommand(`SSTT?`);
                SStatus = SStatus.substring(SStatus.indexOf('=') + 1);

                resolve([true, new MBSystem(SLabel, SStatus)]);
            } catch (err) {
                resolve([false, new MBSystem('', '---------------------')]);
            }
        });
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
        return new Promise( async (resolve, reject) => {
            this.logger(this.log, Log_Level.DEBUG, `Request for Full/Stay Arming a Partition.`);
            try {
                if ((Id > this.Partitions.length) || (Id < 0)) {
                    resolve(false);
                }
                let SelectedPart = this.Partitions.ById(Id);
                if (!SelectedPart.Ready && SelectedPart.Open) {
                    resolve(false);
                }
                if ((SelectedPart.Arm && (ArmType == 0)) || (SelectedPart.HomeStay && (ArmType == 1))) {
                    resolve(true);
                } else {
                    let ArmTypeStr = Object.freeze({
                        0: 'ARM',
                        1: 'STAY',
                    });
                    let ArmResult = await this.TCPSocket.SendCommand(`${ArmTypeStr[ArmType]}=${Id}`);

                    resolve(((ArmResult =='ACK') ? true : false));
                }
            } catch (err) {
                this.logger(this.log, Log_Level.ERROR, `Failed to Full/Stay Arming the Partition : ${Id}`);
                resolve(false)
            }
        });
    }

    /*
     * Disarm the seleected partition
     * @param   {Integer}     Id          Id Of selected PArtition
     * @return  {Boolean}
     */
    DisarmPart(Id) {
        return new Promise( async (resolve, reject) => {
            this.logger(this.log, Log_Level.DEBUG, `Request for Disarming a Partition.`);
            try {
                if ((Id > this.Partitions.length) || (Id < 0)) {
                    resolve(false);
                }
                let SelectedPart = this.Partitions.ById(Id);
                if (!SelectedPart.Arm && !SelectedPart.HomeStay) {
                    resolve(true);
                } else {
                    let DisarmResult = await this.TCPSocket.SendCommand(`DISARM=${Id}`);
                    resolve(((DisarmResult =='ACK') ? true : false));
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
        return new Promise( async (resolve, reject) => {
            this.logger(this.log, Log_Level.DEBUG, `Request for Bypassing/UnBypassing a Zone.`);
            try {
                if ((Id > this.Zones.length) || (Id < 0)) {
                    resolve(false);
                }
                let BypassResult = await this.TCPSocket.SendCommand(`ZBYPAS=${Id}`);

                resolve(((BypassResult =='ACK') ? true : false));
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
        return new Promise( async (resolve, reject) => {
            this.logger(this.log, Log_Level.DEBUG, `Request for Toggle an Output.`);
            try {
                if ((Id > this.Outputs.length) || (Id < 0)) {
                    resolve(false);
                }
                let ActOutputResult = await this.TCPSocket.SendCommand(`ACTUO${Id}`);

                resolve(((ActOutputResult =='ACK') ? true : false));
            } catch (err) {
                this.logger(this.log, Log_Level.ERROR, `Failed to Toggle Output : ${Id}`);
                resolve(false);
            }
        });
    }
}

module.exports = {
    RiscoDirectTCP: RiscoDirectTCP
}