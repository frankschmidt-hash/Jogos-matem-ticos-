FROM node:22-bookworm-slim AS build

WORKDIR /app
ENV NODE_ENV=development

COPY . .
RUN npm install --legacy-peer-deps --no-audit --no-fund \
    && npm audit --audit-level=critical \
    && npm run typecheck \
    && npm test \
    && npm run build \
    && node scripts/release-audit.mjs \
    && npm prune --omit=dev --legacy-peer-deps \
    && npm audit --omit=dev --audit-level=high

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV SERVE_WEB=true

COPY --from=build /app /app

EXPOSE 3001
CMD ["npm","start"]
