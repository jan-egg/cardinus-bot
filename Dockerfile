FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm install --include=optional --no-audit --no-fund
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev --include=optional --no-audit --no-fund
COPY --from=build /app/dist ./dist
USER node
CMD ["node", "dist/index.js"]
