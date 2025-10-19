FROM mcr.microsoft.com/devcontainers/base:ubuntu

# Install build essentials, cmake, ninja, python3, git, curl, unzip, and ca-certificates
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    ninja-build \
    python3 \
    git \
    curl \
    unzip \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Node 20 via nvm
ENV NVM_DIR=/usr/local/nvm
ENV NODE_VERSION=20
RUN mkdir -p $NVM_DIR \
    && curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash \
    && . $NVM_DIR/nvm.sh \
    && nvm install $NODE_VERSION \
    && nvm alias default $NODE_VERSION \
    && nvm use default

# Add nvm to PATH
ENV NODE_PATH=$NVM_DIR/versions/node/v$NODE_VERSION/lib/node_modules
ENV PATH=$NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH

# Install Emscripten SDK to /opt/emsdk
RUN git clone https://github.com/emscripten-core/emsdk.git /opt/emsdk \
    && cd /opt/emsdk && ./emsdk install latest && ./emsdk activate latest

# Create profile.d entry to source emsdk_env.sh
RUN echo 'source /opt/emsdk/emsdk_env.sh' > /etc/profile.d/emsdk.sh

# Update PATH to include emcc for login shells
ENV PATH=/opt/emsdk:/opt/emsdk/upstream/emscripten:$PATH

# Set SHELL to bash
ENV SHELL=/bin/bash
