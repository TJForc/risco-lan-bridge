/* 
 *  Package: risco-lan-bridge
 *  File: Partitions_Events.js
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
    // Listening to all events from all Partitions.
    // In this case, it is up to you to deal with the 
    // type of events received and the action to be taken.
    Panel.Partitions.on('PStatusChanged', (Id, EventStr) => {
        console.log(`Partitions Status Changed :\n Partition Id ${Id}\n New Status: ${EventStr}`);
    });

    // Listen specific event for Partition Id 1
    let Monitored_Part = Panel.Partitions.ById(1);
    Monitored_Part.on('Alarm', (Id) => {
        console.log(`Partition ${Id} Alarm`);
    });
    Monitored_Part.on('StandBy', (Id) => {
        console.log(`Partition ${Id} StandBy`);
    });
    Monitored_Part.on('Duress', (Id) => {
        console.log(`Partition ${Id} Duress`);
    });
    Monitored_Part.on('Free', (Id) => {
        console.log(`Partition ${Id} Free`);
    });
    Monitored_Part.on('FalseCode', (Id) => {
        console.log(`Partition ${Id} FalseCode`);
    });
    Monitored_Part.on('CodeOk', (Id) => {
        console.log(`Partition ${Id} CodeOk`);
    });
    Monitored_Part.on('Fire', (Id) => {
        console.log(`Partition ${Id} Fire`);
    });
    Monitored_Part.on('NoFire', (Id) => {
        console.log(`Partition ${Id} NoFire`);
    });
    Monitored_Part.on('Panic', (Id) => {
        console.log(`Partition ${Id} Panic`);
    });
    Monitored_Part.on('NoPanic', (Id) => {
        console.log(`Partition ${Id} NoPanic`);
    });
    Monitored_Part.on('Medic', (Id) => {
        console.log(`Partition ${Id} Medic`);
    });
    Monitored_Part.on('NoMedic', (Id) => {
        console.log(`Partition ${Id} NoMedic`);
    });
    Monitored_Part.on('Armed', (Id) => {
        console.log(`Partition ${Id} Armed`);
    });
    Monitored_Part.on('Disarmed', (Id) => {
        console.log(`Partition ${Id} Disarmed`);
    });
    Monitored_Part.on('HomeStay', (Id) => {
        console.log(`Partition ${Id} HomeStay`);
    });
    Monitored_Part.on('HomeDisarmed', (Id) => {
        console.log(`Partition ${Id} HomeDisarmed`);
    });
    Monitored_Part.on('Ready', (Id) => {
        console.log(`Partition ${Id} Ready`);
    });
    Monitored_Part.on('NotReady', (Id) => {
        console.log(`Partition ${Id} NotReady`);
    });
    Monitored_Part.on('ZoneOpen', (Id) => {
        console.log(`Partition ${Id} ZoneOpen`);
    });
    Monitored_Part.on('ZoneClosed', (Id) => {
        console.log(`Partition ${Id} ZoneClosed`);
    });
    Monitored_Part.on('MemoryEvent', (Id) => {
        console.log(`Partition ${Id} MemoryEvent`);
    });
    Monitored_Part.on('MemoryAck', (Id) => {
        console.log(`Partition ${Id} MemoryAck`);
    });
    Monitored_Part.on('ActivityAlert', (Id) => {
        console.log(`Partition ${Id} ActivityAlert`);
    });
    Monitored_Part.on('ActivityOk', (Id) => {
        console.log(`Partition ${Id} ActivityOk`);
    });
    Monitored_Part.on('GrpAArmed', (Id) => {
        console.log(`Partition ${Id} GrpAArmed`);
    });
    Monitored_Part.on('GrpADisarmed', (Id) => {
        console.log(`Partition ${Id} GrpADisarmed`);
    });
    Monitored_Part.on('GrpBArmed', (Id) => {
        console.log(`Partition ${Id} GrpBArmed`);
    });
    Monitored_Part.on('GrpBDisarmed', (Id) => {
        console.log(`Partition ${Id} GrpBDisarmed`);
    });
    Monitored_Part.on('GrpCArmed', (Id) => {
        console.log(`Partition ${Id} GrpCArmed`);
    });
    Monitored_Part.on('GrpCDisarmed', (Id) => {
        console.log(`Partition ${Id} GrpCDisarmed`);
    });
    Monitored_Part.on('GrpDArmed', (Id) => {
        console.log(`Partition ${Id} GrpDArmed`);
    });
    Monitored_Part.on('GrpDDisarmed', (Id) => {
        console.log(`Partition ${Id} GrpDDisarmed`);
    });
    Monitored_Part.on('Trouble', (Id) => {
        console.log(`Partition ${Id} Trouble`);
    });
    Monitored_Part.on('Ok', (Id) => {
        console.log(`Partition ${Id} Ok`);
    });
});
