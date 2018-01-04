'use strict';

mergeInto(LibraryManager.library, {
	js_wstap_close: function (fd) {
		const wstap = Module._wstaps[fd];
		if (!wstap) {
			return;
		}
		wstap._close();
	},
	js_wstap_read: function (fd, bufptr, buflen) {
		const wstap = Module._wstaps[fd];
		if (!wstap) {
			return -1;
		}
		return wstap._read(bufptr, buflen);
	},
	js_wstap_write: function (fd, bufptr, buflen) {
		const wstap = Module._wstaps[fd];
		if (!wstap) {
			return -1;
		}
		return wstap._write(bufptr, buflen);
	},
	js_wstap_poll: function (fd) {
		const wstap = Module._wstaps[fd];
		if (!wstap) {
			return -1;
		}
		return wstap._poll();
	},
	js_wstap_socket_ev: function (fd, ev) {
		const socket = Module._sockets[fd];
		if (!socket) {
			return;
		}
		socket._socket_cb(ev);
	}
});

