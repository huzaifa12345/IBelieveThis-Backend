import { PaymentAudit } from '../models/index.js';

const centsToAmount = (cents) => (typeof cents === 'number' ? cents / 100 : null);

const pickCharge = (paymentIntent) => {
  const latest = paymentIntent?.latest_charge;
  if (latest && typeof latest === 'object') return latest;
  return paymentIntent?.charges?.data?.[0] || null;
};

/**
 * Flatten a Stripe PaymentIntent into audit columns.
 */
export function describePaymentIntent(paymentIntent) {
  if (!paymentIntent) return {};

  const charge = pickCharge(paymentIntent);
  const cardDetails = charge?.payment_method_details?.card || null;
  const lastError = paymentIntent.last_payment_error || null;
  const billing = charge?.billing_details || lastError?.payment_method?.billing_details || null;

  const methodType =
    charge?.payment_method_details?.type ||
    lastError?.payment_method?.type ||
    paymentIntent.payment_method_types?.[0] ||
    null;

  return {
    payment_intent_id: paymentIntent.id || null,
    amount: centsToAmount(paymentIntent.amount),
    currency: (paymentIntent.currency || 'usd').toUpperCase(),
    payment_method_type: methodType,
    card_brand: cardDetails?.brand || lastError?.payment_method?.card?.brand || null,
    card_last4: cardDetails?.last4 || lastError?.payment_method?.card?.last4 || null,
    customer_email: billing?.email || paymentIntent.receipt_email || null,
    customer_name: billing?.name || null,
    customer_phone: billing?.phone || null,
    error_code: lastError?.code || lastError?.decline_code || null,
    error_message: lastError?.message || null,
    details: {
      intent_status: paymentIntent.status || null,
      livemode: paymentIntent.livemode ?? null,
      outcome: charge?.outcome?.seller_message || null,
      risk_level: charge?.outcome?.risk_level || null,
      receipt_url: charge?.receipt_url || null,
    },
  };
}

/**
 * Writes an audit row. Never throws so payment flow is unaffected by logging.
 */
export async function recordPaymentAudit(entry) {
  try {
    const row = await PaymentAudit.create(entry);
    console.log(
      `Payment audit #${row.id}: ${row.status} via ${row.source}` +
      `${row.payment_intent_id ? ` (${row.payment_intent_id})` : ''}`
    );
    return row;
  } catch (error) {
    // Unique violation on stripe_event_id means we already logged this event.
    if (error?.name === 'SequelizeUniqueConstraintError') {
      console.log(`Payment audit skipped (duplicate event ${entry.stripe_event_id})`);
      return null;
    }
    console.error('Payment audit failed to save:', error.message);
    return null;
  }
}
