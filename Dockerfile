# Build local monorepo image
# docker build --no-cache -t  autonomous .

# Run image
# docker run -d -p 3030:3030 autonomous

FROM node:22.21.1-alpine

# Install system dependencies and build tools
RUN apk update && \
    apk add --no-cache \
        libc6-compat \
        python3 \
        make \
        g++ \
        build-base \
        cmake \
        libomp \
        cairo-dev \
        pango-dev \
        chromium \
        curl && \
    npm install -g pnpm

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

ENV NODE_OPTIONS=--max-old-space-size=8192

WORKDIR /usr/src/autonomous

# Copy app source
COPY . .

# Install dependencies and build
RUN pnpm install && \
    pnpm build

# Give the node user ownership of the application files
RUN chown -R node:node .

# Switch to non-root user (node user already exists in node:22.21.1-alpine)
USER node

EXPOSE 3030

CMD [ "pnpm", "start" ]
