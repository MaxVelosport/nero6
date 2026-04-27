import { SMTP_HOST, SMTP_PORT, SMTP_INFO_USER, SMTP_INFO_PASS } from "./config.js";

const ADMIN_EMAIL = process.env.ADMIN_ERROR_EMAIL || SMTP_INFO_USER;
const APP_NAME = process.env.APP_NAME || "НейроЗачёт";

let lastErrorEmail = 0;
const ERROR_THROTTLE_MS = 5 * 60 * 1000;

async function sendErrorEmail(subject: string, body: string) {
  if (!SMTP_INFO_PASS || !SMTP_INFO_USER) return;
  if (Date.now() - lastErrorEmail < ERROR_THROTTLE_MS) return;
  lastErrorEmail = Date.now();

  try {
    const nodemailer = (await import("nodemailer")).default;
    const t = nodemailer.createTransport({
      host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_PORT === 465,
      auth: { user: SMTP_INFO_USER, pass: SMTP_INFO_PASS },
      tls: { rejectUnauthorized: false },
    });
    await t.sendMail({
      from: `${APP_NAME} Сервер <${SMTP_INFO_USER}>`,
      to: ADMIN_EMAIL,
      subject: `[${APP_NAME} ERROR] ${subject}`,
      text: body,
    });
  } catch {
    // не хотим рекурсии
  }
}

export function setupErrorMonitor(logger?: any) {
  const log = logger ?? console;

  process.on("uncaughtException", (err) => {
    log.error?.({ err }, "[ErrorMonitor] Uncaught exception");
    sendErrorEmail(
      `Uncaught Exception: ${err.message}`,
      `Время: ${new Date().toISOString()}\n\nОшибка: ${err.message}\n\nStack:\n${err.stack}`
    );
  });

  process.on("unhandledRejection", (reason) => {
    const msg = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : "";
    log.error?.({ reason }, "[ErrorMonitor] Unhandled rejection");
    sendErrorEmail(
      `Unhandled Rejection: ${msg}`,
      `Время: ${new Date().toISOString()}\n\nПричина: ${msg}\n\nStack:\n${stack}`
    );
  });
}

export function expressErrorHandler() {
  return (err: any, req: any, res: any, next: any) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    if (status >= 500) {
      const url = `${req.method} ${req.url}`;
      sendErrorEmail(
        `${status} Server Error: ${url}`,
        `Время: ${new Date().toISOString()}\nМетод: ${url}\nIP: ${req.ip}\n\nОшибка: ${message}\n\nStack:\n${err.stack || "(нет)"}`
      );
    }

    if (res.headersSent) return next(err);
    res.status(status).json({ error: "internal_error", message });
  };
}
