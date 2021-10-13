# Prerequisites

When using this package, you should know several information:
- The type of panel to invoke (Agility / Wicomm / WicommPro / LightSYS / ProSYSPlus / GTPlus).
- The control panel's IP address (it is recommended that your control panel operates with a Fixed IP or a DHCP address reservation).
- The listening TCP port of your central unit. By default, this port is port 1000, but the installer may well have changed it.
- The access code (Panel_Password options). By default, this code is 5678 and it is rarely changed. (If this code has been changed, see the FAQ for more information on the discovery procedure)
- The protocol encryption key (or Panel_Id). By default, this key is equal to 1 when it leaves the factory and, again, it is rare that it is changed during installation.

# Initialization and launch of the connection

## Module import
```
const  RiscoTCPPanel = require('risco-lan-bridge');
```
You will thus obtain an object allowing you to instantiate the following sub-objects:
* Agility
* Wicomm
* WicommPro
* LightSYS
* ProSYSPlus
* GTPlus

*Currently, the ProSYSPLus and GTPlus panels are identical, so you can instantiate one or the other if you have one of these two panels BUT, in the case of a different choice of evolution for these two products it is preferable to consider them as two different panel.*
## Options

First, you need to set the options that will be used to instantiate a RiscoPanel object:
```
// All the values shown below are the default values (except for the logger and log options)
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
// Defines if the plugin should activate RiscoCloud on the control panel (Optional)
Enable_RiscoCloud:  true,
//Note :If the 'Disable_RiscoCloud' and 'Enable_RiscoCloud' options are both true, no changes will be made.
// Defines if the plugin should discover the access codes and the Id panel automatically (Optional)
DiscoverCode:  true,
// Defines the operating mode of the TCP Socket ('direct' or 'proxy') (Optional)
SocketMode: 'direct',
// In Proxy Mode, define the listening TCP port for the Panel to connect (Optional)
ListeningPort: 33000,
// In Proxy Mode, define the TCP port to connect to RiscoCloud (Optional)
CloudPort: 33000,
// In Proxy Mode, define the URL to connect to RiscoCloud (Optional)
CloudUrl: 'www.riscocloud.com',
// Defines an overload function for logging (Optional)
logger:  logger_function,
// Defines a specific channel for logs (Optional - default channel is 'console')
log:  log_channel
// Reserved for future use
// Ultimately, the plugin will be able to host an FTP server to record the captures from PirCam
// SupportPirCam: false
};
```
All of the options discussed above are optional and the values shown are the default options (unless the TCP Port, Panel Id and remote password are not the default ones, in which case they must also be specified).

## 'Direct' or 'proxy' connection mode

If your control panel is equipped with a multi-socket IP module, you are free to choose the connection mode that suits you best, but the default 'direct' mode should work perfectly.

But in the event that your control panel is equipped with a mon-socket IP module, you can then either deactivate the Cloud functions of your control panel and use the 'direct' mode, or use the 'proxy' connection mode.

### Direct Mode

In this mode, 'risco-lan-bridge' will establish a connection to your control panel.
'risco-lan-bridge' then acts as a TCP client and your control panel as a server.
The diagrams below will be more explicit:

Direct mode with a Multi-socket IP module (connected or not to RiscoCloud):
```
 .----------.                       .-----------.                        .----------------.
 |RiscoCloud|<--------------------->|Risco Panel|<---------------------->|risco-lan-bridge|
 '----------'    TCP Cloud Data     '-----------'     TCP Direct Data    '----------------'
```

Direct mode with a Mono-socket IP module (not connected to RiscoCloud):
```
 .-----------.                        .----------------.
 |Risco Panel|<---------------------->|risco-lan-bridge|
 '-----------'     TCP Direct Data    '----------------'
```
To choose this operating mode, the 'SocketMode' option must either be omitted or set to 'direct' :
```
SocketMode: 'direct',
```

### Proxy Mode

In this connection mode, 'risco-lan-bridge' will be inserted between the Panel and the RiscoCloud.
'risco-lan-bridge' will then act as a server on the Panel side and as a client on the RiscoCloud side.
'risco-lan-bridge' will then take care of transmitting the data identified as Cloud data to each of the other two parts and can then communicate directly with the Panel via the socket established by the Panel.
At the same time, the remote connections (via the "Configuration Software") will be listened to in order to replace themselves transparently in order to make this operating mode undetectable.
In this specific case, only the connection / disconnection frames of the remote client will be substituted so that the remote connection can be established and that the remote disconnection does not come to close the channel established between 'risco-lan-bridge' and the Panel.

**IMPORTANT:
For this connection mode to work, it is essential to make the control panel believe that it is connecting to RiscoCloud.
This can be done by modifying the control panel's RiscoCloud connection parameters, indicating the IP address and listening port of the device hosting 'risco-lan-bridge', by redirecting the TCP flow from the control panel to the RiscoCloud (advanced configuration at your router for example) or any other means allowing this operation to be carried out.**

The proxy mode connection diagram looks like this:
```
.----------.           .----------.                       .----------------.                       .-----------.
|  Remote  |           |          |                       |                |                       |           |
|  Client  |<--------->|RiscoCloud|<-------------------------------------------------------------->|Risco Panel|
'----------'   Remote  |          |  |   TCP Cloud Data   |                |   TCP Cloud Data   |  |           |
                Data   '----------'  |                    |                |                    |  '-----------'
                                     |                    |                |                    |             
                                     |                    |                |                    |             
                                     |                    |risco-lan-bridge|                    |  
                                     |                    |                |                    |             
                                     |                    |                |                    |             
                                     ---------------------|----------------|---------------------             
                                        Remote Data or    |      Data      |   TCP Direct Data                
                                       Panel Response's   |   Processing   |    + Remote Data                 
                                       to Remote Client   '----------------'   after treatement    
```
To choose this operating mode, the 'SocketMode' option must either be set to 'proxy' :
```
// Defines the operating mode of the TCP Socket ('direct' or 'proxy') (Optional)
SocketMode: 'proxy',
```

By default, 'risco-lan-bridge' will listen for connections from Panel on TCP Port 33000 and connect to RiscoCloud on TCP port 33000 and URL 'www.riscocloud.com'.

This behavior can be changed by changing the values of the following options:
```
// In Proxy Mode, define the listening TCP port for the Panel to connect (Optional)
ListeningPort: 33000,
// In Proxy Mode, define the TCP port to connect to RiscoCloud (Optional)
CloudPort: 33000,
// In Proxy Mode, define the URL to connect to RiscoCloud (Optional)
CloudUrl: 'www.riscocloud.com',
```

## Instantiation and Connection

Once the options have been defined, you can invoke an object corresponding to the type of panel installed.

Create Agility Object
```
let  RPanel = new  RiscoTCPPanel.Agility(Options);
```
 Or create WiComm Object
```
let  RPanel = new  RiscoTCPPanel.WiComm(Options);
```
 Or create WiCommPro Object
```
let  RPanel = new  RiscoTCPPanel.WiCommPro(Options);
```
 Or create LightSYS Object
```
let  RPanel = new  RiscoTCPPanel.LightSys(Options);
```
 Or create ProsysPlus Object
```
let  RPanel = new  RiscoTCPPanel.ProsysPlus(Options);
```
 Or create GTPlus Object
```
let  RPanel = new  RiscoTCPPanel.GTPlus(Options);
```
The connection to the control panel will be automatically established.
For a manual connection (Autoconnect options disabled), you will have to initiate it as follows:
```
RPanel.Connect();
```
## Events 
Once the connection is successful and all devices discovered, the Panel Object will be ready to operate and emit an event _'SystemInitComplete'_ to signify that it is operational.

You can then intercept this event and act as you wish:
```
RPanel.on('SystemInitComplete', () => {
    console.log(`Initialisation Complete`)
});
```

# Peripheral devices

Once the system is initialized (automatic discovery mode activated or not), you will have access to 4 families of devices:
```
// System itself
this.RPanel.MBSystem;
// All Zones
this.RPanel.Zones;
// All Outputs
this.RPanel.Outputs;
// All Partitions
this.RPanel.Partitions;
```

For the moment, it is not possible to use the functionalities of Groups of Risco systems (not that they cannot be identified but it is for the moment not possible to arm/disarm them).

## System Object

The 'System Panel' object represents the control panel itself.
This Object has several properties and events allowing to know at any time the state of the system.
```
// System Panel Object
this.RPanel.MBSystem;
```

### Properties
```
// String : Indicates the name of the system as defined in its programming.
this.MBSystem.Label;
// Boolean : Indicates if the Panel configuration has been modified (entered programming mode) 
// since the connection was established
this.NeedUpdateConfig;
// Boolean : Indicates a battery fault state on the system (panel or remote power supply)
this.MBSystem.LowBatteryTrouble;
// Boolean : Indicates a mains fault state on the system (panel or remote power supply)
this.MBSystem.ACTrouble;
// Boolean : Indicates a phone line fault condition.
this.MBSystem.PhoneLineTrouble;
// Boolean : Indicates a clock fault (usually occurs after a restart of the Panel).
this.MBSystem.ClockTrouble;
// Boolean : Indicates that the default jumper is On (should not occur after the installation has been commissioned for the first time).
this.MBSystem.DefaultSwitch;
// Boolean : Indicates a problem when calling / connecting to a monitoring station (Monitoring station 1, 2, or 3).
this.MBSystem.MS1ReportTrouble;
this.MBSystem.MS2ReportTrouble;
this.MBSystem.MS3ReportTrouble;
// Boolean : Control panel Tamper activated.
this.MBSystem.BoxTamper;
// Boolean : Radio jamming detection
this.MBSystem.JammingTrouble;
// Boolean : System in Programming mode (local or remote).
this.MBSystem.ProgMode;
// Boolean : System in radio peripheral learning mode (local or remote).
this.MBSystem.LearnMode;
// Boolean : Automatic bypass of all zones for three minutes (usually occurs when the control panel is restarted or when exiting programming mode).
this.MBSystem.ThreeMinBypass;
// Boolean : System in test mode.
this.MBSystem.WalkTest;
// Boolean : Auxiliary power supply fault.
this.MBSystem.AuxTrouble;
// Boolean : Fault on the communication bus.
this.MBSystem.Rs485BusTrouble;
// Boolean : Indicates whether the LS / Bell jumper is in the LS or Bell position (not present on all control panels).
// Does not present any real interest.
this.MBSystem.LsSwitch;
this.MBSystem.BellSwitch;
// Boolean : Siren fault.
this.MBSystem.BellTrouble;
// Boolean : Siren tamper.
this.MBSystem.BellTamper;
// Boolean : May be linked to the expiration of the GSM credit.
this.MBSystem.ServiceExpired;
this.MBSystem.PaymentExpired;
//B oolean : System in service mode (generally for replacing the batteries of Radio peripherals without triggering an alarm).
this.MBSystem.ServiceMode;
// Boolean : Dual Communication Channel ??
this.MBSystem.DualPath;
```

### Events

Each of the preceding states is linked to a specific event.
In addition to these specific events, a general event is also issued and includes the type of events that triggered.
```
this.RPanel.MBSystem.on('SStatusChanged', (EventStr) => {
    console.log(`System Status Changed, New Status: ${EventStr}`);
});

// Listen specific event for System Panel
let Monitored_System = this.RPanel.MBSystem;
Monitored_System.on('LowBattery', () => {
    console.log(`System LowBattery`);
});
Monitored_System.on('BatteryOk', () => {
    console.log(`System BatteryOk`);
});
Monitored_System.on('ACUnplugged', () => {
    console.log(`System ACUnplugged`);
});
Monitored_System.on('ACPlugged', () => {
    console.log(`System ACPlugged`);
});
Monitored_System.on('PhoneLineTrouble', () => {
    console.log(`System PhoneLineTrouble`);
});
Monitored_System.on('PhoneLineOk', () => {
    console.log(`System PhoneLineOk`);
});
Monitored_System.on('ClockTrouble', () => {
    console.log(`System ClockTrouble`);
});
Monitored_System.on('ClockOk', () => {
    console.log(`System ClockOk`);
});
Monitored_System.on('DefaultSwitchOn', () => {
    console.log(`System DefaultSwitchOn`);
});
Monitored_System.on('DefaultSwitchOff', () => {
    console.log(`System DefaultSwitchOff`);
});
Monitored_System.on('MS1ReportTrouble', () => {
    console.log(`System MS1ReportTrouble`);
});
Monitored_System.on('MS1ReportOk', () => {
    console.log(`System MS1ReportOk`);
});
Monitored_System.on('MS2ReportTrouble', () => {
    console.log(`System MS2ReportTrouble`);
});
Monitored_System.on('MS2ReportOk', () => {
    console.log(`System MS2ReportOk`);
});
Monitored_System.on('MS3ReportTrouble', () => {
    console.log(`System MS3ReportTrouble`);
});
Monitored_System.on('MS3ReportOk', () => {
    console.log(`System MS3ReportOk`);
});
Monitored_System.on('BoxTamperOpen', () => {
    console.log(`System BoxTamperOpen`);
});
Monitored_System.on('BoxTamperClosed', () => {
    console.log(`System BoxTamperClosed`);
});
Monitored_System.on('JammingTrouble', () => {
    console.log(`System JammingTrouble`);
});
Monitored_System.on('JammingOk', () => {
    console.log(`System JammingOk`);
});
Monitored_System.on('ProgModeOn', () => {
    console.log(`System ProgModeOn`);
});
Monitored_System.on('ProgModeOff', () => {
    console.log(`System ProgModeOff`);
});
Monitored_System.on('LearnModeOn', () => {
    console.log(`System LearnModeOn`);
});
Monitored_System.on('LearnModeOff', () => {
    console.log(`System LearnModeOff`);
});
Monitored_System.on('ThreeMinBypassOn', () => {
    console.log(`System ThreeMinBypassOn`);
});
Monitored_System.on('ThreeMinBypassOff', () => {
    console.log(`System ThreeMinBypassOff`);
});
Monitored_System.on('WalkTestOn', () => {
    console.log(`System WalkTestOn`);
});
Monitored_System.on('WalkTestOff', () => {
    console.log(`System WalkTestOff`);
});
Monitored_System.on('AuxTrouble', () => {
    console.log(`System AuxTrouble`);
});
Monitored_System.on('AuxOk', () => {
    console.log(`System AuxOk`);
});
Monitored_System.on('Rs485BusTrouble', () => {
    console.log(`System Rs485BusTrouble`);
});
Monitored_System.on('Rs485BusOk', () => {
    console.log(`System Rs485BusOk`);
});
Monitored_System.on('LsSwitchOn', () => {
    console.log(`System LsSwitchOn`);
});
Monitored_System.on('LsSwitchOff', () => {
    console.log(`System LsSwitchOff`);
});
Monitored_System.on('BellSwitchOn', () => {
    console.log(`System BellSwitchOn`);
});
Monitored_System.on('BellSwitchOff', () => {
    console.log(`System BellSwitchOff`);
});
Monitored_System.on('BellTrouble', () => {
    console.log(`System BellTrouble`);
});
Monitored_System.on('BellOk', () => {
    console.log(`System BellOk`);
});
Monitored_System.on('BellTamper', () => {
    console.log(`System BellTamper`);
});
Monitored_System.on('BellTamperOk', () => {
    console.log(`System BellTamperOk`);
});
Monitored_System.on('ServiceExpired', () => {
    console.log(`System ServiceExpired`);
});
Monitored_System.on('ServiceOk', () => {
    console.log(`System ServiceOk`);
});
Monitored_System.on('PaymentExpired', () => {
    console.log(`System PaymentExpired`);
});
Monitored_System.on('PaymentOk', () => {
    console.log(`System PaymentOk`);
});
Monitored_System.on('ServiceModeOn', () => {
    console.log(`System ServiceModeOn`);
});
Monitored_System.on('ServiceModeOff', () => {
    console.log(`System ServiceModeOff`);
});
Monitored_System.on('DualPathOn', () => {
    console.log(`System DualPathOn`);
});
Monitored_System.on('DualPathOff', () => {
    console.log(`System DualPathOff`);
});
```
## Zones object

The 'Zones' object represents an Array of all the zones present on the system.
Each zone represents an Object having several properties and events allowing to know at any time the state of each detector.

The call of a particular zone is done by invoking the ById method of the 'Zones' object
```
// Zone Object
this.RPanel.Zones;

// Call a specific Zone (Zone x)
let Zone = this.RPanel.Zones.ById(x)
// 
```
*The zone ID corresponds to its number on the system:
Zone 1 has an Id of 1 (no offset).*

The call can also be done in a more traditional way with an Array; in this case you will have to manage yourself the exception which could occur when calling a non-existent zone.

But in this case it is also necessary to take into account that the index of the Array starts at 0 :

```
// Partitions Object
this.RPanel.Zones;

// Call a specific Zone (Zone x)
let Zone = this.RPanel.Zones[x - 1]
```

### Properties
The Zone Object has several public properties accessible via its instance:

```
// Integer : Zone Number
this.Zone.Id;
// String : Indicates the name of the Detector as defined in its programming.
this.Zone.Label;
// Boolean : Indicates if the Panel configuration has been modified (entered programming mode) 
// since the connection was established
this.NeedUpdateConfig;
// Integer : Indicates the type of the zone by its numeric value.
this.Zone.TypeStr;
// String : Indicates the type of the zone by its literal value.
this.Zone.TypeStr;
// Array of integer : Array indicating which partition(s) the zone belongs to.
this.Zone.Parts;
// Boolean : Indicates the trigger state of the detector.
this.Zone.Open;
// Boolean : Indicates whether the zone is armed or not.
this.Zone.Arm;
// Boolean : Indicates if the zone is in alarm.
this.Zone.Alarm;
// Boolean : Indicates whether the zone is in tamper state.
this.Zone.Tamper;
// Boolean : Indicates whether the zone has a problem.
this.Zone.Trouble;
// Boolean : Indicates if the zone is lost (loss of radio or bus communication).
this.Zone.Lost;
// Boolean : Indicates if the zone is in low battery (radio device).
this.Zone.LowBattery;
// Boolean : Indicates whether the zone is Bypassed or not.
this.Zone.Bypass;
// Boolean : Indicates whether the zone has a communication problem (radio or 
// bus disturbed but not yet lost).
this.Zone.CommTrouble;
// Boolean : Indicates if the zone is in immersion test (this mode allows to 
// exclude a zone for 14 days and to reinteger it automatically at the end 
// of this period if no alarm has been generated). 
this.Zone.SoakTest;
// Boolean : Indicates a 24 Hour Zone 
// this event only occurs when risco-lan-bridge receives from the control panel 
// updates the status of the zone for the first time.
// When the discovery mode is activated, this information does not generate 
// any event after the panel emits its 'SystemInitCompleted' event.
// Otherwise this event is generated when the first status of the zone is received.
this.Zone.Hours24;
// Boolean : Indicates an unused zone (true by default)
// this event only occurs when risco-lan-bridge receives from the control panel 
// updates the status of the zone for the first time.
// When the discovery mode is activated, this information does not generate 
// any event after the panel emits its 'SystemInitCompleted' event.
// Otherwise this event is generated when the first status of the zone is received.
this.Zone.NotUsed;
// String : Indicates the technology of the detector. Can take one of the following 
// values:
// 'Wired Zone'
// 'Bus Zone'
// 'Wireless Zone'
// 'None'
this.Zone.Techno;

```

### Events

Each of the preceding states is linked to a specific event.
In addition to these specific events, a general event is also issued and includes the type of events that triggered.
```
// General Event for all Zones
this.RPanel.Zones.on('ZStatusChanged', (Id, EventStr) => {
    console.log(`Zones Status Changed :\n Zone Id ${Id}\n New Status: ${EventStr}`);
});

// Listen specific event for zone Id 1
let  Monitored_Zone = this.RPanel.Zones.ById(1);

// this.Zone.Open => Open || Closed
Monitored_Zone.on('Open', (Id) => {
	console.log(`Zone ${Id} Open`)
});
Monitored_Zone.on('Closed', (Id) => {
	console.log(`Zone ${Id} Closed`)
});

// this.Zone.Arm => Armed || Disarmed
Monitored_Zone.on('Armed', (Id) => {
	console.log(`Zone ${Id} Armed`)
});
Monitored_Zone.on('Disarmed', (Id) => {
	console.log(`Zone ${Id} Disarmed`)
});

// this.Zone.Alarm => Alarm || StandBy
Monitored_Zone.on('Alarm', (Id) => {
	console.log(`Zone ${Id} Alarm`)
});
Monitored_Zone.on('StandBy', (Id) => {
	console.log(`Zone ${Id} StandBy`)
});

// this.Zone.Tamper => Tamper || Hold
Monitored_Zone.on('Tamper', (Id) => {
	console.log(`Zone ${Id} Tamper`)
});
Monitored_Zone.on('Hold', (Id) => {
	console.log(`Zone ${Id} Hold`)
});

// this.Zone.Trouble => Trouble || Sureness
Monitored_Zone.on('Trouble', (Id) => {
	console.log(`Zone ${Id} Trouble`)
});
Monitored_Zone.on('Sureness', (Id) => {
	console.log(`Zone ${Id} Located`)
});

// this.Zone.Lost => Lost || Located
Monitored_Zone.on('Lost', (Id) => {
	console.log(`Zone ${Id} Lost`)
});
Monitored_Zone.on('Located', (Id) => {
	console.log(`Zone ${Id} Located`)
});

// this.Zone.LowBattery => LowBattery || BatteryOk
Monitored_Zone.on('LowBattery', (Id) => {
	console.log(`Zone ${Id} LowBattery`)
});
Monitored_Zone.on('BatteryOk', (Id) => {
	console.log(`Zone ${Id} BatteryOk`)
});

// this.Zone.Bypass => Bypassed || UnBypassed
Monitored_Zone.on('Bypassed', (Id) => {
	console.log(`Zone ${Id} Bypassed`)
});
Monitored_Zone.on('UnBypassed', (Id) => {
	console.log(`Zone ${Id} UnBypassed`)
});

// this.Zone.CommTrouble => CommTrouble || CommOk
Monitored_Zone.on('CommTrouble', (Id) => {
	console.log(`Zone ${Id} CommTrouble`)
});
Monitored_Zone.on('CommOk', (Id) => {
	console.log(`Zone ${Id} CommOk`)
});

// this.Zone.SoakTest => SoakTest || ExitSoakTest
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

// this.Zone.Hours24 => 24HoursZone || NormalZone
Monitored_Zone.on('24HoursZone', (Id) => {
	console.log(`Zone ${Id} 24HoursZone`)
});
Monitored_Zone.on('NormalZone', (Id) => {
	console.log(`Zone ${Id} NormalZone`)
});

// this.Zone.NotUsed => ZoneNotUsed || ZoneUsed
Monitored_Zone.on('ZoneNotUsed', (Id) => {
	console.log(`Zone ${Id} ZoneNotUsed`)
});
Monitored_Zone.on('ZoneUsed', (Id) => {
	console.log(`Zone ${Id} ZoneUsed`)
});
```

### Commands

#### Method 1 
The zone is an Object with which you can interact to define it in the Bypassed state or not.

However, it is not possible to define the desired state, we can just toggle its state; it will therefore be necessary to check the state of the zone before switching its state if you want to put it in one of the two possible states.

This is done using the Toggle Bypass Zone function of the Risco Panel object.

```
// We want to Bypass zone 1:
if ((this.RPanel.Zones.ById(1)).Bypass) {
	if (await  this.RPanel.ToggleBypassZone(1)) {
		console.log('Zone Bypass Successfully Toggled');
	} else {
		console.log('Error on Zone Bypass Toggle');
	}
}
```


#### Method 2

You can also perform a direct command from the Object Zone:
```
// We want to Bypass zone 1:
let TestZone = this.RPanel.Zones.ById(1);

if (await TestZone.ToggleBypass()) {
    console.log('Zone Bypass Successfully Toggled');
} else {
	console.log('Error on Zone Bypass Toggle');
}
```

## Outputs object

The 'Outputs' object represents an Array of all the Output present on the system.
Each Output represents an Object having several properties and events allowing to know at any time the state of each Ouput.

The call of a particular Output is done by invoking the ById method of the 'Outputs' object
```
// Outputs Object
this.RPanel.Ouputs;

// Call a specific Ouput (Output x)
let Output = this.RPanel.Ouputs.ById(x)
// 
```
*The Output ID corresponds to its number on the system:
Ouput 1 has an Id of 1 (no offset).*

The call can also be done in a more traditional way with an Array; in this case you will have to manage yourself the exception which could occur when calling a non-existent Output.
But in this case it is also necessary to take into account that the index of the Array starts at 0 :

```
// Outputs Object
this.RPanel.Ouputs;

// Call a specific Ouput (Output x)
let Output = this.RPanel.Ouputs[x - 1]
```

### Properties

```
// Integer : Output Number
this.Id;
// String : Indicates the name of the Output as defined in its programming.
this.Label;
// Boolean : Indicates if the Panel configuration has been modified (entered programming mode) 
// since the connection was established
this.NeedUpdateConfig;
// String : Indicates the type of the output (Latch or pulse)
this.Type;
// Boolean : Indicates whether the output is in the active state or not
// In the case of a pulse output, this state is not updated by the Risco Panel.
this.Active = false;


```

### Events

Each of the preceding states is linked to a specific event.
In addition to these specific events, a general event is also issued and includes the type of events that triggered.
```
// General Event for all Outputs
this.RPanel.Zones.on('OStatusChanged', (Id, EventStr) => {
    console.log(`Output Status Changed :\n Output Id ${Id}\n New Status: ${EventStr}`);
});

// Listen specific event for Output Id 1
let  Monitored_Output = this.RPanel.Outputs.ById(1);
// this.Output.Active => Actived || Deactived 
Monitored_Output.on('Actived', (Id) => {
	console.log(`Output ${Id} Actived`)
});
Monitored_Output.on('Deactived', (Id) => {
	console.log(`Output ${Id} Deactived`)
});
```

### Commands

#### Method 1

The Output is an Object with which you can interact to Toggle state.

However, as with zones, it is not possible to set the desired state, we can just toggle its state; it will therefore be necessary to check the state of the output before switching its state if you want to put it in one of the two possible states (is not required for pulsed outputs since these outputs do not really have a fixed state ).

This is done using the 'ToggleOutput' functions of the Risco Panel object.

```
if (await  this.RPanel.ToggleOutput(1)) {
	console.log('Output Successfully Toggled');
} else {
	console.log('Error on Output Toggle');
}
```

#### Method 2

You can also perform a direct command from the Object Output:
```
// We want to Test with Output 1:
let TestOutput = this.RPanel.Outputs.ById(1);

if (await TestOutput.ToggleOutput()) {
    console.log('Output Successfully Toggled');
} else {
	console.log('Error onToggle Output');
}
```

## Partitions object

The 'Partitions' object represents an Array of all the Partitions present on the system.
Each Parition represents an Object having several properties and events allowing to know at any time the state of each Partition.

The call of a particular Partition is done by invoking the ById method of the 'Partitions' object
```
// Partitions Object
this.RPanel.Partitions;

// Call a specific Partition (Partition x)
let Partition = this.RPanel.Partitions.ById(x)
// 
```
*The Partition ID corresponds to its number on the system:
Partition 1 has an Id of 1 (no offset).*

The call can also be done in a more traditional way with an Array; in this case you will have to manage yourself the exception which could occur when calling a non-existent Partition.
But in this case it is also necessary to take into account that the index of the Array starts at 0 :

```
// Partitions Object
this.RPanel.Partitions;

// Call a specific Partition (Partition x)
let Partition = this.RPanel.Partitions[x - 1]
```

### Properties

```
// Integer : Partition Number
this.Partition.Id;
// String : Indicates the name of the Partition as defined in its programming.
this.Partition.Label;
// Boolean : Indicates if the Panel configuration has been modified (entered programming mode) 
// since the connection was established
this.NeedUpdateConfig;
// Boolean : Indicates the alarm state of the partition.
this.Partition.Alarm = false;
// Boolean : Indicates the duress state of the partition 
// (When a duress code has been entered).
this.Partition.Duress = false;
// Boolean : Occurs when several false codes have been entered.
this.Partition.FalseCode = false;
// Boolean : Indicates that at least one Fire zone is triggered.
// (or that the Fire keys have been used on a keypad belonging 
// to this partition).
this.Partition.Fire = false;
// Boolean : Indicates that at least one Panic zone is triggered 
// (or that the Panic keys have been used on a keypad belonging 
// to this partition).
this.Partition.Panic = false;
// Boolean : Indicates that at least one Medical zone is triggered 
// (or that the Medical keys have been used on a keypad belonging 
// to this partition).
this.Partition.Medic = false;
// Boolean : In the case of a system configured for inactivity mode 
// (monitoring of dependent, invalid or other persons), is triggered 
// when no zone configured in this mode has been triggered within 
// the time allowed.
this.Partition.NoActivity = false;
// Boolean : Indicates whether the partition is armed in away mode.
this.Partition.Arm = false;
// Boolean : Indicates whether the partition is armed in stay at home mode.
this.Partition.HomeStay = false;
// Boolean : Indicates if the partition is capable of being armed (no 
// fault preventing arming). 
this.Partition.Ready = false;
// Boolean : Indicates a partition occupancy state (will be true if at 
// least 1 detector is triggered).
this.Partition.Open = false;
// Boolean : Indicates whether the partition is declared (will be true 
// if at least one zone is assigned to it). 
this.Partition.Exist = false;
// Boolean : Indicates whether there are any alarm events in memory
// that require acknowledgment.
this.Partition.ResetRequired = false;
// Boolean : Indicates, for each group depending on the partition, 
// the arming status.
this.Partition.GrpAArm = false;
this.Partition.GRPBArm = false;
this.Partition.GrpCArm = false;
this.Partition.GRPDArm = false;
// Boolean : Indicates if the partition encounters a fault
this.Partition.Trouble = false;


```

### Events

Each of the preceding states is linked to a specific event.
In addition to these specific events, a general event is also issued and includes the type of events that triggered.
```

this.RPanel.PArtitions.on('PStatusChanged', (Id, EventStr) => {
    console.log(`Partitions Status Changed :\n Partition Id ${Id}\n New Status: ${EventStr}`);
});

// Listen specific event for Partition Id 1
let Monitored_Part = this.RPanel.Partitions.ById(1);

// this.Partition.Alarm => Alarm || StandBy
Monitored_Part.on('Alarm', (Id) => {
    console.log(`Partition ${Id} Alarm`);
});
Monitored_Part.on('StandBy', (Id) => {
    console.log(`Partition ${Id} StandBy`);
});

// this.Partition.Duress => Duress || Free
Monitored_Part.on('Duress', (Id) => {
    console.log(`Partition ${Id} Duress`);
});
Monitored_Part.on('Free', (Id) => {
    console.log(`Partition ${Id} Free`);
});

// this.Partition.FalseCode => FalseCode || CodeOk
Monitored_Part.on('FalseCode', (Id) => {
    console.log(`Partition ${Id} FalseCode`);
});
Monitored_Part.on('CodeOk', (Id) => {
    console.log(`Partition ${Id} CodeOk`);
});

// this.Partition.Fire => Fire || NoFire
Monitored_Part.on('Fire', (Id) => {
    console.log(`Partition ${Id} Fire`);
});
Monitored_Part.on('NoFire', (Id) => {
    console.log(`Partition ${Id} NoFire`);
});

// this.Partition.Panic => Panic || NoPanic
Monitored_Part.on('Panic', (Id) => {
    console.log(`Partition ${Id} Panic`);
});
Monitored_Part.on('NoPanic', (Id) => {
    console.log(`Partition ${Id} NoPanic`);
});

// this.Partition.Medic => Medic || NoMedic
Monitored_Part.on('Medic', (Id) => {
    console.log(`Partition ${Id} Medic`);
});
Monitored_Part.on('NoMedic', (Id) => {
    console.log(`Partition ${Id} NoMedic`);
});

// this.Partition.Arm => Armed || Disarmed
Monitored_Part.on('Armed', (Id) => {
    console.log(`Partition ${Id} Armed`);
});
Monitored_Part.on('Disarmed', (Id) => {
    console.log(`Partition ${Id} Disarmed`);
});

// this.Partition.HomeStay => HomeStay || HomeDisarmed
Monitored_Part.on('HomeStay', (Id) => {
    console.log(`Partition ${Id} HomeStay`);
});
Monitored_Part.on('HomeDisarmed', (Id) => {
    console.log(`Partition ${Id} HomeDisarmed`);
});

// this.Partition.Ready => Ready || NotReady
Monitored_Part.on('Ready', (Id) => {
    console.log(`Partition ${Id} Ready`);
});
Monitored_Part.on('NotReady', (Id) => {
    console.log(`Partition ${Id} NotReady`);
});

// this.Partition.Open => ZoneOpen || ZoneClosed
Monitored_Part.on('ZoneOpen', (Id) => {
    console.log(`Partition ${Id} ZoneOpen`);
});
Monitored_Part.on('ZoneClosed', (Id) => {
    console.log(`Partition ${Id} ZoneClosed`);
});

// this.Partition.ResetRequired => MemoryEvent || MemoryAck
Monitored_Part.on('MemoryEvent', (Id) => {
    console.log(`Partition ${Id} MemoryEvent`);
});
Monitored_Part.on('MemoryAck', (Id) => {
    console.log(`Partition ${Id} MemoryAck`);
});

// this.Partition.NoActivity => ActivityAlert || ActivityOk
Monitored_Part.on('ActivityAlert', (Id) => {
    console.log(`Partition ${Id} ActivityAlert`);
});
Monitored_Part.on('ActivityOk', (Id) => {
    console.log(`Partition ${Id} ActivityOk`);
});

// this.Partition.GrpAArm => GrpAArmed || GrpADisarmed
Monitored_Part.on('GrpAArmed', (Id) => {
    console.log(`Partition ${Id} GrpAArmed`);
});
Monitored_Part.on('GrpADisarmed', (Id) => {
    console.log(`Partition ${Id} GrpADisarmed`);
});

// this.Partition.GrpBArm => GrpBArmed || GrpBDisarmed
Monitored_Part.on('GrpBArmed', (Id) => {
    console.log(`Partition ${Id} GrpBArmed`);
});
Monitored_Part.on('GrpBDisarmed', (Id) => {
    console.log(`Partition ${Id} GrpBDisarmed`);
});

// this.Partition.GrpCArm => GrpCArmed || GrpCDisarmed
Monitored_Part.on('GrpCArmed', (Id) => {
    console.log(`Partition ${Id} GrpCArmed`);
});
Monitored_Part.on('GrpCDisarmed', (Id) => {
    console.log(`Partition ${Id} GrpCDisarmed`);
});

// this.Partition.GrpDArm => GrpDArmed || GrpDDisarmed
Monitored_Part.on('GrpDArmed', (Id) => {
    console.log(`Partition ${Id} GrpDArmed`);
});
Monitored_Part.on('GrpDDisarmed', (Id) => {
    console.log(`Partition ${Id} GrpDDisarmed`);
});

// this.Partition.Trouble => Trouble || Ok
Monitored_Part.on('Trouble', (Id) => {
    console.log(`Partition ${Id} Trouble`);
});
Monitored_Part.on('Ok', (Id) => {
    console.log(`Partition ${Id} Ok`);
});
```

### Commands

#### Method 1
The Partition is an Object with which you can interact to Arm/Disarm it.
Arming can be total (away) or partial (stay).

This is done using the 'ArmPart' or 'DisarmPart' functions of the Risco Panel object.

```
// For arming, you must provide both the Partition ID and the desired arming type
// 0 => Full Arm
// 1 => Partial Arm (Stay at Home)
if (await  this.RPanel.ArmPart(1, 0)) {
	console.log('Partition Successfully Armed/Disarmed');
} else {
	console.log('Error on PArtition Arming/Disaming');
}

// Request to Disarm Partition Id 1
// For disarming, only the partition ID is required
if (await  this.RPanel.DisarmPart(1)) {
	console.log('Partition Successfully Armed/Disarmed');
} else {
	console.log('Error on PArtition Arming/Disaming');
}
```

#### Method 2

You can also perform a direct command from the Object Partition:
```
// We want to Test with Partition 1:
let TestPart = this.RPanel.Partitions.ById(1);

// Full Arm
if (await TestPart.AwayArm()) {
    console.log('Partition Successfully Armed');
} else {
	console.log('Error on Partition Arming');
}

// Stay Arm
if (await TestPart.HomeStayArm()) {
    console.log('Partition Successfully Armed');
} else {
	console.log('Error on Partition Arming');
}

// Disarm
if (await TestPart.Disarm()) {
    console.log('Partition Successfully Armed');
} else {
	console.log('Error on Partition Arming');
}
```