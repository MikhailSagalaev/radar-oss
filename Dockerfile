FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --no-frozen-lockfile
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN pnpm build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --no-frozen-lockfile
COPY --from=build /app/dist ./dist
COPY bin ./bin
COPY README.md LICENSE ./
RUN mkdir -p /app/data
VOLUME ["/app/data"]
EXPOSE 8787
ENTRYPOINT ["node", "bin/radar.js"]
CMD ["serve"]
