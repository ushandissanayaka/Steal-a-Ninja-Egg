# The Colyseus game server image that Legion (Bloxity hosting) runs.
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
# only used when MONGODB_URI is not set (saves then live in this pod only)
RUN mkdir -p /app/data && chown node:node /app/data

ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION}
ENV PORT=2567
EXPOSE 2567

# Legion probes GET /health; SIGTERM saves every player before the pod stops (see src/index.js)
USER node
CMD ["node", "src/index.js"]
