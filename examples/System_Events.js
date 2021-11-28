/* 
 *  Package: risco-lan-bridge
 *  File: System_Events.js
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

const RiscoPanel = require('risco-lan-bridge').RiscoPanel;

let Options = {
    Panel_IP: '192.168.0.100',
    Panel_Port: 1000,
    Panel_Password: 5678,
    Panel_Id: '0001',
};

let Panel = new RiscoPanel(Options);

// Wait for the plugin to be connected and initialized
Panel.on('SystemInitComplete', () => {
    // Listening to all events from all zones.
    //In this case, it is up to you to deal with the 
    // type of events received and the action to be taken.
    Panel.MBSystem.on('SStatusChanged', (EventStr) => {
        console.log(`System Status Changed, New Status: ${EventStr}`);
    });

    // Listen specific event for System Panel
    let Monitored_System = Panel.MBSystem;
    Monitored_System.on('LowBattery', () => {
        console.log(`System LowBattery`)
    });
    Monitored_System.on('BatteryOk', () => {
        console.log(`System BatteryOk`)
    });
    Monitored_System.on('ACUnplugged', () => {
        console.log(`System ACUnplugged`)
    });
    Monitored_System.on('ACPlugged', () => {
        console.log(`System ACPlugged`)
    });
    Monitored_System.on('PhoneLineTrouble', () => {
        console.log(`System PhoneLineTrouble`)
    });
    Monitored_System.on('PhoneLineOk', () => {
        console.log(`System PhoneLineOk`)
    });
    Monitored_System.on('ClockTrouble', () => {
        console.log(`System ClockTrouble`)
    });
    Monitored_System.on('ClockOk', () => {
        console.log(`System ClockOk`)
    });
    Monitored_System.on('DefaultSwitchOn', () => {
        console.log(`System DefaultSwitchOn`)
    });
    Monitored_System.on('DefaultSwitchOff', () => {
        console.log(`System DefaultSwitchOff`)
    });
    Monitored_System.on('MS1ReportTrouble', () => {
        console.log(`System MS1ReportTrouble`)
    });
    Monitored_System.on('MS1ReportOk', () => {
        console.log(`System MS1ReportOk`)
    });
    Monitored_System.on('MS2ReportTrouble', () => {
        console.log(`System MS2ReportTrouble`)
    });
    Monitored_System.on('MS2ReportOk', () => {
        console.log(`System MS2ReportOk`)
    });
    Monitored_System.on('MS3ReportTrouble', () => {
        console.log(`System MS3ReportTrouble`)
    });
    Monitored_System.on('MS3ReportOk', () => {
        console.log(`System MS3ReportOk`)
    });
    Monitored_System.on('BoxTamperOpen', () => {
        console.log(`System BoxTamperOpen`)
    });
    Monitored_System.on('BoxTamperClosed', () => {
        console.log(`System BoxTamperClosed`)
    });
    Monitored_System.on('JammingTrouble', () => {
        console.log(`System JammingTrouble`)
    });
    Monitored_System.on('JammingOk', () => {
        console.log(`System JammingOk`)
    });
    Monitored_System.on('ProgModeOn', () => {
        console.log(`System ProgModeOn`)
    });
    Monitored_System.on('ProgModeOff', () => {
        console.log(`System ProgModeOff`)
    });
    Monitored_System.on('LearnModeOn', () => {
        console.log(`System LearnModeOn`)
    });
    Monitored_System.on('LearnModeOff', () => {
        console.log(`System LearnModeOff`)
    });
    Monitored_System.on('ThreeMinBypassOn', () => {
        console.log(`System ThreeMinBypassOn`)
    });
    Monitored_System.on('ThreeMinBypassOff', () => {
        console.log(`System ThreeMinBypassOff`)
    });
    Monitored_System.on('WalkTestOn', () => {
        console.log(`System WalkTestOn`)
    });
    Monitored_System.on('WalkTestOff', () => {
        console.log(`System WalkTestOff`)
    });
    Monitored_System.on('AuxTrouble', () => {
        console.log(`System AuxTrouble`)
    });
    Monitored_System.on('AuxOk', () => {
        console.log(`System AuxOk`)
    });
    Monitored_System.on('Rs485BusTrouble', () => {
        console.log(`System Rs485BusTrouble`)
    });
    Monitored_System.on('Rs485BusOk', () => {
        console.log(`System Rs485BusOk`)
    });
    Monitored_System.on('LsSwitchOn', () => {
        console.log(`System LsSwitchOn`)
    });
    Monitored_System.on('LsSwitchOff', () => {
        console.log(`System LsSwitchOff`)
    });
    Monitored_System.on('BellSwitchOn', () => {
        console.log(`System BellSwitchOn`)
    });
    Monitored_System.on('BellSwitchOff', () => {
        console.log(`System BellSwitchOff`)
    });
    Monitored_System.on('BellTrouble', () => {
        console.log(`System BellTrouble`)
    });
    Monitored_System.on('BellOk', () => {
        console.log(`System BellOk`)
    });
    Monitored_System.on('BellTamper', () => {
        console.log(`System BellTamper`)
    });
    Monitored_System.on('BellTamperOk', () => {
        console.log(`System BellTamperOk`)
    });
    Monitored_System.on('ServiceExpired', () => {
        console.log(`System ServiceExpired`)
    });
    Monitored_System.on('ServiceOk', () => {
        console.log(`System ServiceOk`)
    });
    Monitored_System.on('PaymentExpired', () => {
        console.log(`System PaymentExpired`)
    });
    Monitored_System.on('PaymentOk', () => {
        console.log(`System PaymentOk`)
    });
    Monitored_System.on('ServiceModeOn', () => {
        console.log(`System ServiceModeOn`)
    });
    Monitored_System.on('ServiceModeOff', () => {
        console.log(`System ServiceModeOff`)
    });
    Monitored_System.on('DualPathOn', () => {
        console.log(`System DualPathOn`)
    });
    Monitored_System.on('DualPathOff', () => {
        console.log(`System DualPathOff`)
    });
});
