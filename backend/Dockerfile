# Backend Dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create uploads directory
RUN mkdir -p uploads/audio uploads/transcripts uploads/chat_history uploads/interaction_logs

# Expose port
EXPOSE 3001

# Start the application
CMD ["node", "dist/index.js"]
