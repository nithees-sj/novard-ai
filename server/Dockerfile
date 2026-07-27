FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY . .

# Create uploads directory
RUN mkdir -p /app/uploads

EXPOSE 5001

CMD ["node", "server.js"]
