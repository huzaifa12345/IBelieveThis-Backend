import { buildSitemapXml, refreshSitemap } from '../services/sitemapService.js';

/**
 * Live sitemap — always generated from the database.
 * Google / Bing hit this URL; new products appear automatically.
 */
export const getSitemap = async (_req, res) => {
  try {
    const xml = await buildSitemapXml();
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=300'); // 5 min CDN/browser cache
    res.send(xml);
  } catch (error) {
    console.error('Sitemap error:', error);
    res.status(500).type('text/plain').send('Unable to generate sitemap');
  }
};

/** Optional admin/manual trigger */
export const rebuildSitemap = async (_req, res) => {
  try {
    const xml = await refreshSitemap();
    res.json({
      message: 'Sitemap rebuilt from live catalog',
      bytes: Buffer.byteLength(xml, 'utf8'),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
