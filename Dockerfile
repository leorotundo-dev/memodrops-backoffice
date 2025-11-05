FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN npm install --quiet || true
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
EXPOSE 8081
CMD ["npm","start"]
