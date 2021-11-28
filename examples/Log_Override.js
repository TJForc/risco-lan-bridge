/* 
 *  Package: risco-lan-bridge
 *  File: Log_Override.js
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

/*
 * The function below corresponds to the function used in this plugin
 *
 * Your function must accept the following parameters:
 * @param {string}   log_channel    Corresponds to the 'log' option   
 * @param {string}   log_channel    Event logging level
 * @param {string}   log_channel    Events message  
 */
let logger_function = (log_channel, log_lvl, log_data) => {
    switch (log_lvl) {
        case 'error' :
            log_channel.error(log_data);
        case 'warn' :
            log_channel.warn(log_data);
        case 'info' :
            log_channel.info(log_data);
        case 'verbose' :
            log_channel.log(log_data);
        case 'debug' :
            log_channel.debug(log_data);
    }
};

// You can also override the log option with your own logging channel (Experimental)
const log_channel = console;

let Options = {
    // Define Panel IP Address (Optional)
    Panel_IP: '192.168.0.100',
    // Define Panel TCP Port (Optional)
    Panel_Port: 1000,
    // Define Panel Access Code (Optional)
    Panel_Password: 5678,
    // Define Panel ID  (Optional)
    Panel_Id: '0001',
    // Activate autodiscover (Optional)
    AutoDiscover: true,
    // Defines the waiting time for a reconnection in ms (Optional)
    ReconnectDelay: 10000,
    // Defines automatic connection (Optional)
    AutoConnect: true,
    // Defines if the plugin should deactivate RiscoCloud on the control panel (Optional)
    Disable_RiscoCloud: true,
    // Defines if the plugin should discover the access codes and the Id panel automatically (Optional)
    DiscoverCode: true,
    // Defines an overload function for logging (Optional)
    logger: logger_function,
    // Defines a specific channel for logs (Optional - default channel is 'console')
    log: log_channel
    // Reserved for future use
    // Ultimately, the plugin will be able to host an FTP server to record the captures from PirCam
    // SupportPirCam: false
};

// you can now initialize a Risco Panel Object
let Panel = new RiscoPanel(Options);
