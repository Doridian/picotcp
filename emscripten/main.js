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
	socket.connect('www.google.de', 80);
	//socket.connect('172.217.21.110', 80);
	socket.once('connected', () => {
		socket.writeString('GET / HTTP/1.1\nHost: www.google.de\nUser-Agent: picoHTTP\nConnection: close\n\n');
	});
	socket.on('data', () => {
		console.log('RX', socket.readAllString());
	});
}

function main() {
	Module.postRun.push(realmain);
}

