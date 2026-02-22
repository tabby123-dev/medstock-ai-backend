# Use Node.js official image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package.json first (for caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the code
COPY . .

# Expose port your backend listens on
EXPOSE 5000

# Set environment variable default (can be overridden)
ENV MONGO_URI=""

# Start the backend
CMD ["npm", "start"]
