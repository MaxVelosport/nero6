function detectAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");

  if (process.env.REPLIT_DOMAINS) {
    const domains = process.env.REPLIT_DOMAINS.split(",").map((d) => d.trim()).filter(Boolean);
    if (domains.length > 0) return `https://${domains[0]}`;
  }

  if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    return `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
  }

  return "https://neurozachet.ru";
}

export const APP_URL = detectAppUrl();
export const APP_NAME = process.env.APP_NAME || "НейроЗачёт";
export const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@neurozachet.ru";
export const EMAIL_FROM = process.env.EMAIL_FROM || `${APP_NAME} <info@neurozachet.ru>`;

export const SMTP_HOST = process.env.SMTP_HOST || "smtp.beget.com";
export const SMTP_PORT = Number(process.env.SMTP_PORT) || 465;

export const SMTP_INFO_USER = process.env.SMTP_INFO_USER || "info@neurozachet.ru";
export const SMTP_INFO_PASS = process.env.SMTP_INFO_PASS || "";

export const SMTP_SUPPORT_USER = process.env.SMTP_SUPPORT_USER || "support@neurozachet.ru";
export const SMTP_SUPPORT_PASS = process.env.SMTP_SUPPORT_PASS || "";
