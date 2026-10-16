# Production Dockerfile for Google Cloud Run (Eman QR)
FROM node:22-alpine AS runner

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy source code and build frontend
COPY . .
RUN npm run build

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Start server.ts serving API routes and static PWA build
CMD ["node", "server.ts"]
