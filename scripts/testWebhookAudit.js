import dotenv from 'dotenv';
import Stripe from 'stripe';
import sequelize from '../config/db.js';
import { PaymentAudit } from '../models/index.js';

dotenv.config();

const WEBHOOK_URL = process.env.TEST_WEBHOOK_URL || `http://localhost:${process.env.PORT || 3002}/api/payments/webhook`;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const secret = process.env.STRIPE_WEBHOOK_SECRET;

const intentId = `pi_audit_test_${Date.now()}`;
const eventId = `evt_audit_test_${Date.now()}`;

const event = {
  id: eventId,
  object: 'event',
  type: 'payment_intent.payment_failed',
  created: Math.floor(Date.now() / 1000),
  livemode: false,
  data: {
    object: {
      id: intentId,
      object: 'payment_intent',
      amount: 3482,
      currency: 'usd',
      status: 'requires_payment_method',
      payment_method_types: ['card'],
      receipt_email: 'webhook-tester@example.com',
      last_payment_error: {
        code: 'card_declined',
        message: 'Your card was declined.',
        payment_method: { type: 'card', card: { brand: 'visa', last4: '0002' } },
      },
    },
  },
};

const send = async () => {
  const payload = JSON.stringify(event);
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': header },
    body: payload,
  });
  return { status: res.status, body: await res.text() };
};

const run = async () => {
  if (!secret) {
    console.error('STRIPE_WEBHOOK_SECRET is missing from .env');
    process.exit(1);
  }

  const first = await send();
  console.log(`1) Webhook delivered (${first.status}): ${first.body}`);

  const replay = await send();
  console.log(`2) Same event replayed (${replay.status}): ${replay.body}`);

  const bad = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': 't=1,v1=deadbeef' },
    body: JSON.stringify(event),
  });
  console.log(`3) Bad signature rejected (${bad.status})`);

  await new Promise((resolve) => setTimeout(resolve, 500));

  const rows = await PaymentAudit.findAll({ where: { payment_intent_id: intentId } });
  console.log(`\n4) Audit rows for ${intentId}: ${rows.length} (duplicate event should not double-log)`);
  rows.forEach((row) => {
    console.log(
      `   #${row.id} ${row.status} source=${row.source} event=${row.stripe_event_id} ` +
      `card=${row.card_brand}/${row.card_last4} error=${row.error_code} email=${row.customer_email}`
    );
  });

  await sequelize.close();
};

run().catch(async (error) => {
  console.error('Webhook audit test failed:', error);
  await sequelize.close();
  process.exit(1);
});
