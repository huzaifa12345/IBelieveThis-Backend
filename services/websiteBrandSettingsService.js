import WebsiteSetting from '../models/WebsiteSetting.js';

const PLACEHOLDER_LOGO =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQwIiBoZWlnaHQ9IjgwIiB2aWV3Qm94PSIwIDAgMjQwIDgwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cmVjdCB3aWR0aD0iMjQwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjZjNmNGY2Ii8+Cjx0ZXh0IHg9IjEyMCIgeT0iNDAiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzMzMzMzMyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPklCZWxpZXZlVGhpczwvdGV4dD4KPHN2Zz4=';

const PLACEHOLDER_SLIDE =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYwMCIgaGVpZ2h0PSI2MDAiIHZpZXdCb3g9IjAgMCAxNjAwIDYwMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjE2MDAiIGhlaWdodD0iNjAwIiBmaWxsPSIjZGRkIi8+Cjx0ZXh0IHg9IjgwMCIgeT0iMzAwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iNDAiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5IZXJvIFNsaWRlPC90ZXh0Pgo8L3N2Zz4=';

/** Logo + hero slider defaults. findOrCreate — never overwrites existing values. */
export const BRAND_DEFAULT_SETTINGS = [
  {
    key: 'website_logo',
    value: PLACEHOLDER_LOGO,
    type: 'image',
    description: 'Website main logo',
    category: 'logo',
    sort_order: 1,
  },
  {
    key: 'hero_slide_1',
    value: PLACEHOLDER_SLIDE,
    type: 'image',
    description: 'Hero slider image 1',
    category: 'hero',
    sort_order: 1,
  },
  {
    key: 'hero_slide_2',
    value: PLACEHOLDER_SLIDE,
    type: 'image',
    description: 'Hero slider image 2',
    category: 'hero',
    sort_order: 2,
  },
  {
    key: 'hero_slide_3',
    value: PLACEHOLDER_SLIDE,
    type: 'image',
    description: 'Hero slider image 3',
    category: 'hero',
    sort_order: 3,
  },
  {
    key: 'hero_slide_4',
    value: PLACEHOLDER_SLIDE,
    type: 'image',
    description: 'Hero slider image 4',
    category: 'hero',
    sort_order: 4,
  },
  {
    key: 'hero_title_1',
    value: 'Welcome to IBelieveThis',
    type: 'text',
    description: 'Hero slide 1 title',
    category: 'hero',
    sort_order: 5,
  },
  {
    key: 'hero_description_1',
    value: 'Shop American-made decorative bells and home accents with secure checkout.',
    type: 'text',
    description: 'Hero slide 1 description',
    category: 'hero',
    sort_order: 6,
  },
  {
    key: 'hero_title_2',
    value: 'Premium Quality Collections',
    type: 'text',
    description: 'Hero slide 2 title',
    category: 'hero',
    sort_order: 7,
  },
  {
    key: 'hero_description_2',
    value: 'Explore handcrafted pieces designed for lasting style.',
    type: 'text',
    description: 'Hero slide 2 description',
    category: 'hero',
    sort_order: 8,
  },
  {
    key: 'hero_title_3',
    value: 'Made for Everyday Moments',
    type: 'text',
    description: 'Hero slide 3 title',
    category: 'hero',
    sort_order: 9,
  },
  {
    key: 'hero_description_3',
    value: 'Find something special for your home and gifts.',
    type: 'text',
    description: 'Hero slide 3 description',
    category: 'hero',
    sort_order: 10,
  },
  {
    key: 'hero_title_4',
    value: 'Fast US Shipping',
    type: 'text',
    description: 'Hero slide 4 title',
    category: 'hero',
    sort_order: 11,
  },
  {
    key: 'hero_description_4',
    value: 'Secure Stripe checkout with reliable delivery across the United States.',
    type: 'text',
    description: 'Hero slide 4 description',
    category: 'hero',
    sort_order: 12,
  },
];

/**
 * Ensure logo + hero settings exist (fresh DBs often only have shipping from boot seed).
 */
export async function ensureBrandSettings() {
  for (const setting of BRAND_DEFAULT_SETTINGS) {
    await WebsiteSetting.findOrCreate({
      where: { key: setting.key },
      defaults: {
        ...setting,
        is_active: true,
      },
    });
  }
}
