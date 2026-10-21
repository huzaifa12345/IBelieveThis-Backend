import WebsiteSetting from '../models/WebsiteSetting.js';

/** Contact, social, policies — findOrCreate only; never overwrite owner edits. */
export const STORE_CONTENT_DEFAULTS = [
  // Contact
  { key: 'contact_email', value: '', type: 'text', description: 'Public support email', category: 'contact', sort_order: 1 },
  { key: 'contact_phone', value: '', type: 'text', description: 'Public phone (optional)', category: 'contact', sort_order: 2 },
  { key: 'contact_address', value: '', type: 'text', description: 'Business address (optional — leave blank until ready)', category: 'contact', sort_order: 3 },
  { key: 'business_hours', value: 'Mon–Fri, 9am–5pm US Eastern', type: 'text', description: 'Business hours', category: 'contact', sort_order: 4 },
  { key: 'reply_time', value: 'We typically reply within 1–2 business days.', type: 'text', description: 'Expected reply time', category: 'contact', sort_order: 5 },

  // Social (empty = hidden in footer)
  { key: 'social_pinterest', value: '', type: 'url', description: 'Pinterest profile URL', category: 'social', sort_order: 1 },
  { key: 'social_facebook', value: '', type: 'url', description: 'Facebook page URL', category: 'social', sort_order: 2 },
  { key: 'social_instagram', value: '', type: 'url', description: 'Instagram profile URL', category: 'social', sort_order: 3 },
  { key: 'social_etsy', value: 'https://www.etsy.com/shop/IBelieveThis', type: 'url', description: 'Etsy shop URL', category: 'social', sort_order: 4 },

  // Returns
  { key: 'return_window_days', value: '7', type: 'text', description: 'Return / exchange window (days)', category: 'policies', sort_order: 1 },
  {
    key: 'return_shipping_rule',
    value:
      'If your item arrives damaged or incorrect, we cover return shipping. For change-of-mind returns within the return window, the customer is responsible for return shipping unless we state otherwise in writing.',
    type: 'text',
    description: 'Who pays return shipping',
    category: 'policies',
    sort_order: 2,
  },

  // Long-form policies (owner should customize placeholders)
  {
    key: 'policy_privacy',
    value: `PRIVACY POLICY — IBelieveThis

Last updated: [OWNER: add date]

This Privacy Policy explains how IBelieveThis ("we", "us") collects and uses information when you shop at https://www.ibelievethis.us.

1. Information we collect
- Contact details you provide (name, email, shipping address, phone)
- Order and payment-related information (processed by Stripe; we do not store full card numbers)
- Device/browser data and cookies needed to run the site and improve shopping

2. How we use information
- To process orders, shipping, returns, and customer support
- To send order confirmations and important account notices
- To improve our storefront and prevent fraud

3. Payments
Payments are processed by Stripe. See Stripe's privacy policy for how they handle payment data.

4. Cookies
We use essential cookies for cart/session and may use analytics cookies to understand site usage.

5. Selling of data
We do not sell your personal information.

6. CCPA / US privacy requests
If you are a US resident you may request access to or deletion of personal information we hold about you. Email us using the support address on our Contact page. [OWNER: add your privacy contact process]

7. Contact
Use the Contact page or the support email listed in store settings.

[OWNER: Add your legal business name and state of formation when ready.]`,
    type: 'text',
    description: 'Privacy Policy page body',
    category: 'policies',
    sort_order: 10,
  },
  {
    key: 'policy_terms',
    value: `TERMS OF SERVICE — IBelieveThis

Last updated: [OWNER: add date]

By using https://www.ibelievethis.us you agree to these Terms.

1. Products & pricing
Product descriptions and prices may change. Prices are shown in USD. Tax and shipping are calculated at checkout as configured in our store settings.

2. Orders
Placing an order is an offer to buy. We may cancel or refuse an order (for example stock, pricing error, or suspected fraud) and will notify you.

3. Accounts
You are responsible for keeping login credentials secure.

4. Intellectual property
Site content, branding, and product imagery belong to IBelieveThis or its licensors.

5. Limitation of liability
To the fullest extent allowed by US law, we are not liable for indirect or consequential damages arising from use of the site.

6. Governing law
[OWNER: Add governing state/law, e.g. "These terms are governed by the laws of the State of ____, USA."]

7. Contact
Questions? Use our Contact page.`,
    type: 'text',
    description: 'Terms of Service page body',
    category: 'policies',
    sort_order: 11,
  },
  {
    key: 'policy_shipping',
    value: `SHIPPING POLICY — IBelieveThis

Last updated: [OWNER: add date]

1. Processing time
Orders are typically processed within [OWNER: e.g. 1–3] business days after payment confirmation (excluding weekends/holidays).

2. Delivery time
Transit time after shipment is usually [OWNER: e.g. 3–7] business days within the contiguous United States, depending on carrier and destination. Alaska/Hawaii/PO Boxes may take longer.

3. Carriers
We ship via [OWNER: list carriers, e.g. USPS, UPS, FedEx].

4. Tracking
When your order ships you will receive tracking by email when available.

5. Shipping rates
Rates (or free-shipping thresholds) are shown at checkout and managed in our shipping settings.

6. Lost or damaged packages
If a package is lost or arrives damaged, contact us within [OWNER: e.g. 7] days of delivery (or expected delivery) via the Contact page with your order number and photos if damaged. We will work with the carrier to resolve the issue.

7. International
[OWNER: State whether you ship only within the US or also internationally.]`,
    type: 'text',
    description: 'Shipping Policy page body',
    category: 'policies',
    sort_order: 12,
  },
  {
    key: 'policy_about',
    value: '',
    type: 'text',
    description: 'Optional About page override (leave blank to use built-in About content)',
    category: 'policies',
    sort_order: 13,
  },
];

export async function ensureStoreContentSettings() {
  for (const setting of STORE_CONTENT_DEFAULTS) {
    await WebsiteSetting.findOrCreate({
      where: { key: setting.key },
      defaults: { ...setting, is_active: true },
    });
  }
}

export async function getSettingMap(keys = []) {
  const rows = await WebsiteSetting.findAll({
    where: keys.length ? { key: keys } : undefined,
  });
  const map = {};
  rows.forEach((r) => {
    map[r.key] = r.value;
  });
  return map;
}
