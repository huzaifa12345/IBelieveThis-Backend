import express from 'express';
import {
  getShippingSettings,
  saveShippingSettings,
  seedShippingSettings,
} from '../controllers/ShippingSettingsController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public — cart & checkout need live rates
router.get('/', getShippingSettings);

// Admin only
router.put('/', authenticateToken, requireAdmin, saveShippingSettings);
router.post('/seed', authenticateToken, requireAdmin, seedShippingSettings);

export default router;
