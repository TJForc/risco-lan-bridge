/* 
 *  Package: risco-lan-bridge
 *  File: RCrypt.js
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

const PanelType = constants.PanelType;
const CRCArray_base64 = constants.CRCArray_base64;

/**
 * 	Create a Crypt Object for Encoding / Decoding Risco Communication
 * 	This Pseudo Buffer is based on Panel Id
 *  When Panel Id is 0, no encryption is applied
 *  Default Panel Id is 0001
 */

 class Risco_Crypt {
 	constructor(CryptOptions) {
		this.Panel_Id = (CryptOptions.Panel_Id !== undefined) ? CryptOptions.Panel_Id : 1 ;
		this.Encoding = CryptOptions.Encoding || 'utf-8';
		this.logger = CryptOptions.logger;
		this.log = CryptOptions.log;

		if (this.CryptBuffer == null) {
			this.UpdatePseudoBuffer();
 		}
 		this.CryptCommand = false;
 		let buffCRC = new Buffer.from(CRCArray_base64, 'base64');
 		this.CRCArray = Uint16Array.from(eval(buffCRC.toString(this.Encoding)));
		this.CryptPos = 0;
		this.CRCBase = 65535;
 	}

	/*
	 *	Force update of the encryption table
	 */
	UpdatePseudoBuffer() {
		this.CryptBuffer = this.CreatePseudoBuffer(this.Panel_Id);
	}

 	/*
 	 * Create the pseudo buffer used to encode/decode communication
	 * @param 	{integer} 		panel_id
	 * @return 	{Uint8Array}	PseudoBuffer
	 * 
 	 */
 	CreatePseudoBuffer(panel_id) {
 		let BufferLength = 255;
 		let PseudoBuffer = new Uint8Array(BufferLength);
		let pid = panel_id;
		let numArray = new Uint16Array([2, 4, 16, 32768]);
		if (pid !== 0) {
			for (let index = 0; index < BufferLength ; ++index) {
				let n1 = 0;
				let n2 = 0;
				for (n1 = 0; n1 < 4; ++n1) {
					if ((pid & numArray[n1]) > 0) {
						n2 ^= 1;
					}
				}
				pid = pid << 1 | n2;
				PseudoBuffer[index] = (pid & BufferLength);
			}
		} else {
			PseudoBuffer.fill(0);
		}
		let StringedPseudoBuffer = (() => {
			let result = new Array(0);
			for (const value of PseudoBuffer) {
				result.push(value);
			}
			return `[${result.join(',')}]`;
		})();
		this.logger(this.log, Log_Level.DEBUG, `Pseudo Buffer Created for Panel Id(${this.Panel_Id}): \n${StringedPseudoBuffer}`);
      	return PseudoBuffer;
    }

 	/*
 	 * Convert String to byte array
 	 * @param	{string} 	Command
	 * @return	{Buffer} 	bytes
 	 */
 	StringToByte(Command) {
		let bytes = new Buffer.from(Command, this.Encoding);
  		return bytes;
 	}

	/*
 	 * Convert String to byte array
 	 * @param	{string} 	Command
	 * @return	{Buffer} 	bytes
 	 */
	ByteToString(bytes) {
		return new Buffer.from(bytes, this.Encoding).toString(this.Encoding);
	}
	
	/*
	 * Verify if Received Data CRC is OK
	 * @param	{string}	UnCryptedMessage
	 * @param	{string}	RcvCRC
	 * @return	{boolean}
	 */
	IsValidCRC(UnCryptedMessage, RcvCRC) {
		let StrNoCRC = UnCryptedMessage.substring(0, UnCryptedMessage.indexOf(String.fromCharCode(23)) + 1 );

		let MsgCRC = this.GetCommandCRC(StrNoCRC);

		if (RcvCRC == MsgCRC) {
			this.logger(this.log, Log_Level.DEBUG, `CRC Ok`);
			return true;
		} else {
			this.logger(this.log, Log_Level.DEBUG, `CRC Not Ok`);
			return false;
		}
 	}

	/*
	 * Calculate CRC for Command based on original character(not encrypted) 
	 * and CRC array Value
	 * @param 	{Buffer} 	CmdBytes
	 * @return 	{string} 	resultCRC
	 */
	GetCommandCRC(CmdBytes) {
		let CRCBase = 65535;
		let ByteBuf = new Buffer.from(CmdBytes);
		for (let i=0; i < ByteBuf.length; i++) {
			CRCBase = CRCBase >>> 8 ^ this.CRCArray[ CRCBase & 255 ^ ByteBuf[i]];
		}

		let resultCRC = ''.concat(
			(CRCBase >>> 12 & 15).toString(16).toUpperCase(),
			((CRCBase >>> 8) & 15).toString(16).toUpperCase(),
			((CRCBase >>> 4) & 15).toString(16).toUpperCase(),
			((CRCBase & 15).toString(16).toUpperCase())
		);
		this.logger(this.log, Log_Level.DEBUG, `Command CRC Value : ${resultCRC}`);
		return resultCRC;
	}

	/*
 	 * Encode the Message with PseudoBuffer
 	 * Each Char is XOred with same index char in PseudoBuffer
 	 * Some char are added (start of frame = 2, end of frame = 3 and encryption indicator = 17)
 	 * 
 	 * Command example :
 	 * 01RMT=5678 ABCD
 	 * Where :
 	 * 01 	=> Command number (from 01 to 49)
	 * RMT=	=> Command itself (ReMoTe)
	 * 5678 => Default passcode for Remote
	 * ABCD => CRC Value
	 * 
	 * @param	{string} 	Command
	 * @param	{string} 	Id of Command
	 * @return	{Buffer} 	Encrypted
 	 */
 	GetCommande(Command, Cmd_Id, ForceCrypt = undefined) {
		this.CryptPos = 0;
		this.CRCBase = 65535;
 		if (this.CryptBuffer != null) {
 			let Encrypted = [];
 			//byte = 2 => start of Command
 			Encrypted = Encrypted.concat([2]);
 			if (ForceCrypt === undefined) {
				if (this.CryptCommand) {
					//byte = 17 => encryption indicator
					Encrypted = Encrypted.concat([17]);
				}
 			} else {
				if (ForceCrypt) {
					//byte = 17 => encryption indicator
					Encrypted = Encrypted.concat([17]);
				}
			}
 			//Add Cmd_Id to Command and Separator character between Cmd and CRC value
 			let FullCmd = ''.concat(Cmd_Id, Command, new Buffer.from([23]).toString());
 			let CommandBytes = this.StringToByte(FullCmd);
 			//Encrypt Command
 			Encrypted = Encrypted.concat(this.EncryptChars(CommandBytes));
			//Calculate CRC
			let CRCValue = this.GetCommandCRC(CommandBytes);
			//Add Encrypted CRC Chars
			Encrypted = Encrypted.concat(this.EncryptChars(CRCValue));
			//Add Terminal Char
			Encrypted = Encrypted.concat([3]);
 			return new Buffer.from(Encrypted, this.Encoding);
 		} else {
 			return null;
 		}
 	}

	/* 
	 * Encryption/Decryption mechanisc
	 * @param	{Buffer} 	CharsCmd
	 * @return	{Array}  	CryptedChars
	 */
 	EncryptChars(CharsCmd, offset) {
		offset = offset || 0;
 		let CryptedChars = [];
		let Chars = new Buffer.from(CharsCmd, this.Encoding);
		for (let i = 0; i < Chars.length; i++) {
			if (this.CryptCommand) {
				Chars[i] ^= this.CryptBuffer[this.CryptPos - offset];
			}
 			switch (Chars[i]) {
 				case 2:
				case 3:
 				case 16:
 					CryptedChars = CryptedChars.concat([16]);
 			}
 			CryptedChars = CryptedChars.concat([Chars[i]]);
			this.CryptPos++;
 		}
		return CryptedChars;
 	}

	/* 
	 * Decryption mechanisc
	 * @param	{Buffer} 	CharsCmd
	 * @param	{Integer} 	offset
	 * @return	{Array}  	CryptedChars
	 */
 	DecryptChars(CharsCmd, offset) {
		offset = offset || 0;
 		let CryptedChars = [];
		let Chars = CharsCmd;
		for (let i = (this.CryptCommand ? 2 : 1); i < Chars.length - 1; i++) {
			if (this.CryptCommand) {
				if ((Chars[i] == 16) && (Chars[i + 1] == 2 || Chars[i + 1] == 3 || Chars[i + 1] == 16)) {
					offset++;
				} else {
					Chars[i] ^= this.CryptBuffer[this.CryptPos - offset];
				}
			}
			if (Chars[i] != 16) {
 				CryptedChars = CryptedChars.concat([Chars[i]]);
			}
			this.CryptPos++;
 		}
		return CryptedChars;
 	}

	/*
	 * Decode received message and extract Command id, command and CRC Value
	 * @param	{string}	Message
	 * @return 	{string}	StrMessage (Full Message Decrypted)
	 * 			{string}	Command Id
	 * 			{string}	Command itself
	 * 			{string}	CRC Value
	 * 			{boolean}	IsValidCRC
	 */
 	DecodeMessage(Message) {
		this.CryptPos = 0;
		let offset = 0;
		if (Message[1] == 17) {
			this.CryptCommand = true;
		} else {
			this.CryptCommand = false;
		}
		let DecryptedMsgBytes = this.DecryptChars(Message),
			DecryptedMessage = this.ByteToString(DecryptedMsgBytes);
		let cmd_id, Command, CRCValue;
		if (DecryptedMessage.startsWith('N') || DecryptedMessage.startsWith('B')) {
			cmd_id = '';
			Command = DecryptedMessage.substring(0, DecryptedMessage.indexOf(String.fromCharCode(23))),
			CRCValue = DecryptedMessage.substring(DecryptedMessage.indexOf(String.fromCharCode(23)) + 1);
		} else {
			cmd_id = DecryptedMessage.substring(0, 2),
			Command = DecryptedMessage.substring(2, DecryptedMessage.indexOf(String.fromCharCode(23))),
			CRCValue = DecryptedMessage.substring(DecryptedMessage.indexOf(String.fromCharCode(23)) + 1);
		}
		return [cmd_id, Command, this.IsValidCRC(DecryptedMessage, CRCValue)];
 	}
 }

module.exports = {
	Risco_Crypt:  Risco_Crypt
}