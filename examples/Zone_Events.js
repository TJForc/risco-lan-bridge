/* 
 *  Package: risco-lan-bridge
 *  File: Zone_Events.js
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
    // In this case, it is up to you to deal with the 
    // type of events received and the action to be taken.
    Panel.Zones.on('ZStatusChanged', (Id, EventStr) => {
        console.log(`Zones Status Changed :\n Zone Id ${Id}\n New Status: ${EventStr}`);
    });

    // Listen specific event for zone Id 1
    let Monitored_Zone = Panel.Zones.ById(1);
    Monitored_Zone.on('Open', (Id) => {
        console.log(`Zone ${Id} Open`)
    });
    Monitored_Zone.on('Closed', (Id) => {
        console.log(`Zone ${Id} Closed`)
    });
    Monitored_Zone.on('Armed', (Id) => {
        console.log(`Zone ${Id} Armed`)
    });
    Monitored_Zone.on('Disarmed', (Id) => {
        console.log(`Zone ${Id} Disarmed`)
    });
    Monitored_Zone.on('Alarm', (Id) => {
        console.log(`Zone ${Id} Alarm`)
    });
    Monitored_Zone.on('StandBy', (Id) => {
        console.log(`Zone ${Id} StandBy`)
    });
    Monitored_Zone.on('Tamper', (Id) => {
        console.log(`Zone ${Id} Tamper`)
    });
    Monitored_Zone.on('Hold', (Id) => {
        console.log(`Zone ${Id} Hold`)
    });
    Monitored_Zone.on('Trouble', (Id) => {
        console.log(`Zone ${Id} Trouble`)
    });
    Monitored_Zone.on('Sureness', (Id) => {
        console.log(`Zone ${Id} Located`)
    });
    Monitored_Zone.on('Lost', (Id) => {
        console.log(`Zone ${Id} Lost`)
    });
    Monitored_Zone.on('Located', (Id) => {
        console.log(`Zone ${Id} Located`)
    });
    Monitored_Zone.on('LowBattery', (Id) => {
        console.log(`Zone ${Id} LowBattery`)
    });
    Monitored_Zone.on('BatteryOk', (Id) => {
        console.log(`Zone ${Id} BatteryOk`)
    });
    Monitored_Zone.on('Bypassed', (Id) => {
        console.log(`Zone ${Id} Bypassed`)
    });
    Monitored_Zone.on('UnBypassed', (Id) => {
        console.log(`Zone ${Id} UnBypassed`)
    });
    Monitored_Zone.on('CommTrouble', (Id) => {
        console.log(`Zone ${Id} CommTrouble`)
    });
    Monitored_Zone.on('CommOk', (Id) => {
        console.log(`Zone ${Id} CommOk`)
    });
    Monitored_Zone.on('SoakTest', (Id) => {
        console.log(`Zone ${Id} SoakTest`)
    });
    Monitored_Zone.on('ExitSoakTest', (Id) => {
        console.log(`Zone ${Id} ExitSoakTest`)
    });
    // The following events only occur when the zone is discovered, 
    // that is to say when the first report is received.
    // By default, the automatic discovery mode being activated,
    // these events will therefore occur BEFORE the plugin is initialized.
    Monitored_Zone.on('24HoursZone', (Id) => {
        console.log(`Zone ${Id} 24HoursZone`)
    });
    Monitored_Zone.on('NormalZone', (Id) => {
        console.log(`Zone ${Id} NormalZone`)
    });
    Monitored_Zone.on('ZoneNotUsed', (Id) => {
        console.log(`Zone ${Id} ZoneNotUsed`)
    });
    Monitored_Zone.on('ZoneUsed', (Id) => {
        console.log(`Zone ${Id} ZoneUsed`)
    });
});
