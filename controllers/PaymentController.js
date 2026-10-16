import { Op, fn, col } from 'sequelize';
import { stripe, isStripeConfigured } from '../config/stripe.js';
import { Order, PaymentAudit } from '../models/index.js';
import { buildOrderItems, totalsFromSubtotal, toCents, CURRENCY } from '../utils/orderTotals.js';
import { recordPaymentAudit, describePaymentIntent } from '../services/paymentAuditService.js';

// Keeps the public attempt endpoint from flooding the audit table for one intent.
const MAX_LOGGED_ATTEMPTS_PER_INTENT = 15;

const createPaymentIntent = async (req, res) => {
  try {
    if (!isStripeConfigured()) {
      return res.status(503).json({
        error: 'Stripe is not configured. Add STRIPE_SECRET_KEY to the backend .env file.',
      });
    }

    const { items } = req.body;
    const { calculatedSubtotal } = await buildOrderItems(items);
    const totals = await totalsFromSubtotal(calculatedSubtotal);
    const amount = toCents(totals.totalAmount);

    if (amount < 50) {
      return res.status(400).json({ error: 'Order total is too small to charge with Stripe.' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: CURRENCY,
      automatic_payment_methods: { enabled: true },
      metadata: {
        subtotal: String(totals.subtotal),
        tax: String(totals.taxAmount),
        shipping: String(totals.shippingAmount),
        total: String(totals.totalAmount),
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: totals.totalAmount,
      currency: CURRENCY,
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(400).json({ error: error.message || 'Unable to start Stripe payment' });
  }
};

/**
 * Called by the browser after each confirm attempt. The outcome is read back
 * from Stripe rather than trusted from the client.
 */
const recordPaymentAttempt = async (req, res) => {
  try {
    if (!isStripeConfigured()) {
      return res.status(503).json({ error: 'Stripe is not configured' });
    }

    const {
      payment_intent_id,
      attempt_number,
      customer_email,
      customer_name,
      customer_phone,
      error_message,
    } = req.body;

    if (!payment_intent_id) {
      return res.status(400).json({ error: 'payment_intent_id is required' });
    }

    const loggedAttempts = await PaymentAudit.count({
      where: { payment_intent_id, source: 'checkout' },
    });
    if (loggedAttempts >= MAX_LOGGED_ATTEMPTS_PER_INTENT) {
      return res.status(429).json({ error: 'Too many attempts recorded for this payment' });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id, {
      expand: ['latest_charge'],
    });

    const described = describePaymentIntent(paymentIntent);
    const status = paymentIntent.status === 'succeeded'
      ? 'succeeded'
      : paymentIntent.status === 'canceled'
        ? 'canceled'
        : paymentIntent.status === 'processing'
          ? 'processing'
          : 'failed';

    const audit = await recordPaymentAudit({
      ...described,
      status,
      source: 'checkout',
      attempt_number: Number(attempt_number) || null,
      // Stripe's billing details win; the checkout form fills the gaps.
      customer_email: described.customer_email || customer_email || null,
      customer_name: described.customer_name || customer_name || null,
      customer_phone: described.customer_phone || customer_phone || null,
      error_message: described.error_message || error_message || null,
    });

    res.status(201).json({
      logged: Boolean(audit),
      status,
      canRetry: status === 'failed',
    });
  } catch (error) {
    console.error('Record payment attempt error:', error);
    res.status(400).json({ error: error.message || 'Unable to record payment attempt' });
  }
};

const getPaymentAudits = async (req, res) => {
  try {
    const { page = 1, limit = 25, status, source, search, days } = req.query;
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit) || 25, 1), 200);

    const where = {};
    if (status) where.status = status;
    if (source) where.source = source;

    if (days) {
      const since = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);
      where.created_at = { [Op.gte]: since };
    }

    if (search) {
      const term = `%${search.trim()}%`;
      where[Op.or] = [
        { payment_intent_id: { [Op.iLike]: term } },
        { order_number: { [Op.iLike]: term } },
        { customer_email: { [Op.iLike]: term } },
        { customer_name: { [Op.iLike]: term } },
        { customer_phone: { [Op.iLike]: term } },
        { card_last4: { [Op.iLike]: term } },
      ];
    }

    const { count, rows } = await PaymentAudit.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: limitNum,
      offset: (pageNum - 1) * limitNum,
    });

    // Summary is intentionally computed over all rows, not just the current page.
    const grouped = await PaymentAudit.findAll({
      attributes: [
        'status',
        [fn('COUNT', col('id')), 'count'],
        [fn('COALESCE', fn('SUM', col('amount')), 0), 'amount'],
      ],
      where,
      group: ['status'],
      raw: true,
    });

    const summary = grouped.reduce((acc, row) => {
      acc[row.status] = { count: Number(row.count), amount: Number(row.amount) };
      return acc;
    }, {});

    res.json({
      audits: rows,
      summary,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(count / limitNum) || 1,
      },
    });
  } catch (error) {
    console.error('Get payment audits error:', error);
    res.status(500).json({ error: error.message });
  }
};

const getWebhookPayload = (body) => {
  if (Buffer.isBuffer(body)) return body;
  if (typeof body === 'string') return Buffer.from(body);
  throw new Error('Webhook body must be raw JSON. Check that /api/payments/webhook is registered before express.json().');
};

const updateOrderFromPaymentIntent = async (paymentIntent, paymentStatus) => {
  if (!paymentIntent?.id) return null;
  const order = await Order.findOne({ where: { transaction_id: paymentIntent.id } });
  if (!order) {
    console.log(`Stripe webhook: no order yet for ${paymentIntent.id} (${paymentStatus})`);
    return null;
  }
  await order.update({
    payment_status: paymentStatus,
    payment_method: 'stripe',
  });
  console.log(`Stripe webhook: order ${order.order_number} marked ${paymentStatus}`);
  return order;
};

const handleStripeWebhook = async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({ error: 'Stripe is not configured' });
  }

  const signature = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature) {
    return res.status(400).json({ error: 'Missing Stripe-Signature header' });
  }

  if (!webhookSecret) {
    console.warn('STRIPE_WEBHOOK_SECRET is not set; ignoring webhook');
    return res.status(400).json({ error: 'Webhook secret is not configured' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(getWebhookPayload(req.body), signature, webhookSecret);
  } catch (error) {
    console.error('Stripe webhook signature failed:', error.message);
    return res.status(400).json({ error: `Webhook error: ${error.message}` });
  }

  try {
    console.log(`Stripe webhook received: ${event.type} (${event.id})`);

    const auditStatusByEvent = {
      'payment_intent.succeeded': 'succeeded',
      'payment_intent.payment_failed': 'failed',
      'payment_intent.canceled': 'canceled',
    };

    if (auditStatusByEvent[event.type]) {
      const paymentIntent = event.data.object;
      const auditStatus = auditStatusByEvent[event.type];
      const order = await updateOrderFromPaymentIntent(
        paymentIntent,
        auditStatus === 'succeeded' ? 'paid' : 'failed'
      );

      await recordPaymentAudit({
        ...describePaymentIntent(paymentIntent),
        status: auditStatus,
        source: 'webhook',
        stripe_event_id: event.id,
        order_id: order?.id || null,
        order_number: order?.order_number || null,
      });
    }

    if (event.type === 'charge.refunded') {
      const charge = event.data.object;
      const paymentIntentId = typeof charge.payment_intent === 'string'
        ? charge.payment_intent
        : charge.payment_intent?.id;
      if (paymentIntentId) {
        const order = await updateOrderFromPaymentIntent({ id: paymentIntentId }, 'refunded');
        await recordPaymentAudit({
          payment_intent_id: paymentIntentId,
          status: 'refunded',
          source: 'webhook',
          stripe_event_id: event.id,
          order_id: order?.id || null,
          order_number: order?.order_number || null,
          amount: typeof charge.amount_refunded === 'number' ? charge.amount_refunded / 100 : null,
          currency: (charge.currency || 'usd').toUpperCase(),
          details: { charge_id: charge.id },
        });
      }
    }
  } catch (error) {
    console.error('Stripe webhook processing error:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }

  res.json({ received: true });
};

export {
  createPaymentIntent,
  recordPaymentAttempt,
  getPaymentAudits,
  handleStripeWebhook,
};
