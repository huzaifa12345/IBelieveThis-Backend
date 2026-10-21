/**
 * Optional Vercel deploy hook — regenerates prerendered HTML after catalog changes.
 * Set VERCEL_DEPLOY_HOOK to the Deploy Hook URL from Vercel project settings.
 */
export function triggerFrontendRebuildAsync(reason = 'catalog-change') {
  const hook = process.env.VERCEL_DEPLOY_HOOK;
  if (!hook) return;

  fetch(hook, { method: 'POST' })
    .then((res) => {
      console.log(`🚀 Vercel rebuild triggered (${reason}): ${res.status}`);
    })
    .catch((err) => {
      console.warn('Vercel deploy hook failed:', err.message);
    });
}
