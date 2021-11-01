# Change Log

All notable changes to this project will be documented in this file.

## 0.10.4 (2021-01-11)
* Merge Pull Requests from vanackej (#6 - Various bug fixes and code improvements by vanackej )

## 0.10.3 (2021-13-10)
* Modification of the Timeout text in the logs when sending an order (#4)
* Modification of the logging level during a timeout (this is now DEBUG information, 
  the timeout being caused by the lack of response from the control unit and not by an 
  execution error of this code).
* During a Timeout, the request is now re-sent when it was not the case before.

## 0.10.2 (2021-13-10)
* Fix Mispelled module exports in index.js

## 0.10.1 (2021-13-10)
* Fix error with Prog Mode
* Add missing trim in Partition Label
* Add Proxy Mode for connection to Panel
* Fix error on 'MaxZones/Maxoutputs is not function'
* Improved Auto Reconnection procedure for direct mode.
* Add Changelogs File

## 0.9.8 (2021-28-08)
* Code improvements
* Fix error 'undefined' in log
* Code redesign to avoid errors Circular Reference
* Rewrite the logic of the Outputs and add new properties
* Change Prototype function name : Arm and Stay function are deprecated and respectively 
replaced bay 'AwayArm' and 'HomeStayArm'.
* Add new Option : Enable_RiscoCloud

## 0.9.7 (2021-25-07)
* Code improvements
* Fix trim error in Device's Label

## 0.9.6 (2021-25-07)
* Code improvements
* Fix empty spaces in Device's Label
* Update README.md

## 0.9.5 (2021-15-07)
* Update .npmignore

## 0.9.4 (2021-14-07)
* Code improvements
* Fix error on 'NotUsed' proprtie for Device
* Fix Error for displaying error codes
* Fixed an error causing a bad timeout when sending commands
* no npm published

## 0.9.3 (2021-13-07)
* Code improvements

## 0.9.2 (2021-13-07)
* Code improvements

## 0.9.1 (2021-12-07)
* Code improvements
* Add Direct Commands to Devices
* Update Manual
* First npm packages

## 0.9.0 (2021-11-07)
* First Releases as beta Releases
