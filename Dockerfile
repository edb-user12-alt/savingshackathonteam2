# Use official Node.js image
FROM node:18-slim

# Create app directory
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy all application files
COPY . .

# Expose port 8080 (default for Cloud Run)
EXPOSE 8080

# Start the server
CMD [ "npm", "start" ]
