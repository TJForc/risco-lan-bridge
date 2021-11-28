/* 
 *  Package: risco-lan-bridge
 *  File: Output_Events.js
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
    // Listening to all events from all outputs.
    // In this case, it is up to you to deal with the 
    // type of events received and the action to be taken.
    Panel.Outputs.on('OStatusChanged', (Id, EventStr) => {
        console.log(`Output Status Changed :\n Output Id ${Id}\n New Status: ${EventStr}`);
    });

    // Listen specific event for Output Id 1
    let Monitored_Output = Panel.Outputs.ById(1);
    Monitored_Output.on('Actived', (Id) => {
        console.log(`Output ${Id} Actived`)
    });
    Monitored_Output.on('Deactived', (Id) => {
        console.log(`Output ${Id} Deactived`)
    });
});