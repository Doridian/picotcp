'use strict';

let wstap;
let socket;

function realmain() {
	wstap = new Module.WSTAP('ws://127.0.0.1:9000');
	wstap.on('ready', connect);
	window.wstap = wstap;
}

function connect() {
	socket = new Module.Socket();
	window.socket = socket;
	socket.connect('10.1.0.1', 8000);
	socket.on('data');
}

function main() {
	Module.postRun.push(realmain);
}

