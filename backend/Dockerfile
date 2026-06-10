# Use the official Node.js image with Playwright dependencies
FROM mcr.microsoft.com/playwright:v1.60.0-jammy

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies including pm2
RUN npm install

# Copy source code
COPY . .

# Expose the port the app runs on
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Command to run the application in cluster mode with pm2
CMD ["npm", "run", "cluster"]
