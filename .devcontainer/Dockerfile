FROM node:22-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends git iproute2 iputils-ping tmux \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspaces/mars-control-station

USER node
CMD ["sleep", "infinity"]
