# Build with Bun (matches bun.lock), run with Node on Cloud Run.
FROM oven/bun:1.2-slim AS build
WORKDIR /app

COPY package.json bun.lock bunfig.toml ./
RUN bun install

COPY . .

# Vite inlines VITE_* vars into the client bundle at build time.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID \
    NITRO_PRESET=node-server

RUN bun run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.output ./.output
# Cloud Run injects PORT (8080); Nitro's node-server honors it.
EXPOSE 8080
CMD ["node", ".output/server/index.mjs"]
