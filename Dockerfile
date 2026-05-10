## Dockerfile BASICS
# FROM node:22-alpine

# WORKDIR /app

# COPY package*.json ./
# RUN npm install --omit=dev

# COPY . .

# EXPOSE 5000
# CMD ["npm", "start"]

# Dockerfile (multi-stage)
# --- builder stage ------------
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

# --- production stage ---------
FROM node:20-alpine

WORKDIR /app

# Run as non-root for security
USER node

# Copy only what we need from builder
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node . .

# Health check Docker can use
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD wget --quiet --tries=1 --spider http://localhost:5000/health || exit 1

EXPOSE 5000
CMD ["npm", "start"]