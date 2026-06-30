#!/bin/bash
set -e

QNUM=${ZAPRET_QNUM:-200}
MARK=0x40000000
FAKE="/opt/zapret/files/fake"

DISCORD_DOMAINS="discord.com discord.gg discordapp.com discordapp.net gateway.discord.gg status.discord.com discord.media"

ipset create discord_ips hash:ip -exist 2>/dev/null || ipset flush discord_ips 2>/dev/null || true
ipset create discord_ips6 hash:ip family inet6 -exist 2>/dev/null || ipset flush discord_ips6 2>/dev/null || true

for domain in $DISCORD_DOMAINS; do
    for ip in $(dig +short A "$domain" 2>/dev/null | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'); do
        ipset add discord_ips "$ip" 2>/dev/null || true
    done
    for ip in $(dig +short AAAA "$domain" 2>/dev/null | grep -E '^[a-fA-F0-9:]+$'); do
        ipset add discord_ips6 "$ip" 2>/dev/null || true
    done
done

iptables -t mangle -I POSTROUTING -p udp --dport 443 \
    -m set --match-set discord_ips dst \
    -m connbytes --connbytes-dir=original --connbytes-mode=packets --connbytes 1:6 \
    -m mark ! --mark $MARK/$MARK \
    -j NFQUEUE --queue-num $QNUM --queue-bypass

iptables -t mangle -I POSTROUTING -p udp -m multiport --dports 19294:19344 \
    -m set --match-set discord_ips dst \
    -m connbytes --connbytes-dir=original --connbytes-mode=packets --connbytes 1:6 \
    -m mark ! --mark $MARK/$MARK \
    -j NFQUEUE --queue-num $QNUM --queue-bypass

iptables -t mangle -I POSTROUTING -p udp -m multiport --dports 50000:65535 \
    -m set --match-set discord_ips dst \
    -m connbytes --connbytes-dir=original --connbytes-mode=packets --connbytes 1:6 \
    -m mark ! --mark $MARK/$MARK \
    -j NFQUEUE --queue-num $QNUM --queue-bypass

iptables -t mangle -I POSTROUTING -p tcp --dport 443 \
    -m set --match-set discord_ips dst \
    -m connbytes --connbytes-dir=original --connbytes-mode=packets --connbytes 1:6 \
    -m mark ! --mark $MARK/$MARK \
    -j NFQUEUE --queue-num $QNUM --queue-bypass

iptables -t mangle -I POSTROUTING -p tcp -m multiport --dports 2053,2083,2087,2096,8443 \
    -m set --match-set discord_ips dst \
    -m connbytes --connbytes-dir=original --connbytes-mode=packets --connbytes 1:6 \
    -m mark ! --mark $MARK/$MARK \
    -j NFQUEUE --queue-num $QNUM --queue-bypass

echo "IPs in discord_ips set:"
ipset list discord_ips 2>/dev/null || true

echo ""
echo "Starting nfqws (kartavkun strategies)..."

exec nfqws \
    --qnum=$QNUM \
    --debug \
    --dpi-desync-any-protocol \
    --filter-udp=443 \
    --dpi-desync=fake \
    --dpi-desync-repeats=6 \
    --dpi-desync-fake-quic=${FAKE}/quic_initial_www_google_com.bin \
    --new \
    --dpi-desync-any-protocol \
    --filter-udp=19294-19344,50000-50100 \
    --filter-l7=discord,stun \
    --dpi-desync=fake \
    --dpi-desync-fake-discord=${FAKE}/discord-ip-discovery-with-port.bin \
    --dpi-desync-fake-stun=${FAKE}/stun.bin \
    --dpi-desync-repeats=6 \
    --new \
    --dpi-desync-any-protocol \
    --filter-tcp=2053,2083,2087,2096,8443 \
    --dpi-desync=fake \
    --dpi-desync-fake-tls=${FAKE}/tls_clienthello_www_google_com.bin \
    --dpi-desync-fooling=ts \
    --new \
    --dpi-desync-any-protocol \
    --filter-tcp=80,443 \
    --dpi-desync=fake \
    --dpi-desync-fake-tls=${FAKE}/tls_clienthello_www_google_com.bin \
    --dpi-desync-fooling=ts
