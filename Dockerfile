FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --production=false

# Copy source
COPY . .

# Build
RUN npm run build

# Create data directory for persistent SQLite
RUN mkdir -p /data

ENV NODE_ENV=production
ENV DATA_DIR=/data
ENV PORT=8080

EXPOSE 8080

CMD ["node", "dist/index.cjs"]
