'use strict';

var Module = {};

const wstaps = {};
const wstap_devs = {};
Module._wstaps = wstaps;
Module._wstap_devs = wstap_devs;
let lastfd = 0;

function makeEventEmitter(Cls) {
	Cls.prototype._eventSetup = function(ev, evs) {
		if (!this[evs]) {
			this[evs] = {};
		}
		if (ev && !this[evs][ev]) {
			this[evs][ev] = [];
		}
	};
	Cls.prototype.on = function(ev, func) {
		this._eventSetup(ev, 'events');
		this.events[ev].push(func);
	};
	Cls.prototype.emit = function(ev, data) {
		if (!this._events) {
			return;
		}
		let evs = this.events[ev];
		for (let i = 0; i < evs.length; i++) {
			evs[i](data);
		}
		evs = this.eventsOnce[ev];
		delete this.eventsOnce[ev];
		for (let i = 0; i < evs.length; i++) {
			evs[i](data);
		}
	};
	Cls.prototype.once = function(ev, func) {
		this._eventSetup(ev, 'eventsOnce');
		this.eventsOnce[ev].push(func);
	};
	Cls.prototype._eventRemove = function(ev, func, _evs) {
		this._eventSetup();
		if (!this.events[ev]) {
			return;
		}
		const evs = _evs[ev];
		for (let i = 0; i < evs.length; i++) {
			if (evs[i] === func) {
				evs.splice(i, 1);
				break;
			}
		}
		if (evs.length === 0) {
			delete _evs[ev];
		}
	};
	Cls.prototype.removeOn = function(ev, func) {
		this._eventRemove(ev, func, this.events);
	};
	Cls.prototype.removeOnce = function(ev, func) {
		this._eventRemove(ev, func, this.eventsOnce);
	};
}

function WSTAP(addr) {
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

			const name = 'wst' + this.id;
			const nameptr = Module._malloc(name.length + 1);
			Module.writeAsciiToMemory(name, nameptr);

			const macptr = Module._malloc(6);
			const macsplit = this.mac.split(':');
			for (let i = 0; i < 6; i++) {
				Module.HEAPU8[macptr + i] = parseInt(macsplit[i], 16);
			}

			// struct pico_device *pico_wstap_create_simple(const char *name, int fd, const uint8_t* mac);
			if (this.dev !== undefined) {
				delete this.wstap_devs[this.dev];
			}
			this.dev = Module._pico_wstap_create_simple(nameptr, this.id, macptr, this.mtu);
			wstap_devs[this.dev] = this;

			Module._free(nameptr);
			Module._free(macptr);
		} else {
			const data8 = new Uint8Array(data);
			const bufptr = Module._malloc(data8.byteLength);
			Module.HEAPU8.set(data8, bufptr);
			Module._pico_stack_recv(this.dev, bufptr, data8.byteLength);
		}
		Module._pico_stack_tick();
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
	this.dev = undefined;
}
makeEventEmitter(WSTAP);
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
WSTAP.prototype._close = function() {
	this.ws.close();
	delete wstaps[this.id];
	if (this.dev !== undefined) {
		delete wstap_devs[this.dev];
	}
};
WSTAP.prototype._dhcp_event = function(code) {
	if (code === 0 && !this.ready) {
		this.emit('ready');
		this.ready = true;
	}
};

function htons(n) {
    return ((n & 0xFF) << 8) | ((n >> 8) & 0xFF);
}

Module._sockets = {};

function Socket(proto = Socket.PROTO.TCP, net = Socket.PROTO.IPV4) {
	this.fd = Module._pico_socket_open_cb(net, proto);
	Module._sockets[this.fd] = this;
}
makeEventEmitter(Socket);
Socket.NET = {
	IPV4: 0,
	IPV6: 41,
};
Socket.PROTO = {
	TCP: 6,
	UDP: 17,
};
Socket.EVENT = {
	READ: 1,
	WRITE: 2,
	CONNECTION: 4,
	CLOSE: 8,
	FIN: 16,
	ERROR: 128,
};
Socket.prototype.connect = function (ip, port) {
	const ipptr = Module._malloc(4);
	try {
		const ipsplit = ip.split('.');
		for (let i = 0; i < 4; i++) {
			Module.HEAPU8[ipptr + i] = parseInt(ipsplit[i], 10);
		}
		return Module._pico_socket_connect(this.fd, ipptr, htons(port));
	} finally {
		Module._free(ipptr);
	}
};
Socket.prototype._socket_cb = function (ev) {
	switch (ev) {
		case Socket.EVENT.READ:
			this.emit('data');
			break;
		case Socket.EVENT.WRITE:
			this.emit('ready');
			break;
		case Socket.EVENT.CONNECTION:
			this.emit('connected');
			break;
		case Socket.EVENT.CLOSE:
			this.emit('closed');
			break;
		case Socket.EVENT.FIN:
			this.emit('fin');
			break;
		case Socket.EVENT.ERROR:
			this.emit('error');
			break;
		default:
			console.error('Unknown socket event: ' + ev);
			break;
	}
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


