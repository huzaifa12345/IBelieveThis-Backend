import express from 'express';
import {
  createPaymentIntent,
  recordPaymentAttempt,
  getPaymentAudits,
} from '../controllers/PaymentController.js';
import { authenticateToken, requireSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

router.post('/create-intent', createPaymentIntent);
router.post('/attempts', recordPaymentAttempt);

// Audit trail is restricted to super admins
router.get('/audits', authenticateToken, requireSuperAdmin, getPaymentAudits);

export default router;
