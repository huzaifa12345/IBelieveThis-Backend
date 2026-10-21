import WebsiteSetting from '../models/WebsiteSetting.js';
import { ensureBrandSettings } from './websiteBrandSettingsService.js';

const TTL_MS = 5 * 60 * 1000; // 5 minutes

let cache = null;
let cacheAt = 0;

export function invalidateWebsiteSettingsCache() {
  cache = null;
  cacheAt = 0;
}

/** Grouped active settings (logo/hero/contact/…). Cached in-memory. */
export async function getCachedWebsiteSettingsGrouped() {
  const now = Date.now();
  if (cache && now - cacheAt < TTL_MS) {
    return cache;
  }

  const brandCount = await WebsiteSetting.count({
    where: { category: ['logo', 'hero'], is_active: true },
  });
  if (brandCount === 0) {
    await ensureBrandSettings();
  }

  const settings = await WebsiteSetting.findAll({
    where: { is_active: true },
    order: [
      ['category', 'ASC'],
      ['sort_order', 'ASC'],
    ],
  });

  const groupedSettings = {};
  settings.forEach((setting) => {
    if (!groupedSettings[setting.category]) {
      groupedSettings[setting.category] = [];
    }
    groupedSettings[setting.category].push(setting);
  });

  cache = groupedSettings;
  cacheAt = now;
  return cache;
}

/** Flat key → value map (useful for prerender / bootstrap). */
export async function getCachedSettingMap(keys = []) {
  const grouped = await getCachedWebsiteSettingsGrouped();
  const flat = {};
  Object.values(grouped).forEach((list) => {
    if (!Array.isArray(list)) return;
    list.forEach((s) => {
      if (s?.key) flat[s.key] = s.value ?? '';
    });
  });
  if (!keys.length) return flat;
  const out = {};
  keys.forEach((k) => {
    out[k] = flat[k] ?? '';
  });
  return out;
}
