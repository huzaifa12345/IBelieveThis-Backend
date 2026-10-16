import { Product } from '../models/index.js';
import { getShippingConfig } from '../services/shippingSettingsService.js';

export const CURRENCY = 'usd';

// Kept for scripts / backwards compatibility — prefer getShippingConfig().
export const TAX_RATE = 0.083;
export const FREE_SHIPPING_THRESHOLD = 100;
export const STANDARD_SHIPPING_USD = 10;

export function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

export function toCents(amount) {
  return Math.round(Number(amount) * 100);
}

export function shippingForSubtotal(subtotal, config = null) {
  const freeThreshold = config?.free_threshold ?? FREE_SHIPPING_THRESHOLD;
  const standardCost = config?.standard_cost ?? STANDARD_SHIPPING_USD;
  return Number(subtotal) >= freeThreshold ? 0 : standardCost;
}

export async function totalsFromSubtotal(subtotal) {
  const s = roundMoney(subtotal);
  const checkoutConfig = await getShippingConfig();
  const taxRate = checkoutConfig.tax_rate ?? TAX_RATE;
  const taxAmount = roundMoney(s * taxRate);
  const shippingAmount = shippingForSubtotal(s, checkoutConfig);
  const totalAmount = roundMoney(s + taxAmount + shippingAmount);
  return {
    subtotal: s,
    taxAmount,
    shippingAmount,
    totalAmount,
    taxRate,
    taxRatePercent: checkoutConfig.tax_rate_percent,
    shippingConfig: checkoutConfig,
  };
}

export async function buildOrderItems(items) {
  if (!items || items.length === 0) {
    throw new Error('Order must contain at least one item');
  }

  let calculatedSubtotal = 0;
  const orderItems = [];

  for (const item of items) {
    const product = await Product.findByPk(item.product_id);
    if (!product || !product.is_active) {
      throw new Error(`Product with ID ${item.product_id} not found or inactive`);
    }

    if (product.stock_quantity < item.quantity) {
      throw new Error(`Insufficient stock for product: ${product.name}`);
    }

    const unitPrice = product.discount_price
      ? parseFloat(product.discount_price)
      : parseFloat(product.price);
    const itemTotal = roundMoney(unitPrice * item.quantity);
    calculatedSubtotal += itemTotal;

    orderItems.push({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: unitPrice,
      total_price: itemTotal,
      selected_size: item.selected_size || null,
      product_snapshot: {
        name: product.name,
        sku: product.sku,
        image_url: product.image_url,
      },
    });
  }

  return {
    calculatedSubtotal: roundMoney(calculatedSubtotal),
    orderItems,
  };
}
