'use strict';

mergeInto(LibraryManager.library, {
	js_wstap_close: function (fd) {
		const wstap = Module._wstaps[fd];
		if (!wstap) {
			return;
		}
		wstap._close();
	},
	js_wstap_write: function (fd, bufptr, buflen) {
		const wstap = Module._wstaps[fd];
		if (!wstap) {
			return -1;
		}
		return wstap._write(bufptr, buflen);
	},
	js_wstap_socket_ev: function (ev, fd) {
		const socket = Module._sockets[fd];
		if (!socket) {
			return;
		}
		setTimeout(function() { socket._socket_cb(ev) }, 0);
	},
	js_wstap_dhcp_ev: function (dev, code) {
		const wstap = Module._wstap_devs[dev];
		if (!wstap) {
			return;
		}
		setTimeout(function() { wstap._dhcp_event(code) }, 0);
	},
	js_wstap_dns_ev: function (dataptr, arg) {
		const cbfunc = Module._dns_cbs[arg];
		if (!cbfunc) {
			Module._free(dataptr);
			return;
		}
		Module._free(arg);
		delete Module._dns_cbs[arg];
		const data = Module.Pointer_stringify(dataptr);
		Module._free(dataptr);
		setTimeout(function() { cbfunc(null, data) }, 0);
	}
});

