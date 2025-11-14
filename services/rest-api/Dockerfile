# REST API Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Copy environment file and keys
COPY .env .
COPY jwtRS256.key .
COPY jwtRS256.key.pub .

EXPOSE 3001

CMD ["npm", "start"]