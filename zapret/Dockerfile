FROM debian:bookworm-slim AS builder                                                                                 

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential git ca-certificates \
    libnetfilter-queue-dev libcap-dev zlib1g-dev libmnl-dev \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --depth=1 https://github.com/bol-van/zapret.git /opt/zapret
WORKDIR /opt/zapret
RUN make -C nfq

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    iptables ipset dnsutils \
    libnetfilter-queue1 libcap2 libmnl0 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /opt/zapret/nfq/nfqws /usr/local/bin/nfqws
COPY --from=builder /opt/zapret/files/fake/ /opt/zapret/files/fake/
COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
