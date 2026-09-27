# Node 20.16+ is required by pdf-parse; the alpine tag tracks the latest 20.x.
FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

# Uploaded PDFs live here (mount a volume to keep them across restarts).
# The app runs as the unprivileged "node" user, which owns only this directory.
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
USER node

# Cloud Run injects PORT; default to 8080
ENV PORT=8080
EXPOSE $PORT

CMD ["node", "server.js"]
