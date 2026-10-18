# Production image: builds the React client, then runs the Express API which
# also serves the built frontend. One container = the whole web app.

# ---- Stage 1: build the React app ----
FROM node:22-slim AS client
WORKDIR /client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---- Stage 2: API server + built frontend ----
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=4000 STATIC_DIR=/app/public
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/src ./src
COPY --from=client /client/dist ./public
USER node
EXPOSE 4000
CMD ["node", "src/server.js"]
