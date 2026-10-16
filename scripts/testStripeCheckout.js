import dotenv from 'dotenv';
import Stripe from 'stripe';

dotenv.config();

const API = process.env.TEST_API_URL || `http://localhost:${process.env.PORT || 3002}/api`;
const productId = Number(process.argv[2] || 4);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const items = [{ product_id: productId, quantity: 1 }];

const intentRes = await fetch(`${API}/payments/create-intent`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ items }),
});
const intent = await intentRes.json();
if (!intent.clientSecret) {
  console.error('create-intent failed:', intent);
  process.exit(1);
}
console.log(`1) PaymentIntent created: ${intent.paymentIntentId} for $${intent.amount} ${intent.currency}`);

const confirmed = await stripe.paymentIntents.confirm(intent.paymentIntentId, {
  payment_method: 'pm_card_visa',
  return_url: 'https://example.com/checkout',
});
console.log(`2) Test card confirmed: ${confirmed.status}`);

const orderRes = await fetch(`${API}/orders/guest`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    items,
    transaction_id: intent.paymentIntentId,
    shipping_address: {
      firstName: 'Test',
      lastName: 'Buyer',
      email: 'test@example.com',
      phone: '5551234567',
      address: '123 Main St',
      city: 'Los Angeles',
      state: 'CA',
      zipCode: '90001',
      country: 'United States',
    },
  }),
});
const orderBody = await orderRes.json();
if (!orderRes.ok) {
  console.error('3) Order creation failed:', orderRes.status, orderBody.error || orderBody);
  process.exit(1);
}

const order = orderBody.order;
console.log(`3) Order created: ${order.order_number}`);
console.log(`   method=${order.payment_method} status=${order.payment_status} currency=${order.currency}`);
console.log(`   subtotal=$${order.subtotal} tax=$${order.tax_amount} shipping=$${order.shipping_amount} total=$${order.total_amount}`);

const replay = await fetch(`${API}/orders/guest`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    items,
    transaction_id: intent.paymentIntentId,
    shipping_address: { firstName: 'Test', lastName: 'Buyer', email: 'test@example.com', city: 'Los Angeles' },
  }),
});
const replayBody = await replay.json();
console.log(`4) Duplicate guard: ${replayBody.message || replayBody.error}`);

const noPayment = await fetch(`${API}/orders/guest`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    items,
    shipping_address: { firstName: 'No', lastName: 'Card', email: 'x@example.com', city: 'LA' },
  }),
});
const noPaymentBody = await noPayment.json();
console.log(`5) Order without payment blocked (${noPayment.status}): ${noPaymentBody.error}`);
