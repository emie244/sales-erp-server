FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
WORKDIR /app/web
RUN npm ci
RUN npm run build
WORKDIR /app
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/main"]
