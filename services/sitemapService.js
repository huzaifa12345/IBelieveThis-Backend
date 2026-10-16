import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Product, Category } from '../models/index.js';
import { productPathSlug, slugify } from '../utils/slugify.js';

const SITE = process.env.PUBLIC_SITE_URL || 'https://charlie-bells.com';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_SITEMAP_PATH = path.resolve(__dirname, '../../Frontend/public/sitemap.xml');

const xmlEscape = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const urlEntry = (loc, { priority = '0.7', changefreq = 'weekly', lastmod } = {}) => {
  const last = lastmod
    ? `\n    <lastmod>${new Date(lastmod).toISOString().slice(0, 10)}</lastmod>`
    : '';
  return `  <url>
    <loc>${xmlEscape(loc)}</loc>${last}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
};

/**
 * Build a fresh sitemap from the live products + categories tables.
 * New / updated / deleted products are reflected immediately — no manual edit.
 */
export async function buildSitemapXml() {
  const [products, categories] = await Promise.all([
    Product.findAll({ where: { is_active: true }, order: [['updated_at', 'DESC']] }),
    Category.findAll({ order: [['id', 'ASC']] }),
  ]);

  const staticPages = [
    urlEntry(`${SITE}/`, { priority: '1.0', changefreq: 'daily' }),
    urlEntry(`${SITE}/all-products`, { priority: '0.9', changefreq: 'daily' }),
    urlEntry(`${SITE}/about`, { priority: '0.6', changefreq: 'monthly' }),
  ];

  const categoryPages = categories.map((cat) => {
    const slug = cat.slug || slugify(cat.name) || cat.id;
    return urlEntry(`${SITE}/category/${slug}`, {
      priority: '0.8',
      changefreq: 'weekly',
      lastmod: cat.updated_at,
    });
  });

  const productPages = products.map((product) =>
    urlEntry(`${SITE}/product/${productPathSlug(product)}`, {
      priority: '0.9',
      changefreq: 'weekly',
      lastmod: product.updated_at,
    })
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticPages, ...categoryPages, ...productPages].join('\n')}
</urlset>
`;
}

/**
 * Optional local file mirror (disabled by default).
 * Live sitemap is served from GET /sitemap.xml — do not rely on a static file,
 * or Vercel would serve a stale public/sitemap.xml instead of the API.
 */
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

/**
 * Rebuild sitemap XML from DB. Safe to fire-and-forget after product changes.
 */
export async function refreshSitemap() {
  const xml = await buildSitemapXml();
  await writeSitemapFile(xml);
  const productCount = (xml.match(/\/product\//g) || []).length;
  console.log(`🗺️ Sitemap refreshed (${productCount} product URLs)`);
  return xml;
}

/** Non-blocking helper for controllers */
export function refreshSitemapAsync() {
  refreshSitemap().catch((error) => {
    console.warn('Sitemap refresh failed:', error.message);
  });
}
