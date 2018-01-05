#!/bin/sh
emcc ./build/lib/*.o ./build/modules/*.o main.c -I./build/include --pre-js ./pre.js --js-library ./library.js \
-s EXTRA_EXPORTED_RUNTIME_METHODS='["ccall", "cwrap", "setValue", "getValue", "writeAsciiToMemory", "lengthBytesUTF8", "stringToUTF8","Pointer_stringify"]' \
-s EXPORTED_FUNCTIONS='["_pico_wstap_create_simple", "_pico_wstap_destroy", "_pico_socket_open_cb", "_pico_socket_read", "_pico_socket_write", "_pico_socket_bind", "_pico_socket_connect", "_pico_socket_listen", "_pico_socket_close", "_pico_socket_accept", "_pico_socket_sendto", "_pico_socket_recvfrom", "_pico_socket_setoption", "_pico_socket_getoption", "_pico_socket_getpeername", "_pico_socket_getname", "_main"]' \
-s WASM=1 -s RESERVED_FUNCTION_POINTERS=20 -o wstap.js

