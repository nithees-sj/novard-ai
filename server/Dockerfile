FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY . .

# Create uploads directory
RUN mkdir -p /app/uploads

# Cloud Run injects PORT env var; default to 8080
ENV PORT=8080
EXPOSE $PORT

CMD ["node", "server.js"]
