/* 
 *  Package: risco-lan-bridge
 *  File: Logger.js
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

const constants = require('./constants');
const Log_Level = constants.Log_Level;
const log = console;

const logger = (log_channel, log_lvl, log_data) => {
    switch (log_lvl) {
        case Log_Level.ERROR :
            log_channel.error(log_data);
            break;
        case Log_Level.WARN :
            log_channel.warn(log_data);
            break;
        case Log_Level.INFO :
            log_channel.info(log_data);
            break;
        case Log_Level.VERBOSE :
            log_channel.info(log_data);
            break;
        case Log_Level.DEBUG :
            log_channel.debug(log_data);
            break;
    }
};

module.exports = {
    logger: logger,
    log: log
};