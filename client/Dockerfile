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

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy the nginx config template (uses $PORT variable)
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Copy the built React app
COPY --from=build /app/build /usr/share/nginx/html

# Cloud Run injects PORT env var; default to 8080
ENV PORT=8080
EXPOSE $PORT

# nginx:alpine image auto-processes /etc/nginx/templates/*.template
# files using envsubst on startup, outputting to /etc/nginx/conf.d/
CMD ["nginx", "-g", "daemon off;"]
