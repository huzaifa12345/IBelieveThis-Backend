import dotenv from 'dotenv';
import Stripe from 'stripe';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const account = await stripe.accounts.retrieve();
console.log(`Account: ${account.id} | country: ${account.country} | default currency: ${account.default_currency}`);

const intent = await stripe.paymentIntents.create({
  amount: 3482,
  currency: 'usd',
  automatic_payment_methods: { enabled: true },
});

console.log('\nMethods Stripe will offer on this $34.82 USD order:');
intent.payment_method_types.forEach((type) => console.log(`  - ${type}`));

const capabilities = Object.entries(account.capabilities || {})
  .filter(([, status]) => status === 'active')
  .map(([name]) => name);

console.log('\nActive account capabilities:');
capabilities.forEach((name) => console.log(`  - ${name}`));

await stripe.paymentIntents.cancel(intent.id);
console.log(`\n(cleaned up probe intent ${intent.id})`);
