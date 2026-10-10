FROM node:22.22.0-bookworm-slim
WORKDIR /app/preview
COPY preview/package*.json ./
RUN npm ci
COPY src /app/src
COPY assets /app/assets
COPY preview /app/preview
EXPOSE 8084
CMD ["npm","run","dev"]
