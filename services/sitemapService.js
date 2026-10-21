import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Product, Category } from '../models/index.js';
import { productPathSlug, slugify } from '../utils/slugify.js';

/** Canonical public host — must be www (non-www 308s to www). */
const SITE = (process.env.PUBLIC_SITE_URL || 'https://www.ibelievethis.us')
  .replace(/\/$/, '')
  .replace('://ibelievethis.us', '://www.ibelievethis.us');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_SITEMAP_PATH = path.resolve(__dirname, '../../Frontend/public/sitemap.xml');

const xmlEscape = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const categoryPublicSlug = (cat) => {
  if (cat.slug) return cat.slug;
  return slugify(cat.name) || String(cat.id);
};

const urlEntry = (loc, { priority = '0.7', changefreq = 'weekly', lastmod, images = [] } = {}) => {
  const last = lastmod
    ? `\n    <lastmod>${new Date(lastmod).toISOString().slice(0, 10)}</lastmod>`
    : '';
  const imageXml = (images || [])
    .filter(Boolean)
    .slice(0, 5)
    .map(
      (img) => `
    <image:image>
      <image:loc>${xmlEscape(img)}</image:loc>
    </image:image>`
    )
    .join('');
  return `  <url>
    <loc>${xmlEscape(loc)}</loc>${last}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>${imageXml}
  </url>`;
};

/**
 * Build a fresh sitemap from the live products + categories tables.
 * Every <loc> uses https://www.ibelievethis.us and routes that return 200.
 */
export async function buildSitemapXml() {
  const [products, categories] = await Promise.all([
    Product.findAll({ where: { is_active: true }, order: [['updated_at', 'DESC']] }),
    Category.findAll({ where: { is_active: true }, order: [['id', 'ASC']] }),
  ]);

  const staticPages = [
    urlEntry(`${SITE}/`, { priority: '1.0', changefreq: 'daily' }),
    urlEntry(`${SITE}/all-products`, { priority: '0.9', changefreq: 'daily' }),
    urlEntry(`${SITE}/about`, { priority: '0.6', changefreq: 'monthly' }),
    urlEntry(`${SITE}/return-policy`, { priority: '0.5', changefreq: 'monthly' }),
    urlEntry(`${SITE}/contact`, { priority: '0.5', changefreq: 'monthly' }),
    urlEntry(`${SITE}/privacy-policy`, { priority: '0.4', changefreq: 'yearly' }),
    urlEntry(`${SITE}/terms-of-service`, { priority: '0.4', changefreq: 'yearly' }),
    urlEntry(`${SITE}/shipping-policy`, { priority: '0.5', changefreq: 'monthly' }),
  ];

  const categoryPages = categories.map((cat) =>
    urlEntry(`${SITE}/category/${categoryPublicSlug(cat)}`, {
      priority: '0.8',
      changefreq: 'weekly',
      lastmod: cat.updated_at,
    })
  );

  const productPages = products.map((product) => {
    const imgs = [];
    if (Array.isArray(product.images)) imgs.push(...product.images.filter(Boolean));
    if (product.image_url) imgs.unshift(product.image_url);
    return urlEntry(`${SITE}/product/${productPathSlug(product)}`, {
      priority: '0.9',
      changefreq: 'weekly',
      lastmod: product.updated_at,
      images: [...new Set(imgs)],
    });
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${[...staticPages, ...categoryPages, ...productPages].join('\n')}
</urlset>
`;
}

export async function writeSitemapFile(xml) {
  if (process.env.SITEMAP_WRITE_FILE !== 'true') return false;
  try {
    const dir = path.dirname(PUBLIC_SITEMAP_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PUBLIC_SITEMAP_PATH, xml, 'utf8');
    return true;
  } catch (error) {
    console.warn('Sitemap file write skipped:', error.message);
    return false;
  }
}

export async function refreshSitemap() {
  const xml = await buildSitemapXml();
  await writeSitemapFile(xml);
  const productCount = (xml.match(/\/product\//g) || []).length;
  console.log(`🗺️ Sitemap refreshed (${productCount} product URLs, site=${SITE})`);
  return xml;
}

export function refreshSitemapAsync() {
  refreshSitemap().catch((error) => {
    console.warn('Sitemap refresh failed:', error.message);
  });
}

export { SITE as SITEMAP_SITE_URL, categoryPublicSlug };
