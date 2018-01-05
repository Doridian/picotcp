'use strict';

var Module = {};

const wstaps = {};
const wstap_devs = {};
Module._wstaps = wstaps;
Module._wstap_devs = wstap_devs;
let lastfd = 0;

function WSTAP(addr) {
	this.buffer = [];
	this.ready = false;
	this.ws = new WebSocket(addr);
	this.ws.binaryType = 'arraybuffer';
	this.ws.onmessage = (data) => {
		data = data.data;
		if (typeof data === 'string') {
			const spl = data.split('|');
			this.mac = spl[0];
			console.log(`MAC: ${this.mac}`);

			this.mtu = parseInt(spl[1], 10);
			console.log(`Link-MTU: ${this.mtu}`);
			this.mtu -= 4;
			console.log(`TAP-MTU: ${this.mtu}`);

			const name = 'wst' + this.id;
			const nameptr = Module._malloc(name.length + 1);
			Module.writeAsciiToMemory(name, nameptr);

			const macptr = Module._malloc(6);
			const macsplit = this.mac.split(':');
			for (let i = 0; i < 6; i++) {
				Module.HEAPU8[macptr + i] = parseInt(macsplit[i], 16);
			}

			// struct pico_device *pico_wstap_create_simple(const char *name, int fd, const uint8_t* mac);
			if (this.dev !== null) {
				delete this.wstap_devs[this.dev];
			}
			this.dev = Module._pico_wstap_create_simple(nameptr, this.id, macptr);
			wstap_devs[this.dev] = this;

			Module._free(nameptr);
			Module._free(macptr);
		} else {
			this.buffer.push(new Uint8Array(data));
		}
	};
	this.ws.onclose = () => {
		this.close();
	};
	this.ws.onerror = (err) => {
		console.error(err);
		this.close();
	};
	this.id = lastfd++;
	wstaps[this.id] = this;
	this.dev = null;
}
WSTAP.prototype.close = function() {
	if (this.dev) {
		Module._pico_wstap_destroy(this.dev);
	}
	this._close();
};
WSTAP.prototype._write = function(bufptr, buflen) {
	const buf = new Uint8Array(Module.HEAPU8.buffer, bufptr, buflen);
	this.ws.send(buf);
	return buflen;
};
WSTAP.prototype._read = function(bufptr, buflen) {
	const buf = new Uint8Array(Module.HEAPU8.buffer, bufptr, buflen);
	if (this.buffer.length > 0) {
		const wsbuf = this.buffer.shift();
		Module.HEAPU8.set(wsbuf, bufptr);
		return wsbuf.byteLength;
	}
	return 0;
};
WSTAP.prototype._poll = function() {
	return this.buffer.length;
};
WSTAP.prototype._close = function() {
	this.ws.close();
	delete wstaps[this.id];
	if (this.dev !== null) {
		delete wstap_devs[this.dev];
	}
};
WSTAP.prototype._dhcp_event = function(code) {
	if (code === 0 && !this.ready && this.onready) {
		this.onready();
		this.ready = true;
	}
};

Module.NET = {
	IPV4: 0,
	IPV6: 41,
};
Module.PROTO = {
	TCP: 6,
	UDP: 17,
};

function htons(n) {
    return ((n & 0xFF) << 8) | ((n >> 8) & 0xFF);
}

Module._sockets = {};

function Socket(proto = Module.PROTO.TCP, net = Module.PROTO.IPV4) {
	this.fd = Module._pico_socket_open_cb(net, proto);
	Module._sockets[this.fd] = this;
}
Socket.prototype.connect = function (ip, port) {
	const ipptr = Module._malloc(4);
	try {
		const ipsplit = ip.split('.');
		for (let i = 0; i < 4; i++)
			Module.HEAPU8[ipptr + i] = parseInt(ipsplit[i], 10);
		return Module._pico_socket_connect(this.fd, ipptr, htons(port));
	} finally {
		Module._free(ipptr);
	}
};
Socket.prototype._socket_cb = function (ev) {
	console.log('TODO: Handle socket event: ', ev); // TODO
};
Socket.prototype.close = function () {
	Module._pico_socket_close(this.fd);
};
Socket.prototype.write = function (data) {
	const ptr = Module._malloc(data.byteLength);
	if (ptr <= 0) {
		throw new Error('Error allocating memory');
	}
	try {
		Module.HEAPU8.set(data, ptr);
		return Module._pico_socket_write(this.fd, ptr, data.byteLength);
	} finally {
		Module._free(ptr);
	}
};
Socket.prototype.writeString = function (str) {
	const len = Module.lengthBytesUTF8(str);
	const ptr = Module._malloc(len + 1);
	if (ptr <= 0) {
		throw new Error('Error allocating memory');
	}
	try {
		Module.stringToUTF8(str, ptr, len + 1);
		return Module._pico_socket_write(this.fd, ptr, len);
	} finally {
		Module._free(ptr);
	}
};
Socket.prototype.read = function (len) {
	const ptr = Module._malloc(len);
	if (ptr <= 0) {
		throw new Error('Error allocating memory');
	}
	try {
		const ret = Module._pico_socket_read(this.fd, ptr, len);
		if (ret < 0) {
			throw new Error('Error reading from socket: ' + ret);
		}
		const u8 = new Uint8Array(ret);
		u8.set(new Uint8Array(Module.HEAPU8.buffer, ptr, ret), 0);
		return u8;
	} finally {
		Module._free(ptr);
	}
};
Socket.prototype.readString = function (len) {
	return new TextDecoder('utf-8').decode(this.read(len));
};

Module.Socket = Socket;
Module.WSTAP = WSTAP;


