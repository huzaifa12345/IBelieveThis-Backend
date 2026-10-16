import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey)
  : null;

export const isStripeConfigured = () => Boolean(stripeSecretKey && stripe);
