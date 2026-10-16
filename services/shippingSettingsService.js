import WebsiteSetting from '../models/WebsiteSetting.js';

export const DEFAULT_SHIPPING = {
  standard_cost: 10,
  free_threshold: 100,
  label: 'Standard Delivery',
  // Admin edits this as a percent (8.3 = 8.3%). Internally we also expose tax_rate as 0.083.
  tax_rate_percent: 8.3,
};

const KEYS = {
  standard_cost: 'shipping_standard_cost',
  free_threshold: 'shipping_free_threshold',
  label: 'shipping_standard_label',
  tax_rate_percent: 'tax_rate_percent',
};

async function ensureSetting(key, value, description, sortOrder) {
  const [row] = await WebsiteSetting.findOrCreate({
    where: { key },
    defaults: {
      key,
      value: String(value),
      type: 'text',
      description,
      category: 'shipping',
      is_active: true,
      sort_order: sortOrder,
    },
  });
  return row;
}

export async function ensureShippingSettings() {
  await ensureSetting(KEYS.standard_cost, DEFAULT_SHIPPING.standard_cost, 'Standard shipping fee in USD', 1);
  await ensureSetting(KEYS.free_threshold, DEFAULT_SHIPPING.free_threshold, 'Order subtotal for free shipping (USD)', 2);
  await ensureSetting(KEYS.label, DEFAULT_SHIPPING.label, 'Label shown at checkout for standard shipping', 3);
  await ensureSetting(KEYS.tax_rate_percent, DEFAULT_SHIPPING.tax_rate_percent, 'Sales tax percent applied to order subtotal', 4);
}

function parseMoney(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n * 100) / 100;
}

function parsePercent(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) return fallback;
  return Math.round(n * 1000) / 1000;
}

function withTaxFields(config) {
  return {
    ...config,
    tax_rate: Math.round((config.tax_rate_percent / 100) * 1000000) / 1000000,
  };
}

/**
 * Public checkout config: shipping + tax. Used by cart, checkout, payment intents, orders.
 */
export async function getShippingConfig() {
  try {
    await ensureShippingSettings();
    const rows = await WebsiteSetting.findAll({
      where: { category: 'shipping', is_active: true },
    });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    return withTaxFields({
      standard_cost: parseMoney(map[KEYS.standard_cost], DEFAULT_SHIPPING.standard_cost),
      free_threshold: parseMoney(map[KEYS.free_threshold], DEFAULT_SHIPPING.free_threshold),
      label: (map[KEYS.label] || DEFAULT_SHIPPING.label).trim() || DEFAULT_SHIPPING.label,
      tax_rate_percent: parsePercent(map[KEYS.tax_rate_percent], DEFAULT_SHIPPING.tax_rate_percent),
    });
  } catch (error) {
    console.warn('Shipping/tax config fallback to defaults:', error.message);
    return withTaxFields({ ...DEFAULT_SHIPPING });
  }
}

export async function updateShippingConfig({ standard_cost, free_threshold, label, tax_rate_percent }) {
  await ensureShippingSettings();

  const nextCost = parseMoney(standard_cost, DEFAULT_SHIPPING.standard_cost);
  const nextThreshold = parseMoney(free_threshold, DEFAULT_SHIPPING.free_threshold);
  const nextLabel = String(label || DEFAULT_SHIPPING.label).trim() || DEFAULT_SHIPPING.label;
  const nextTaxPercent = parsePercent(
    tax_rate_percent === undefined || tax_rate_percent === null || tax_rate_percent === ''
      ? DEFAULT_SHIPPING.tax_rate_percent
      : tax_rate_percent,
    DEFAULT_SHIPPING.tax_rate_percent
  );

  if (nextCost > 10000 || nextThreshold > 100000) {
    throw new Error('Shipping values are unrealistically high');
  }
  if (nextTaxPercent > 100) {
    throw new Error('Tax percent cannot be greater than 100');
  }

  await WebsiteSetting.update(
    { value: String(nextCost) },
    { where: { key: KEYS.standard_cost } }
  );
  await WebsiteSetting.update(
    { value: String(nextThreshold) },
    { where: { key: KEYS.free_threshold } }
  );
  await WebsiteSetting.update(
    { value: nextLabel },
    { where: { key: KEYS.label } }
  );
  await WebsiteSetting.update(
    { value: String(nextTaxPercent) },
    { where: { key: KEYS.tax_rate_percent } }
  );

  return getShippingConfig();
}
