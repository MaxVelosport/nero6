import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",
  tracesSampleRate: 1.0,
  integrations: [
    Sentry.httpIntegration(),
    Sentry.expressIntegration(),
  ],
});

import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Доверяем ровно ОДНОМУ хопу обратного прокси (на Replit это reverse-proxy
// перед нами). Так req.ip берёт реального клиента из X-Forwarded-For,
// но при этом клиент не может подменить свой IP — лишние записи в заголовке
// игнорируются. Это закрывает поверхность для спуфинга rate-limit'а
// и проверки IP-источника webhook'а ЮKassa.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "70mb" }));
app.use(express.urlencoded({ extended: true, limit: "70mb" }));

app.use("/api", router);

Sentry.setupExpressErrorHandler(app);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "internal_error", message: "Internal server error" });
});

export default app;
