'use strict';

var Module = {};

const wstaps = {};
const wstap_devs = {};
Module._wstaps = wstaps;
Module._wstap_devs = wstap_devs;
let lastfd = 0;

function makeEventEmitter(Cls) {
	Cls.prototype._eventSetup = function(evs, ev) {
		if (!this[evs]) {
			this[evs] = {};
		}
		if (!this[evs][ev]) {
			this[evs][ev] = [];
		}
	};
	Cls.prototype.on = function(ev, func) {
		this._eventSetup('_events', ev);
		this._events[ev].push(func);
	};
	Cls.prototype.emit = function(ev, data) {
		if (this._events) {
			const evs = this._events[ev];
			if (evs) {
				for (let i = 0; i < evs.length; i++) {
					evs[i](data);
				}
			}
		}
		if (this._eventsOnce) {
			const evs = this._eventsOnce[ev];
			if (evs) {
				delete this._eventsOnce[ev];
				for (let i = 0; i < evs.length; i++) {
					evs[i](data);
				}
			}
		}
	};
	Cls.prototype.once = function(ev, func) {
		this._eventSetup('_eventsOnce', ev);
		this._eventsOnce[ev].push(func);
	};
	Cls.prototype._eventRemove = function(ev, func, _evs) {
		if (!_evs || !_evs[ev]) {
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
		this._eventRemove(ev, func, this._events);
	};
	Cls.prototype.removeOnce = function(ev, func) {
		this._eventRemove(ev, func, this._eventsOnce);
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
	this.net = net;
	this.proto = proto;
	this._sendReady = false;
	this.wbuffer = [];
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
	if (ev & Socket.EVENT.READ) {
		this.emit('data');
	}
	if (ev & Socket.EVENT.WRITE) {
		this._sendReady = true;
		this._sendPump();
		this.emit('ready');
	}
	if (ev & Socket.EVENT.CONNECTION) {
		this.emit('connected');
	}
	if (ev & Socket.EVENT.CLOSE) {
		this.emit('close');
		this.close();
	}
	if (ev & Socket.EVENT.FIN) {
		this.emit('fin');
		this.close();
	}
	if (ev & Socket.EVENT.ERROR) {
		this.emit('error');
		this.close();
	}
};
Socket.prototype.close = function () {
	if (this.fd === undefined) {
		return;
	}
	this._sendReady = false;
	delete Module._sockets[this.fd];
	Module._pico_socket_close(this.fd);
	this.fd = undefined;
	this.wbuffer.forEach(obj => {
		Module._free(obj.ptr);
	});
	this.wbuffer = [];
};
Socket.prototype._send = function (ptr, len) {
	if (this.fd === undefined) {
		Module._free(ptr);
		throw new Error('Socket closed');
	}
	this.wbuffer.push({
		ptr,
		len,
		sptr: ptr,
	});
	this._sendPump();
};
Socket.prototype._sendPump = function () {
	if (this.wbuffer.length === 0 || !this._sendReady) {
		return;
	}
	this._sendReady = false;
	const data = this.wbuffer[0];
	const wlen = Module._pico_socket_write(this.fd, data.sptr, data.len);
	if (wlen === data.len) {
		Module._free(data.ptr);
		this.wbuffer.shift();
	} else if (wlen < 0) {
		console.error('Error sending data');
		this.close();
	} else if (wlen > 0) {
		data.sptr += wlen;
		data.len -= wlen;
	}
	Module._pico_stack_tick();
};
Socket.prototype.write = function (data) {
	const ptr = Module._malloc(data.byteLength);
	if (ptr <= 0) {
		throw new Error('Error allocating memory');
	}
	Module.HEAPU8.set(data, ptr);
	return this._send(ptr, data.byteLength);
};
Socket.prototype.writeString = function (str) {
	const len = Module.lengthBytesUTF8(str);
	const ptr = Module._malloc(len + 1);
	if (ptr <= 0) {
		throw new Error('Error allocating memory');
	}
	Module.stringToUTF8(str, ptr, len + 1);
	return this._send(ptr, len);
};
Socket.prototype.read = function (len) {
	if (this.fd === undefined) {
		throw new Error('Socket closed');
	}
	const ptr = Module._malloc(len);
	if (ptr <= 0) {
		throw new Error('Error allocating memory');
	}
	try {
		const ret = Module._pico_socket_read(this.fd, ptr, len);
		if (ret < 0) {
			throw new Error('Error reading from socket');
		}
		const u8 = new Uint8Array(ret);
		u8.set(new Uint8Array(Module.HEAPU8.buffer, ptr, ret), 0);
		return u8;
	} finally {
		Module._free(ptr);
	}
};
Socket.prototype.readAll = function () {
	if (this.fd === undefined) {
		throw new Error('Socket closed');
	}
	const data = [];
	let dataLen = 0;
	const ptr = Module._malloc(1024);
	if (ptr <= 0) {
		throw new Error('Error allocating memory');
	}
	try {
		let ret = -1;
		while ((ret = Module._pico_socket_read(this.fd, ptr, 1024)) > 0) {
			const u8 = new Uint8Array(ret);
			u8.set(new Uint8Array(Module.HEAPU8.buffer, ptr, ret), 0);
			data.push(u8);
			dataLen += ret;
		}
		if (ret < 0) {
			throw new Error('Error reading from socket');
		}
		
	} finally {
		Module._free(ptr);
	}
	if (dataLen === 0) {
		return undefined;
	}
	const ret = new Uint8Array(dataLen);
	let pos = 0;
	for (let i = 0; i < data.length; i++) {
		const d = data[i];
		ret.set(d, pos);
		pos += d.byteLength;
	}
	return ret;
};
Socket.prototype.readString = function (len) {
	const data = this.read(len);
	if (!data) {
		return undefined;
	}
	return new TextDecoder('utf-8').decode(data);
};
Socket.prototype.readAllString = function () {
	const data = this.readAll();
	if (!data) {
		return undefined;
	}
	return new TextDecoder('utf-8').decode(data);
};

Module.Socket = Socket;
Module.WSTAP = WSTAP;


