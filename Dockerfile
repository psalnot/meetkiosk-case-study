# Use Node.js 20 Alpine (lightweight)
FROM node:20-alpine

# Set working directory inside the container
WORKDIR /app

# Copy package files first (for better Docker layer caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose Vite dev server port
EXPOSE $PORT

# Start dev server (bind to all interfaces for Docker access)
CMD ["npm", "run", "dev"]
