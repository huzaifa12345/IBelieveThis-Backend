/**
 * SEO-friendly slug from a product/category name.
 * "Boogie Men Bell" → "boogie-men-bell"
 */
export function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 120) || 'product';
}

export function productSlugBase(product) {
  return slugify(product?.name || `product-${product?.id || ''}`);
}

/**
 * Canonical public path segment. Prefer stored slug; fall back to name-id.
 */
export function productPathSlug(product) {
  if (product?.slug) return product.slug;
  const base = productSlugBase(product);
  return product?.id ? `${base}-${product.id}` : base;
}
