import {
  getShippingConfig,
  updateShippingConfig,
  ensureShippingSettings,
} from '../services/shippingSettingsService.js';

export const getShippingSettings = async (_req, res) => {
  try {
    const shipping = await getShippingConfig();
    res.json({ shipping });
  } catch (error) {
    console.error('Get shipping settings error:', error);
    res.status(500).json({ error: error.message || 'Unable to load shipping settings' });
  }
};

export const saveShippingSettings = async (req, res) => {
  try {
    const { standard_cost, free_threshold, label, tax_rate_percent } = req.body;
    if (standard_cost === undefined || free_threshold === undefined) {
      return res.status(400).json({ error: 'standard_cost and free_threshold are required' });
    }
    if (tax_rate_percent === undefined || tax_rate_percent === null || tax_rate_percent === '') {
      return res.status(400).json({ error: 'tax_rate_percent is required (e.g. 8.3 for 8.3%)' });
    }

    const shipping = await updateShippingConfig({
      standard_cost,
      free_threshold,
      label,
      tax_rate_percent,
    });

    res.json({
      message: 'Shipping & tax settings updated',
      shipping,
    });
  } catch (error) {
    console.error('Save shipping settings error:', error);
    res.status(400).json({ error: error.message || 'Unable to save shipping settings' });
  }
};

export const seedShippingSettings = async (_req, res) => {
  try {
    await ensureShippingSettings();
    const shipping = await getShippingConfig();
    res.json({ message: 'Shipping settings ready', shipping });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
