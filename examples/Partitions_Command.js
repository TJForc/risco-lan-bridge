/* 
 *  Package: risco-lan-bridge
 *  File: Partitions_Command.js
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

// Request to Arm Partition Id 1
// You can then check the status of the partition in 2 ways:
// - listen to 'Armed' and 'Disarmed' events (see Output_Events.js file)
// - Retrieve the state of the 'Arm' property of the output
let GetPartitionState = (() => {
    if ((Panel.Partitions.ById(1)).Arm) {
        console.log('Partition is Armed State');
    } else {
        console.log('Partition is Disarmed State');
    }
});

GetPartitionState();
// For arming, you must provide both the Partition ID and the desired arming type
// 0 => Full Arm
// 1 => PArtial Arm (Stay at Home)
if (await Panel.ArmPart(1, 0)) {
    console.log('Partition Successfully Armed/Disarmed');
    GetPartitionState();
} else {
    console.log('Error on PArtition Arming/Disaming');
    GetPartitionState();
}

// Request to Disarm Partition Id 1
// For disarming, only the partition ID is required 
if (await Panel.DisarmPart(1)) {
    console.log('Partition Successfully Armed/Disarmed');
    GetPartitionState();
} else {
    console.log('Error on PArtition Arming/Disaming');
    GetPartitionState();
}