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

#define WSTAP_MTU 1280

static int pico_wstap_send(struct pico_device *dev, void *buf, int len)
{
    struct pico_device_wstap4 *wstap = (struct pico_device_wstap *) dev;
    return js_wstap_write(wstap->fd, buf, len);
}

static int pico_wstap_poll(struct pico_device *dev, int loop_score)
{
    struct pico_device_wstap *wstap = (struct pico_device_wstap *) dev;
    unsigned char buf[WSTAP_MTU];
    int len;
    do  {
        if (js_wstap_poll(wstap->fd) <= 0)
            return loop_score;

        len = js_wstap_read(wstap->fd, buf, WSTAP_MTU);
        if (len > 0) {
            loop_score--;
            pico_stack_recv(dev, buf, len);
        }
    } while(loop_score > 0);
    return 0;
}

/* Public interface: create/destroy. */

void pico_wstap_destroy(struct pico_device *dev)
{
    struct pico_device_wstap *wstap = (struct pico_device_wstap *) dev;
    if(wstap->fd > 0) {
        js_wstap_close(wstap->fd);
    }
}

struct pico_device *pico_wstap_create(const char *sock_path, const char *name, const uint8_t *mac)
{
    struct pico_device_wstap *wstap = PICO_ZALLOC(sizeof(struct pico_device_wstap));

    if (!wstap)
        return NULL;

    wstap->dev.mtu = WSTAP_MTU;

    if( 0 != pico_device_init((struct pico_device *)wstap, name, mac)) {
        dbg("WSTAP init failed.\n");
        pico_wstap_destroy((struct pico_device *)wstap);
        return NULL;
    }

    wstap->dev.overhead = 0;
    wstap->fd = js_wstap_connect(sock_path);
    if (wstap->fd < 0) {
        dbg("WSTAP creation failed.\n");
        pico_wstap_destroy((struct pico_device *)wstap);
        return NULL;
    }

    wstap->dev.send = pico_wstap_send;
    wstap->dev.poll = pico_wstap_poll;
    wstap->dev.destroy = pico_wstap_destroy;
    dbg("Device %s created.\n", wstap->dev.name);
    return (struct pico_device *)wstap;
}
