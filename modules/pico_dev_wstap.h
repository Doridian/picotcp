/*********************************************************************
   PicoTCP. Copyright (c) 2012-2017 Altran Intelligent Systems. Some rights reserved.
   See COPYING, LICENSE.GPLv2 and LICENSE.GPLv3 for usage.

 *********************************************************************/
#ifndef INCLUDE_PICO_IPC
#define INCLUDE_PICO_IPC
#include "pico_config.h"
#include "pico_device.h"

void pico_wstap_destroy(struct pico_device *wstap);
struct pico_device *pico_wstap_create(int fd, const char *name, const uint8_t *mac, const uint16_t mtu);

#endif

