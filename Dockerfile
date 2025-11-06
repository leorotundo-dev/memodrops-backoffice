FROM node:20-alpine

WORKDIR /app

# Install poppler-utils for PDF text extraction
RUN apk add --no-cache poppler-utils

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code and public folder
COPY tsconfig.json ./
COPY src ./src
COPY public ./public

# Build TypeScript
RUN pnpm build

# Set production environment
ENV NODE_ENV=production

# Expose port
EXPOSE 8080

# Start server
CMD ["pnpm", "start"]
