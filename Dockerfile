# ── Stage 1: builder ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm@10

# Скопировать манифесты workspace отдельным слоем — ускоряет пересборку
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml \
     tsconfig.json tsconfig.base.json ./

COPY artifacts/api-server/package.json  ./artifacts/api-server/
COPY artifacts/solvehub/package.json    ./artifacts/solvehub/
COPY artifacts/mockup-sandbox/package.json ./artifacts/mockup-sandbox/
COPY lib/api-spec/package.json          ./lib/api-spec/
COPY lib/api-zod/package.json           ./lib/api-zod/
COPY lib/api-client-react/package.json  ./lib/api-client-react/
COPY lib/db/package.json                ./lib/db/
COPY scripts/package.json               ./scripts/

RUN pnpm install --frozen-lockfile

# Скопировать весь исходный код
COPY . .

# Собрать бэкенд → artifacts/api-server/dist/index.mjs
RUN pnpm --filter @workspace/api-server run build

# Создать standalone-деплой: только prod-зависимости, workspace разрешён
RUN pnpm --filter @workspace/api-server deploy --prod /app/release

# ── Stage 2: runner ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Скопировать standalone (node_modules + package.json)
COPY --from=builder /app/release ./

# Скопировать сборку явно — pnpm deploy может пропустить dist/ если он в .gitignore
COPY --from=builder /app/artifacts/api-server/dist ./dist

RUN mkdir -p uploads logs

EXPOSE 3001

CMD ["node", "dist/index.mjs"]
