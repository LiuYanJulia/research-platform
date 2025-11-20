# Backend Dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Remove devDependencies after build (optional, saves space)
RUN npm prune --production

# Create uploads directory
RUN mkdir -p uploads/audio uploads/transcripts uploads/chat_history uploads/interaction_logs

# Expose port
EXPOSE 3001

# Start the application
CMD ["node", "dist/index.js"]
