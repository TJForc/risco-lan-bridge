/* 
 *  Package: risco-lan-bridge
 *  File: Output_Command.js
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

// Request to switch output Id 1
// For Pulse type outputs, no status feedback will be sent by the Panel.
// For the other outputs, a status feedback will be sent.
// You can then check the status of the output in 2 ways:
// - listen to 'Activated' and 'Deactivated' events (see Output_Events.js file)
// - Retrieve the state of the 'Active' property of the output
let GetOutputState = (() => {
    if ((Panel.Outputs.ById(1)).Active) {
        console.log('Output is Active State');
    } else {
        console.log('Output is Inactive State');
    }
});
GetOutputState();
if (await Panel.ToggleOutput(1)) {
    console.log('Output Successfully Toggled');
    GetOutputState();
} else {
    console.log('Error on Output Toggle');
    GetOutputState();
}