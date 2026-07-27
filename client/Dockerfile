# ── Stage 1: Build ──
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

# Build args become REACT_APP_* env vars at build time
ARG REACT_APP_API_ENDPOINT
ARG REACT_APP_GOOGLE_CLIENT_ID

ENV REACT_APP_API_ENDPOINT=$REACT_APP_API_ENDPOINT
ENV REACT_APP_GOOGLE_CLIENT_ID=$REACT_APP_GOOGLE_CLIENT_ID

COPY . .
RUN npm run build

# ── Stage 2: Serve with nginx ──
FROM nginx:alpine

# Custom nginx config for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
