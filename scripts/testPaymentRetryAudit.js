import dotenv from 'dotenv';
import Stripe from 'stripe';
import sequelize from '../config/db.js';
import { PaymentAudit } from '../models/index.js';

dotenv.config();

const API = process.env.TEST_API_URL || `http://localhost:${process.env.PORT || 3002}/api`;
const productId = Number(process.argv[2] || 4);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const items = [{ product_id: productId, quantity: 1 }];

const shipping_address = {
  firstName: 'Retry',
  lastName: 'Tester',
  email: 'retry-tester@example.com',
  phone: '5551234567',
  address: '123 Main St',
  city: 'Los Angeles',
  state: 'CA',
  zipCode: '90001',
  country: 'United States',
};

const postJson = async (path, body) => {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status, body: await res.json() };
};

const logAttempt = (payment_intent_id, attempt_number, error_message) =>
  postJson('/payments/attempts', {
    payment_intent_id,
    attempt_number,
    customer_email: shipping_address.email,
    customer_name: 'Retry Tester',
    customer_phone: shipping_address.phone,
    error_message,
  });

const run = async () => {
  const intent = await postJson('/payments/create-intent', { items });
  if (!intent.body.clientSecret) {
    console.error('create-intent failed:', intent.body);
    process.exit(1);
  }
  const intentId = intent.body.paymentIntentId;
  console.log(`1) PaymentIntent ${intentId} for $${intent.body.amount}`);

  // Attempt 1: declined card
  let declineMessage = '';
  try {
    await stripe.paymentIntents.confirm(intentId, {
      payment_method: 'pm_card_chargeDeclined',
      return_url: 'https://example.com/checkout',
    });
    console.error('2) Expected the declined card to fail');
  } catch (error) {
    declineMessage = error.message;
    console.log(`2) Attempt 1 declined as expected: ${error.code} - ${declineMessage}`);
  }

  const failedLog = await logAttempt(intentId, 1, declineMessage);
  console.log(`3) Attempt 1 audited: status=${failedLog.body.status} canRetry=${failedLog.body.canRetry}`);

  const reusable = await stripe.paymentIntents.retrieve(intentId);
  console.log(`4) Intent reusable for retry: status=${reusable.status}`);

  // Attempt 2: retry same intent with a good card
  const confirmed = await stripe.paymentIntents.confirm(intentId, {
    payment_method: 'pm_card_visa',
    return_url: 'https://example.com/checkout',
  });
  console.log(`5) Attempt 2 (retry) result: ${confirmed.status}`);

  const successLog = await logAttempt(intentId, 2, null);
  console.log(`6) Attempt 2 audited: status=${successLog.body.status}`);

  const order = await postJson('/orders/guest', {
    items,
    transaction_id: intentId,
    shipping_address,
  });
  if (!order.ok) {
    console.error('7) Order creation failed:', order.status, order.body.error);
  } else {
    console.log(`7) Order created after retry: ${order.body.order.order_number}`);
  }

  // Give the order-source audit write a moment to land
  await new Promise((resolve) => setTimeout(resolve, 800));

  const rows = await PaymentAudit.findAll({
    where: { payment_intent_id: intentId },
    order: [['created_at', 'ASC']],
  });

  console.log(`\n8) payment_audits rows for ${intentId}: ${rows.length}`);
  rows.forEach((row) => {
    console.log(
      `   #${row.id} ${row.status.padEnd(12)} source=${row.source.padEnd(8)} ` +
      `attempt=${row.attempt_number ?? '-'} amount=$${row.amount} ${row.currency} ` +
      `card=${row.card_brand || '-'}/${row.card_last4 || '-'} ` +
      `order=${row.order_number || '-'} error=${row.error_code || row.error_message || '-'}`
    );
    console.log(
      `      contact: name=${row.customer_name || '-'} email=${row.customer_email || '-'} phone=${row.customer_phone || '-'}`
    );
  });

  const invalid = await logAttempt('pi_does_not_exist', 1, 'bogus');
  console.log(`\n9) Unknown intent rejected (${invalid.status}): ${invalid.body.error}`);

  await sequelize.close();
};

run().catch(async (error) => {
  console.error('Test failed:', error);
  await sequelize.close();
  process.exit(1);
});
