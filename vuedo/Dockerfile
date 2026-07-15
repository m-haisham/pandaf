# Production image: node:20-alpine, prod deps only, runs the pre-built dist/.
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod --frozen-lockfile || pnpm install --prod

FROM deps AS build
COPY . .
RUN pnpm install --frozen-lockfile || pnpm install
RUN pnpm build

FROM base AS runtime
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
COPY package.json ./
EXPOSE 8080
CMD ["node", "dist-server/index.js"]
