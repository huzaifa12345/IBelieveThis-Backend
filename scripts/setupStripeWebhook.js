import Stripe from 'stripe';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const WEBHOOK_PATH = '/api/payments/webhook';
const ENABLED_EVENTS = [
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'payment_intent.canceled',
  'charge.refunded',
];

function normalizeWebhookUrl(input) {
  const raw = String(input || '').trim().replace(/\/+$/, '');
  if (!raw) return '';
  if (raw.endsWith(WEBHOOK_PATH)) return raw;
  return `${raw}${WEBHOOK_PATH}`;
}

function writeWebhookSecret(secret) {
  const envPath = path.resolve(process.cwd(), '.env');
  let envText = fs.readFileSync(envPath, 'utf8');
  if (/^STRIPE_WEBHOOK_SECRET=/m.test(envText)) {
    envText = envText.replace(/^STRIPE_WEBHOOK_SECRET=.*$/m, `STRIPE_WEBHOOK_SECRET=${secret}`);
  } else {
    envText += `\nSTRIPE_WEBHOOK_SECRET=${secret}\n`;
  }
  fs.writeFileSync(envPath, envText);
}

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
if (!stripeSecretKey) {
  console.error('STRIPE_SECRET_KEY is missing in Backend/.env');
  process.exit(1);
}

const stripe = new Stripe(stripeSecretKey);
const requestedUrl = normalizeWebhookUrl(process.argv[2] || process.env.STRIPE_WEBHOOK_URL);

const existing = await stripe.webhookEndpoints.list({ limit: 20 });
console.log(`Found ${existing.data.length} Stripe webhook endpoint(s).`);
for (const endpoint of existing.data) {
  console.log(`- ${endpoint.id} | ${endpoint.status} | ${endpoint.url}`);
}

if (!requestedUrl) {
  console.log('\nStripe cannot send webhooks to localhost.');
  console.log('Create one with your public backend URL:');
  console.log('  npm run stripe:setup-webhook -- https://YOUR-BACKEND-URL');
  process.exit(0);
}

if (!requestedUrl.startsWith('https://')) {
  console.error('Webhook URL must be public HTTPS. Stripe rejects localhost/http.');
  process.exit(1);
}

const match = existing.data.find((endpoint) => endpoint.url === requestedUrl);
if (match) {
  await stripe.webhookEndpoints.update(match.id, {
    enabled_events: ENABLED_EVENTS,
    disabled: false,
  });
  console.log(`\nUpdated existing webhook ${match.id}`);
  console.log('Signing secret is only shown when the endpoint is first created.');
  console.log('Copy it from Stripe Dashboard → Developers → Webhooks → this endpoint → Signing secret.');
  process.exit(0);
}

const created = await stripe.webhookEndpoints.create({
  url: requestedUrl,
  enabled_events: ENABLED_EVENTS,
  description: 'IBelieveThis order payments',
});

if (created.secret) {
  writeWebhookSecret(created.secret);
  console.log(`\nCreated webhook ${created.id}`);
  console.log(`URL: ${created.url}`);
  console.log('STRIPE_WEBHOOK_SECRET saved to Backend/.env. Restart the backend.');
} else {
  console.log(`\nCreated webhook ${created.id} but Stripe did not return a secret.`);
  console.log('Copy the signing secret from the Stripe Dashboard.');
}
