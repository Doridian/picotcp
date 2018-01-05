#include <emscripten.h>
#include <stdio.h>
#include <stdint.h>

#include "pico_stack.h"
#include "pico_device.h"
#include "pico_dev_wstap.h"
#include "pico_socket.h"
#include "pico_dhcp_client.h"
#include "pico_dns_client.h"

static uint32_t xid;
static struct pico_ip4 dns_ips_default[2];
static struct pico_ip4 dns_ips[2];

extern void js_wstap_socket_ev(uint16_t ev, struct pico_socket *s);
extern void js_wstap_dhcp_ev(void* cli, int code);

struct pico_socket* pico_socket_open_cb(uint16_t net, uint16_t proto)
{
	return pico_socket_open(net, proto, js_wstap_socket_ev);
}

int main()
{
	pico_string_to_ipv4("8.8.8.8", &dns_ips_default[0].addr);
	pico_string_to_ipv4("8.8.4.4", &dns_ips_default[1].addr);
	pico_stack_init();
	emscripten_set_main_loop(pico_stack_tick, 60, 0);
	return 0;
}

static void callback_dhcpclient(void* cli, int code)
{
	int i;
	struct pico_ip4 dns_ip;
	js_wstap_dhcp_ev(pico_dhcp_get_device(cli), code);
	if (code != PICO_DHCP_SUCCESS) {
		return;
	}
	for (i = 0; i < 2; i++) {
		dns_ip = pico_dhcp_get_nameserver(cli, i);
		if (dns_ip.addr == 0x00000000 || !pico_ipv4_is_unicast(dns_ip.addr)) {
			dns_ip = dns_ips_default[i];
		}
		pico_dns_client_nameserver(&dns_ips[i], PICO_DNS_NS_DEL);
		pico_dns_client_nameserver(&dns_ip, PICO_DNS_NS_ADD);
		dns_ips[i] = dns_ip;
	}
}

struct pico_device *pico_wstap_create_simple(const char *name, int fd, const uint8_t* mac, const uint16_t mtu)
{
    struct pico_device* dev;

    dev = pico_wstap_create(fd, name, mac, mtu);
    if (!dev) {
        return NULL;
    }

    pico_dhcp_initiate_negotiation(dev, &callback_dhcpclient, &xid);

    return dev;
}

