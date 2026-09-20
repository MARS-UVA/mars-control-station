FROM ros:jazzy
ARG USERNAME=mars
ARG USER_UID=1000
ARG USER_GID=$USER_UID

ENV DEBIAN_FRONTEND=noninteractive
ENV SHELL=/bin/bash

# Ubuntu Noble images already have an `ubuntu` user on UID 1000.
RUN if getent passwd "${USER_UID}" >/dev/null; then \
      existing="$(id -un "${USER_UID}")"; \
      mkdir -p /var/mail && touch "/var/mail/${existing}" && chown "${existing}" "/var/mail/${existing}" || true; \
      userdel -r "${existing}" || userdel "${existing}"; \
    fi \
    && if getent group "${USER_GID}" >/dev/null; then \
      groupdel "$(getent group "${USER_GID}" | cut -d: -f1)" || true; \
    fi \
    && groupadd --gid "${USER_GID}" "${USERNAME}" \
    && useradd --uid "${USER_UID}" --gid "${USER_GID}" -m "${USERNAME}" \
    && apt-get update \
    && apt-get install -y --no-install-recommends sudo \
    && echo "${USERNAME} ALL=(root) NOPASSWD:ALL" > "/etc/sudoers.d/${USERNAME}" \
    && chmod 0440 "/etc/sudoers.d/${USERNAME}"

RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends \
        python3-pip \
        python3-colcon-common-extensions \
        python3-rosdep \
        ros-dev-tools \
        ros-jazzy-rmw-zenoh-cpp \
        git \
        openssh-client \
        build-essential \
        iproute2 \
        iputils-ping \
        tmux \
    && rm -rf /var/lib/apt/lists/*

RUN apt-get update && apt-get install -y --no-install-recommends \
        curl ca-certificates gnupg tmux ros-jazzy-rosbridge-server \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
RUN echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" > /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

RUN echo "source /opt/ros/jazzy/setup.bash" >> "/home/${USERNAME}/.bashrc"

WORKDIR /workspaces/mars-control-station

USER ${USERNAME}
CMD ["/bin/bash"]