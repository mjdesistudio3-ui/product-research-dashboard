# ---- builder: full Node image so better-sqlite3's native module can compile
# if a prebuilt binary isn't available for the platform.
FROM node:20 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runner: slim image with just what's needed to serve the app
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# better-sqlite3 ships its compiled binding inside node_modules — copy it along
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
# SQLite lives here; mount a volume so data survives container restarts
VOLUME /app/data
EXPOSE 3000
CMD ["npm", "start"]
