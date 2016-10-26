#include "pico_config.h"
#include "pico_tree.h"
#include "pico_ipv6.h"
#include "pico_eth.h"
#include "pico_ipv6_pmtu.h"
#include "modules/pico_ipv6_pmtu.c"
#include "modules/pico_icmp6.c"
#include "check.h"

#ifdef PICO_SUPPORT_IPV6PMTU

Suite *pico_suite(void);
const uint32_t min_mtu = PICO_IPV6_MIN_MTU;
const uint32_t default_mtu = 1500;

START_TEST(pico_ipv6_pkt_too_big)
{
    struct pico_frame *f = NULL;
    struct pico_ipv6_path_id path_id;
    const int dst_offset = 86;
    const uint32_t pkt1_mtu = 1450;
    unsigned char pkt1[122] = {
        0x00, 0x00, 0x86, 0x05, 0x80, 0xda, 0x00, 0x60,
        0x97, 0x07, 0x69, 0xea, 0x86, 0xdd, 0x60, 0x00,
        0x00, 0x00, 0x00, 0x44, 0x3a, 0x3e, 0x3f, 0xfe,
        0x05, 0x01, 0x18, 0x00, 0x23, 0x45, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0x3f, 0xfe,
        0x05, 0x07, 0x00, 0x00, 0x00, 0x01, 0x02, 0x00,
        0x86, 0xff, 0xfe, 0x05, 0x80, 0xda, 0x02, 0x00,
        0xb9, 0xba, 0x00, 0x00, 0x05, 0xaa, 0x60, 0x00,
        0x00, 0x00, 0x00, 0x14, 0x11, 0x01, 0x3f, 0xfe,
        0x05, 0x07, 0x00, 0x00, 0x00, 0x01, 0x02, 0x00,
        0x86, 0xff, 0xfe, 0x05, 0x80, 0xda, 0x3f, 0xfe,
        0x05, 0x01, 0x04, 0x10, 0x00, 0x00, 0x02, 0xc0,
        0xdf, 0xff, 0xfe, 0x47, 0x03, 0x3e, 0xa0, 0x75,
        0x82, 0xa3, 0x00, 0x14, 0x68, 0x79, 0x09, 0x03,
        0x00, 0x00, 0xf9, 0xc8, 0xe7, 0x36, 0x05, 0xf6,
        0x0a, 0x00
    };
    f = pico_frame_alloc(sizeof(pkt1));
    memcpy(f->buffer, pkt1, sizeof(pkt1));
    f->transport_hdr = f->buffer + PICO_SIZE_ETHHDR + PICO_SIZE_IP6HDR;
    memcpy(path_id.dst.addr, pkt1 + dst_offset, sizeof(path_id.dst.addr));
    fail_if(pico_ipv6_path_add(&path_id, default_mtu) != PICO_PMTU_OK);
    pico_icmp6_process_in(NULL, f);
    fail_if(pico_ipv6_pmtu_get(&path_id) != pkt1_mtu);
}
END_TEST

START_TEST(pico_ipv6_path)
{
    uint8_t i;
    struct pico_ipv6_path_id path_id = {{{
                                             0x20, 0x01, 0x0d, 0xb8, 0x13, 0x0f, 0x00, 0x00, 0x00, 0x00, 0x09, 0xc0, 0x87, 0x6a, 0x13, 0x0b
                                         }}};
    /* Updating non-existing paths should not be OK */
    for (i = 0; i < 0xff; i++) {
        path_id.dst.addr[10] = i;
        fail_if(pico_ipv6_path_update(&path_id, default_mtu) != PICO_PMTU_ERROR);
    }
    /* Adding paths should be OK */
    for (i = 0; i < 0xff; i++) {
        path_id.dst.addr[10] = i;
        fail_if(pico_ipv6_path_add(&path_id, default_mtu + i) != PICO_PMTU_OK);
    }
    /* Retrieved PMTU should be the same */
    for (i = 0; i < 0xff; i++) {
        path_id.dst.addr[10] = i;
        fail_if(pico_ipv6_pmtu_get(&path_id) != default_mtu + i);
    }
    /* Adding existing paths should be OK */
    for (i = 0; i < 0xff; i++) {
        path_id.dst.addr[10] = i;
        fail_if(pico_ipv6_path_add(&path_id, default_mtu + i + 1) != PICO_PMTU_OK);
    }
    for (i = 0; i < 0xff; i++) {
        path_id.dst.addr[10] = i;
        fail_if(pico_ipv6_pmtu_get(&path_id) != default_mtu + i + 1);
    }
    /* Updating existing paths should be OK */
    for (i = 0; i < 0xff; i++) {
        path_id.dst.addr[10] = i;
        fail_if(pico_ipv6_path_add(&path_id, min_mtu + i) != PICO_PMTU_OK);
    }
    for (i = 0; i < 0xff; i++) {
        path_id.dst.addr[10] = i;
        fail_if(pico_ipv6_pmtu_get(&path_id) != min_mtu + i);
    }
    /* Updating existing paths to higher MTU value should not be OK */
    for (i = 0; i < 0xff; i++) {
        path_id.dst.addr[10] = i;
        fail_if(pico_ipv6_path_update(&path_id, min_mtu + i + 1) != PICO_PMTU_ERROR);
    }
    for (i = 0; i < 0xff; i++) {
        path_id.dst.addr[10] = i;
        fail_if(pico_ipv6_pmtu_get(&path_id) != min_mtu + i);
    }
    /* Deleting existing paths should be OK */
    for (i = 0; i < 0xff; i++) {
        path_id.dst.addr[10] = i;
        fail_if(pico_ipv6_path_del(&path_id) != PICO_PMTU_OK);
    }
    /* Updating non-existing should not be OK */
    for (i = 0; i < 0xff; i++) {
        path_id.dst.addr[10] = i;
        fail_if(pico_ipv6_path_update(&path_id, default_mtu) != PICO_PMTU_ERROR);
    }
    /* Deleting non-existing paths should  not be OK */
    for (i = 0; i < 0xff; i++) {
        path_id.dst.addr[10] = i;
        fail_if(pico_ipv6_path_del(&path_id) != PICO_PMTU_ERROR);
    }
    fail_if(pico_ipv6_path_add(&path_id, min_mtu - 1) != PICO_PMTU_ERROR);
    fail_if(pico_ipv6_path_add(&path_id, 0) != PICO_PMTU_ERROR);
    fail_if(pico_ipv6_path_add(NULL, min_mtu) != PICO_PMTU_ERROR);
    fail_if(pico_ipv6_path_update(&path_id, min_mtu - 1) != PICO_PMTU_ERROR);
    fail_if(pico_ipv6_path_update(&path_id, 0) != PICO_PMTU_ERROR);
    fail_if(pico_ipv6_path_update(NULL, min_mtu) != PICO_PMTU_ERROR);
    fail_if(pico_ipv6_path_del(NULL) != PICO_PMTU_ERROR);
    fail_if(pico_ipv6_pmtu_get(NULL) != 0);
}
END_TEST

START_TEST(pico_ipv6_path_cache)
{
    uint8_t i;
	struct pico_ipv6_path_id path_id = {{{
                                             0xfe, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0x50, 0x56, 0xff, 0xfe, 0x87, 0x06, 0xb6
                                         }}};
    pico_stack_init();
    /* Timer should be allocated */
    fail_if(gc_timer.id == 0);
    /* Adding new paths should be OK */
    for (i = 0; i < 0xff; i++) {
        path_id.dst.addr[10] = i;
        fail_if(pico_ipv6_path_add(&path_id, default_mtu + i) != PICO_PMTU_OK);
    }
    /* Retrieved PMTU should be the same */
    for (i = 0; i < 0xff; i++) {
        path_id.dst.addr[10] = i;
        fail_if(pico_ipv6_pmtu_get(&path_id) != default_mtu + i);
    }
    pico_stack_tick(); /* No changes: cleanup only in (default) 10 minutes */
    pico_ipv6_path_init(5 * 1000);
    pico_stack_tick(); /* Cleanup in 5s: all paths valid */
    for (i = 0; i < 0xff; i++) {
        path_id.dst.addr[10] = i;
        fail_if(pico_ipv6_pmtu_get(&path_id) != default_mtu + i);
    }
    sleep(6);
    pico_stack_tick(); /* Paths marked as old */
    fail_if(gc_timer.id == 0);
    path_id.dst.addr[10] = 0xfe;
    fail_if(pico_ipv6_path_update(&path_id, default_mtu) != PICO_PMTU_OK);
    sleep(6);
    pico_stack_tick(); /* Updated path available other paths are deleted */
    fail_if(pico_ipv6_pmtu_get(&path_id) != default_mtu);
    for (i = 0; i < 0xfe; i++) {
        path_id.dst.addr[10] = i;
        fail_if(pico_ipv6_pmtu_get(&path_id) != 0);
    }
    sleep(6);
    pico_stack_tick(); /* Path cache expired */
    fail_if(gc_timer.id == 0);
    for (i = 0; i < 0xff; i++) {
        path_id.dst.addr[10] = i;
        fail_if(pico_ipv6_pmtu_get(&path_id) != 0);
    }
    sleep(8);
    pico_stack_tick(); /* Cleanup empty cache */
    fail_if(gc_timer.id == 0);
}
END_TEST

Suite *pico_suite(void)
{
    Suite *s = suite_create("PicoTCP - Path MTU");
    TCase *TCase_pico_ipv6_pkt_too_big = tcase_create("Unit test for receiving pkt_too_big message");
    TCase *TCase_pico_ipv6_path = tcase_create("Unit test for IPv6 path manipulation");
    TCase *TCase_pico_ipv6_path_cache = tcase_create("Unit test for the cache cleanup");

    tcase_add_test(TCase_pico_ipv6_pkt_too_big, pico_ipv6_pkt_too_big);
    tcase_add_test(TCase_pico_ipv6_path, pico_ipv6_path);
    tcase_add_test(TCase_pico_ipv6_path_cache, pico_ipv6_path_cache);
    tcase_set_timeout(TCase_pico_ipv6_path_cache, 30);

    suite_add_tcase(s, TCase_pico_ipv6_pkt_too_big);
    suite_add_tcase(s, TCase_pico_ipv6_path);
    suite_add_tcase(s, TCase_pico_ipv6_path_cache);

    return s;
}

int main(void)
{
    int fails;
    Suite *s = pico_suite();
    SRunner *sr = srunner_create(s);
    srunner_run_all(sr, CK_NORMAL);
    fails = srunner_ntests_failed(sr);
    srunner_free(sr);
    return fails;
}
#else
int main(void)
{
    return 0;
}

#endif