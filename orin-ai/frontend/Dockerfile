FROM node:20-alpine
WORKDIR /app
# Baked into next.config rewrites at build time — must match Compose service name in Docker
ARG BACKEND_URL=http://backend:8000
ENV BACKEND_URL=$BACKEND_URL
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
