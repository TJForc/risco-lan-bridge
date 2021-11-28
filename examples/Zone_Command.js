/* 
 *  Package: risco-lan-bridge
 *  File: Zone_Command.js
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

// Request to Bypass/UnBypass Zone Id 1
// You can then check the status of the Zone in 2 ways:
// - listen to 'Bypassed' and 'UnBypassed' events (see Zone_Events.js file)
// - Retrieve the state of the 'Bypass' property of the zone
let GetZoneBypassState = (() => {
    if ((Panel.Zones.ById(1)).Bypass) {
        console.log('Zone is Bypassed');
    } else {
        console.log('Zone is UnBypassed');
    }
});

Panel.on('SystemInitComplete', async () => {
    GetZoneBypassState();
    if (await Panel.ToggleBypassZone(1)) {
        console.log('Zone Bypass Successfully Toggled');
        GetZoneBypassState();
    } else {
        console.log('Error on Zone Bypass Toggle');
        GetZoneBypassState();
    }
});
