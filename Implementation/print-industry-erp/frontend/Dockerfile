FROM node:18-alpine

WORKDIR /app

# Install dependencies first (for better caching)
COPY package.json ./
RUN npm install

# Copy source code (will be overridden by volume in dev mode)
COPY . .

EXPOSE 3000

# Development mode with hot reload
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
