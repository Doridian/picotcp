/*********************************************************************
   PicoTCP. Copyright (c) 2012-2017 Altran Intelligent Systems. Some rights reserved.
   See COPYING, LICENSE.GPLv2 and LICENSE.GPLv3 for usage.

   Authors: Michiel Kustermans
 *********************************************************************/

#include <sys/poll.h>
#include <sys/socket.h>
#include <sys/un.h>

#include "pico_device.h"
#include "pico_dev_wstap.h"
#include "pico_stack.h"

struct pico_device_wstap {
    struct pico_device dev;
    int fd;
};

extern int js_wstap_close(int fd);
extern int js_wstap_write(int fd, char* data, int len);

static int pico_wstap_send(struct pico_device *dev, void *buf, int len)
{
    struct pico_device_wstap *wstap = (struct pico_device_wstap *) dev;
    return js_wstap_write(wstap->fd, buf, len);
}

static int pico_wstap_poll(struct pico_device *dev, int loop_score)
{
    return loop_score;
}

/* Public interface: create/destroy. */

void pico_wstap_destroy(struct pico_device *dev)
{
    struct pico_device_wstap *wstap = (struct pico_device_wstap *) dev;
    if(wstap->fd > 0) {
        js_wstap_close(wstap->fd);
    }
}

struct pico_device *pico_wstap_create(int fd, const char *name, const uint8_t *mac, const uint16_t mtu)
{
    struct pico_device_wstap *wstap = PICO_ZALLOC(sizeof(struct pico_device_wstap));

    if (!wstap) {
        return NULL;
    }

    wstap->dev.mtu = mtu;

    if( 0 != pico_device_init((struct pico_device *)wstap, name, mac)) {
        dbg("WSTAP init failed.\n");
        pico_wstap_destroy((struct pico_device *)wstap);
        return NULL;
    }

    wstap->dev.overhead = 0;
    wstap->fd = fd;

    wstap->dev.send = pico_wstap_send;
    wstap->dev.poll = pico_wstap_poll;
    wstap->dev.destroy = pico_wstap_destroy;
    dbg("Device %s created.\n", wstap->dev.name);
    return (struct pico_device *)wstap;
}

