import nodemailer from 'nodemailer';

let resendClient = null;

function getResendFrom() {
  // Prefer verified store domain. onboarding@resend.dev is test-only (1 recipient).
  return process.env.RESEND_FROM || `"IBelieveThis" <orders@ibelievethis.us>`;
}

function isResendTestingMode() {
  const from = getResendFrom();
  return /onboarding@resend\.dev/i.test(from);
}

async function getResendClient() {
  if (!process.env.RESEND_API_KEY) return null;
  if (resendClient) return resendClient;
  const { Resend } = await import('resend');
  resendClient = new Resend(process.env.RESEND_API_KEY);
  console.log('📧 Email: Resend API configured');
  return resendClient;
}

function getGmailAuth() {
  const gmailUser = (process.env.GMAIL_USER || '').trim();
  // App passwords are often pasted with spaces — strip them
  const gmailPass = (process.env.GMAIL_PASS || '').replace(/\s+/g, '');
  if (!gmailUser || !gmailPass) return null;
  return { gmailUser, gmailPass };
}

function getGmailTransporter() {
  const auth = getGmailAuth();
  if (!auth) return null;

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: auth.gmailUser, pass: auth.gmailPass },
    tls: { rejectUnauthorized: false },
  });
}

async function sendViaResend({ to, subject, html, from }) {
  const resend = await getResendClient();
  if (!resend) return null;

  const { data, error } = await resend.emails.send({
    from: from || getResendFrom(),
    to: [to],
    subject,
    html,
  });

  if (error) {
    console.warn('⚠️ Resend failed:', error.message);
    return { success: false, error: error.message, provider: 'resend' };
  }

  console.log('✅ Email sent via Resend to:', to, data?.id ? `(${data.id})` : '');
  return { success: true, provider: 'resend', id: data?.id || null };
}

async function sendViaGmail({ to, subject, html }) {
  const auth = getGmailAuth();
  const transporter = getGmailTransporter();
  if (!auth || !transporter) {
    console.warn('⚠️ Gmail SMTP is not configured (need GMAIL_USER + GMAIL_PASS)');
    return { success: false, error: 'Gmail SMTP is not configured', provider: 'gmail' };
  }

  try {
    const smtpFrom = auth.gmailUser.includes('@')
      ? `"IBelieveThis" <${auth.gmailUser}>`
      : getResendFrom();
    await transporter.sendMail({ from: smtpFrom, to, subject, html });
    console.log('✅ Email sent via Gmail to:', to);
    return { success: true, provider: 'gmail' };
  } catch (err) {
    console.warn('⚠️ Gmail failed:', err.message);
    return { success: false, error: err.message, provider: 'gmail' };
  }
}

/**
 * Prefer a working path for production:
 * - Resend "onboarding@resend.dev" can only mail the Resend account owner → use Gmail first
 * - Verified Resend domain → Resend first, Gmail fallback
 */
export async function sendEmail({ to, subject, html, from }) {
  if (!to) {
    return { success: false, error: 'Missing recipient email' };
  }

  const preferGmail = isResendTestingMode() || !process.env.RESEND_API_KEY;

  if (preferGmail) {
    const gmailResult = await sendViaGmail({ to, subject, html });
    if (gmailResult.success) return gmailResult;

    const resendResult = await sendViaResend({ to, subject, html, from });
    if (resendResult?.success) return resendResult;

    return {
      success: false,
      error: gmailResult.error || resendResult?.error || 'No email provider configured',
      provider: 'gmail+resend',
    };
  }

  const resendResult = await sendViaResend({ to, subject, html, from });
  if (resendResult?.success) return resendResult;

  const gmailResult = await sendViaGmail({ to, subject, html });
  if (gmailResult.success) return gmailResult;

  return {
    success: false,
    error: resendResult?.error || gmailResult.error || 'No email provider configured',
    provider: resendResult ? 'resend+gmail' : gmailResult.provider,
  };
}

export function getEmailRuntimeConfig() {
  return {
    resendConfigured: Boolean(process.env.RESEND_API_KEY),
    resendTestingMode: isResendTestingMode(),
    gmailConfigured: Boolean(getGmailAuth()),
    ownerNotify: process.env.ORDER_NOTIFICATION_EMAIL || process.env.GMAIL_USER || null,
    from: getResendFrom(),
  };
}
