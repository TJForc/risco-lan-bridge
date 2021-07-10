# risco-lan-bridge
risco-lan-bridge is not intended to be used as is.
This program is intended to be used as a "bridge" between your application and a Risco alarm Panel (can also work with Electronic Line products but this has not been tested).

## Compatibility
risco-lan-bridge is compatible with these central units and these features:
||Agility|Wicomm|Wicomm Pro|LightSYS|ProSYSPlus/GTPlus|Other|
|--|:--:|:--:|:--:|:--:|:--:|:--:|
|Zones|Y*|Y*|Y*|Y|Y*|?|
|Partitions|Y*|Y*|Y*|Y|Y*|?|
|Outputs|Y*|Y*|Y*|Y|Y*|?|
|Groups|N**|N**|N**|N**|N**|?|
|Arming|Y|Y|Y|Y|Y|?|
|Stay Arming|Y|Y|Y|Y|Y|?|
|Temporised Arming|N**|N**|N**|N**|N**|?|
|Disarming|Y|Y|Y|Y|Y|?|
|Bypass/UnBypass Zones|Y|Y|Y|Y|Y|?|
|Command Outputs|Y|Y|Y|Y|Y|?|
|PirCam Support|N***|N***|N***|N|N***|?|

*=> Theoretical compatibility not tested.

** => Not functional today. 

***=> Not functional today (planned for a future version).


## Configuration
First of all, you must define the options necessary to define the Risco Panel Object.
```
let  Options = {
// Define Panel IP Address (Optional)
Panel_IP:  '192.168.0.100',
// Define Panel TCP Port (Optional)
Panel_Port:  1000,
// Define Panel Access Code (Optional)
Panel_Password:  5678,
// Define Panel ID (Optional)
Panel_Id:  '0001',
// Activate autodiscover (Optional)
AutoDiscover:  true,
// Defines the waiting time for a reconnection in ms (Optional)
ReconnectDelay:  10000,
// Defines automatic connection (Optional)
AutoConnect:  true,
// Defines if the plugin should deactivate RiscoCloud on the control panel (Optional)
Disable_RiscoCloud:  true,
// Defines if the plugin should discover the access codes and the Id panel automatically (Optional)
DiscoverCode:  true,
// Defines an overload function for logging (Optional)
logger:  logger_function,
// Defines a specific channel for logs (Optional - default channel is 'console')
log:  log_channel
};
````
All these options are not mandatory, the only really essential option is the 'Panel_IP' option.
You can then create your RiscoPanel Object:
```
// Create Agility Object
let  RPanel = new  RiscoTCPPanel.Agility(Options);
// Or create WiComm Object
let  RPanel = new  RiscoTCPPanel.WiComm(Options);
// Or create WiCommPro Object
let  RPanel = new  RiscoTCPPanel.WiCommPro(Options);
// Or create LightSYS Object
let  RPanel = new  RiscoTCPPanel.LightSys(Options);
// Or create ProsysPlus Object
let  RPanel = new  RiscoTCPPanel.ProsysPlus(Options);
// Or create GTPlus Object
let  RPanel = new  RiscoTCPPanel.GTPlus(Options);
```
With the default options, the connection will be automatically made and you will obtain an object representing your control panel and permanently reflecting the real state of the equipment.

For more information regarding operation or interactions with the hardware, please refer to the wiki.

### Licence
risco-lan-bridge is licensed under the MIT license, so you can dispose of it as you see fit under the terms of that license.
