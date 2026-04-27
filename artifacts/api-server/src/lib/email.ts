import nodemailer from "nodemailer";
import {
  APP_URL,
  APP_NAME,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_INFO_USER,
  SMTP_INFO_PASS,
  SMTP_SUPPORT_USER,
  SMTP_SUPPORT_PASS,
} from "./config.js";

const INFO_FROM = `${APP_NAME} <${SMTP_INFO_USER}>`;
const SUPPORT_FROM = `${APP_NAME} Поддержка <${SMTP_SUPPORT_USER}>`;

function makeTransport(user: string, pass: string) {
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
}

const infoTransport = makeTransport(SMTP_INFO_USER, SMTP_INFO_PASS);
const supportTransport = makeTransport(SMTP_SUPPORT_USER, SMTP_SUPPORT_PASS);

export async function sendPasswordResetEmail(email: string, name: string, resetToken: string): Promise<void> {
  const resetLink = `${APP_URL}/reset-password?token=${resetToken}`;

  if (!infoTransport) {
    console.log(`[EMAIL DEV] Password reset for ${email}: ${resetLink}`);
    return;
  }

  await infoTransport.sendMail({
    from: INFO_FROM,
    to: email,
    subject: "Сброс пароля — НейроЗачёт",
    html: `
<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="font-family:Arial,sans-serif;background:#0f0a1a;color:#e0d7ff;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:40px auto;background:#1a1030;border-radius:16px;border:1px solid #2d1f5e;overflow:hidden;">
    <tr><td style="background:linear-gradient(135deg,#4c1d95,#7c3aed);padding:32px 40px;text-align:center;">
      <div style="font-size:28px;font-weight:800;color:#fff;letter-spacing:-0.5px;">⚡ НейроЗачёт</div>
      <div style="color:#c4b5fd;font-size:14px;margin-top:4px;">AI-помощник для студентов</div>
    </td></tr>
    <tr><td style="padding:40px;">
      <h2 style="color:#f0e6ff;font-size:20px;margin:0 0 16px;">Сброс пароля</h2>
      <p style="color:#c4b5fd;line-height:1.6;margin:0 0 24px;">Привет, ${name}! Мы получили запрос на сброс пароля для вашего аккаунта.</p>
      <p style="color:#c4b5fd;line-height:1.6;margin:0 0 32px;">Нажмите кнопку ниже, чтобы создать новый пароль. Ссылка действует <strong style="color:#a78bfa;">1 час</strong>.</p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${resetLink}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:16px;">Сбросить пароль</a>
      </div>
      <p style="color:#7c6aad;font-size:13px;line-height:1.5;margin:24px 0 0;">Если вы не запрашивали сброс пароля — просто проигнорируйте это письмо. Ваш пароль останется прежним.</p>
      <hr style="border:none;border-top:1px solid #2d1f5e;margin:32px 0;">
      <p style="color:#6b5a9e;font-size:12px;line-height:1.5;">Ссылка для копирования:<br><span style="color:#a78bfa;word-break:break-all;">${resetLink}</span></p>
    </td></tr>
    <tr><td style="padding:16px 40px 32px;text-align:center;">
      <p style="color:#4a3870;font-size:12px;margin:0;">© 2025 НейроЗачёт · Сдай зачёт с нейросетью</p>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  if (!infoTransport) {
    console.log(`[EMAIL DEV] Welcome email for ${email}`);
    return;
  }

  await infoTransport.sendMail({
    from: INFO_FROM,
    to: email,
    subject: "Добро пожаловать в НейроЗачёт! 🎓",
    html: `
<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="font-family:Arial,sans-serif;background:#0f0a1a;color:#e0d7ff;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:40px auto;background:#1a1030;border-radius:16px;border:1px solid #2d1f5e;overflow:hidden;">
    <tr><td style="background:linear-gradient(135deg,#4c1d95,#7c3aed);padding:32px 40px;text-align:center;">
      <div style="font-size:28px;font-weight:800;color:#fff;letter-spacing:-0.5px;">⚡ НейроЗачёт</div>
      <div style="color:#c4b5fd;font-size:14px;margin-top:4px;">AI-помощник для студентов</div>
    </td></tr>
    <tr><td style="padding:40px;">
      <h2 style="color:#f0e6ff;font-size:20px;margin:0 0 16px;">Добро пожаловать, ${name}! 🎓</h2>
      <p style="color:#c4b5fd;line-height:1.6;margin:0 0 16px;">Ваш аккаунт успешно создан. На вашем балансе уже есть <strong style="color:#a78bfa;">100 ₽</strong> — попробуйте любой режим бесплатно!</p>
      <div style="background:#1e1540;border:1px solid #2d1f5e;border-radius:12px;padding:20px;margin:24px 0;">
        <p style="color:#a78bfa;font-weight:700;margin:0 0 12px;font-size:15px;">🚀 Что можно сделать прямо сейчас:</p>
        <ul style="color:#c4b5fd;margin:0;padding:0 0 0 20px;line-height:2;">
          <li>Задать вопрос в <strong>режиме сессии</strong> — как живой репетитор</li>
          <li>Загрузить задачу и получить <strong>решение за 30 секунд</strong></li>
          <li>Сгенерировать <strong>курсовую работу</strong> по вашей теме</li>
        </ul>
      </div>
      <div style="text-align:center;margin:32px 0;">
        <a href="${APP_URL}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:16px;">Перейти в кабинет →</a>
      </div>
    </td></tr>
    <tr><td style="padding:16px 40px 32px;text-align:center;">
      <p style="color:#4a3870;font-size:12px;margin:0;">© 2025 НейроЗачёт · Сдай зачёт с нейросетью</p>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

export async function sendEmailVerificationEmail(email: string, name: string, verifyToken: string): Promise<void> {
  const verifyLink = `${APP_URL}/verify-email?token=${verifyToken}`;

  if (!infoTransport) {
    console.log(`[EMAIL DEV] Email verification for ${email}: ${verifyLink}`);
    return;
  }

  await infoTransport.sendMail({
    from: INFO_FROM,
    to: email,
    subject: "Подтвердите email — НейроЗачёт",
    html: `
<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="font-family:Arial,sans-serif;background:#0f0a1a;color:#e0d7ff;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:40px auto;background:#1a1030;border-radius:16px;border:1px solid #2d1f5e;overflow:hidden;">
    <tr><td style="background:linear-gradient(135deg,#4c1d95,#7c3aed);padding:32px 40px;text-align:center;">
      <div style="font-size:28px;font-weight:800;color:#fff;letter-spacing:-0.5px;">⚡ НейроЗачёт</div>
      <div style="color:#c4b5fd;font-size:14px;margin-top:4px;">AI-помощник для студентов</div>
    </td></tr>
    <tr><td style="padding:40px;">
      <h2 style="color:#f0e6ff;font-size:20px;margin:0 0 16px;">Привет, ${name}! 👋</h2>
      <p style="color:#c4b5fd;line-height:1.6;margin:0 0 16px;">Осталось последнее — подтвердить ваш email. После этого на счёт зачислится <strong style="color:#a78bfa;">100 ₽</strong> для первых задач.</p>
      <p style="color:#c4b5fd;line-height:1.6;margin:0 0 32px;">Ссылка действует <strong style="color:#a78bfa;">24 часа</strong>.</p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${verifyLink}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:16px;">Подтвердить email →</a>
      </div>
      <p style="color:#7c6aad;font-size:13px;line-height:1.5;margin:24px 0 0;">Если вы не регистрировались в НейроЗачёт — просто проигнорируйте это письмо.</p>
      <hr style="border:none;border-top:1px solid #2d1f5e;margin:32px 0;">
      <p style="color:#6b5a9e;font-size:12px;line-height:1.5;">Ссылка для копирования:<br><span style="color:#a78bfa;word-break:break-all;">${verifyLink}</span></p>
    </td></tr>
    <tr><td style="padding:16px 40px 32px;text-align:center;">
      <p style="color:#4a3870;font-size:12px;margin:0;">© 2025 НейроЗачёт · Сдай зачёт с нейросетью</p>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

export async function sendTaskCompletedEmail(email: string, name: string, taskTitle: string, taskId: string | number): Promise<void> {
  if (!infoTransport) {
    console.log(`[EMAIL DEV] Task completed: ${taskTitle} for ${email}`);
    return;
  }

  await infoTransport.sendMail({
    from: INFO_FROM,
    to: email,
    subject: `✅ Решение готово: ${taskTitle}`,
    html: `
<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="font-family:Arial,sans-serif;background:#0f0a1a;color:#e0d7ff;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:40px auto;background:#1a1030;border-radius:16px;border:1px solid #2d1f5e;overflow:hidden;">
    <tr><td style="background:linear-gradient(135deg,#166534,#16a34a);padding:32px 40px;text-align:center;">
      <div style="font-size:36px;margin-bottom:8px;">✅</div>
      <div style="font-size:20px;font-weight:800;color:#fff;">Задача решена!</div>
    </td></tr>
    <tr><td style="padding:40px;">
      <p style="color:#c4b5fd;line-height:1.6;margin:0 0 16px;">Привет, ${name}!</p>
      <p style="color:#c4b5fd;line-height:1.6;margin:0 0 24px;">Нейросеть завершила работу над вашей задачей:</p>
      <div style="background:#1e1540;border:1px solid #2d1f5e;border-radius:12px;padding:20px;margin:0 0 32px;">
        <p style="color:#a78bfa;font-weight:700;margin:0;font-size:16px;">📋 ${taskTitle}</p>
      </div>
      <div style="text-align:center;">
        <a href="${APP_URL}/tasks/${taskId}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:16px;">Посмотреть решение →</a>
      </div>
    </td></tr>
    <tr><td style="padding:16px 40px 32px;text-align:center;">
      <p style="color:#4a3870;font-size:12px;margin:0;">© 2025 НейроЗачёт</p>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

export async function sendTicketReplyEmail(
  email: string,
  name: string,
  ticketTitle: string,
  replyText: string,
  ticketId: string | number
): Promise<void> {
  if (!supportTransport) {
    console.log(`[EMAIL DEV] Ticket reply for ${email}: ${ticketTitle}`);
    return;
  }

  await supportTransport.sendMail({
    from: SUPPORT_FROM,
    to: email,
    subject: `Ответ по обращению: ${ticketTitle}`,
    html: `
<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="font-family:Arial,sans-serif;background:#0f0a1a;color:#e0d7ff;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:40px auto;background:#1a1030;border-radius:16px;border:1px solid #2d1f5e;overflow:hidden;">
    <tr><td style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:32px 40px;text-align:center;">
      <div style="font-size:28px;font-weight:800;color:#fff;letter-spacing:-0.5px;">⚡ НейроЗачёт</div>
      <div style="color:#bfdbfe;font-size:14px;margin-top:4px;">Служба поддержки</div>
    </td></tr>
    <tr><td style="padding:40px;">
      <h2 style="color:#f0e6ff;font-size:20px;margin:0 0 8px;">Ответ по вашему обращению</h2>
      <p style="color:#7c6aad;font-size:13px;margin:0 0 24px;">Тема: ${ticketTitle}</p>
      <p style="color:#c4b5fd;line-height:1.6;margin:0 0 16px;">Привет, ${name}!</p>
      <div style="background:#1e1540;border-left:4px solid #2563eb;border-radius:8px;padding:20px;margin:0 0 32px;">
        <p style="color:#e0d7ff;line-height:1.7;margin:0;white-space:pre-wrap;">${replyText}</p>
      </div>
      <div style="text-align:center;">
        <a href="${APP_URL}/tickets/${ticketId}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:16px;">Открыть обращение →</a>
      </div>
      <p style="color:#7c6aad;font-size:13px;line-height:1.5;margin:24px 0 0;">Если у вас остались вопросы — ответьте на это письмо или напишите на <a href="mailto:${SMTP_SUPPORT_USER}" style="color:#60a5fa;">${SMTP_SUPPORT_USER}</a></p>
    </td></tr>
    <tr><td style="padding:16px 40px 32px;text-align:center;">
      <p style="color:#4a3870;font-size:12px;margin:0;">© 2025 НейроЗачёт · Поддержка</p>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

export async function sendRefundRequestEmail(payload: {
  email: string;
  name?: string;
  reason: string;
  category: string;
  taskId?: string;
  amount?: string;
  paymentDate?: string;
  details: string;
  requestId: string;
  userId?: number | null;
}): Promise<void> {
  if (!supportTransport) {
    console.log(`[EMAIL DEV] Refund request from ${payload.email}: ${payload.reason}`);
    return;
  }

  const userBlock = payload.name ? `${payload.name} (${payload.email})` : payload.email;
  const userIdLine = payload.userId ? `<tr><td style="color:#7c6aad;padding:4px 12px 4px 0;">User ID:</td><td style="color:#e0d7ff;">${payload.userId}</td></tr>` : "";
  const taskIdLine = payload.taskId ? `<tr><td style="color:#7c6aad;padding:4px 12px 4px 0;">ID операции:</td><td style="color:#e0d7ff;">${payload.taskId}</td></tr>` : "";
  const amountLine = payload.amount ? `<tr><td style="color:#7c6aad;padding:4px 12px 4px 0;">Сумма:</td><td style="color:#e0d7ff;">${payload.amount}</td></tr>` : "";
  const dateLine = payload.paymentDate ? `<tr><td style="color:#7c6aad;padding:4px 12px 4px 0;">Дата операции:</td><td style="color:#e0d7ff;">${payload.paymentDate}</td></tr>` : "";

  const escape = (s: string) => String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" } as any)[c] || c);

  // 1) To support inbox
  await supportTransport.sendMail({
    from: SUPPORT_FROM,
    to: SMTP_SUPPORT_USER,
    replyTo: payload.email,
    subject: `[Возврат #${payload.requestId}] ${payload.category} — ${userBlock}`,
    html: `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#0f0a1a;color:#e0d7ff;margin:0;padding:24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#1a1030;border-radius:12px;border:1px solid #2d1f5e;overflow:hidden;">
    <tr><td style="background:linear-gradient(135deg,#7c2d12,#b45309);padding:20px 32px;">
      <div style="font-size:18px;font-weight:700;color:#fff;">🔁 Заявка на возврат #${payload.requestId}</div>
      <div style="color:#fed7aa;font-size:13px;margin-top:2px;">Категория: ${escape(payload.category)}</div>
    </td></tr>
    <tr><td style="padding:24px 32px;">
      <table cellpadding="0" cellspacing="0" style="font-size:14px;">
        <tr><td style="color:#7c6aad;padding:4px 12px 4px 0;">От:</td><td style="color:#e0d7ff;">${escape(userBlock)}</td></tr>
        ${userIdLine}
        ${taskIdLine}
        ${amountLine}
        ${dateLine}
      </table>
      <h3 style="color:#f0e6ff;font-size:14px;margin:20px 0 6px;">Краткая причина</h3>
      <div style="background:#1e1540;border-left:3px solid #b45309;border-radius:6px;padding:12px;color:#e0d7ff;">${escape(payload.reason)}</div>
      <h3 style="color:#f0e6ff;font-size:14px;margin:20px 0 6px;">Подробности</h3>
      <div style="background:#1e1540;border-left:3px solid #2d1f5e;border-radius:6px;padding:12px;color:#e0d7ff;white-space:pre-wrap;">${escape(payload.details)}</div>
      <p style="color:#7c6aad;font-size:12px;margin:24px 0 0;">Ответьте отправителю прямо из этого письма (Reply) — оно уйдёт ему на ${escape(payload.email)}.</p>
    </td></tr>
  </table>
</body></html>`,
  });

  // 2) Confirmation to user
  try {
    await supportTransport.sendMail({
      from: SUPPORT_FROM,
      to: payload.email,
      subject: `Заявка на возврат #${payload.requestId} получена`,
      html: `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#0f0a1a;color:#e0d7ff;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:40px auto;background:#1a1030;border-radius:16px;border:1px solid #2d1f5e;overflow:hidden;">
    <tr><td style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:28px 36px;text-align:center;">
      <div style="font-size:24px;font-weight:800;color:#fff;">⚡ НейроЗачёт</div>
      <div style="color:#bfdbfe;font-size:13px;margin-top:4px;">Заявка на возврат принята</div>
    </td></tr>
    <tr><td style="padding:32px 36px;">
      <p style="color:#c4b5fd;line-height:1.6;margin:0 0 16px;">Здравствуйте${payload.name ? ", " + escape(payload.name) : ""}!</p>
      <p style="color:#e0d7ff;line-height:1.6;margin:0 0 16px;">Мы получили вашу заявку на возврат № <b>${payload.requestId}</b>.</p>
      <div style="background:#1e1540;border-radius:8px;padding:16px;margin:0 0 20px;">
        <p style="color:#7c6aad;font-size:12px;margin:0 0 4px;">Категория</p>
        <p style="color:#e0d7ff;margin:0 0 8px;">${escape(payload.category)}</p>
        <p style="color:#7c6aad;font-size:12px;margin:0 0 4px;">Причина</p>
        <p style="color:#e0d7ff;margin:0;">${escape(payload.reason)}</p>
      </div>
      <p style="color:#c4b5fd;line-height:1.6;margin:0 0 8px;">Срок рассмотрения — до <b>10 рабочих дней</b>. При положительном решении возврат — на реквизиты, с которых производилась оплата, в течение 30 рабочих дней.</p>
      <p style="color:#7c6aad;font-size:13px;line-height:1.5;margin:24px 0 0;">Если нужно что-то уточнить, ответьте на это письмо.</p>
    </td></tr>
    <tr><td style="padding:16px 36px 28px;text-align:center;">
      <p style="color:#4a3870;font-size:12px;margin:0;">© НейроЗачёт · Служба поддержки · ${SMTP_SUPPORT_USER}</p>
    </td></tr>
  </table>
</body></html>`,
    });
  } catch (e) {
    console.warn("[refund] confirmation email failed:", (e as any)?.message || e);
  }
}
