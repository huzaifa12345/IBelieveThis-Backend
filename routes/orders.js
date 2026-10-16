import express from 'express';
import {
  createOrder,
  getUserOrders,
  getOrderById,
  updateOrderStatus,
  getAllOrders,
  getOrdersReport,
  cancelOrder,
  retryFailedEmails,
  getFailedEmails,
  retrySingleEmail
} from '../controllers/OrderController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Orders require a logged-in customer so user_id is always set (NOT NULL on live DB).
// Keep /guest alias for older clients — same auth + same handler.
router.post('/guest', authenticateToken, createOrder);
router.post('/', authenticateToken, createOrder);
router.get('/my-orders', authenticateToken, getUserOrders);

// Static admin paths MUST be registered before /:id or Express treats them as IDs
router.get('/report', authenticateToken, requireAdmin, getOrdersReport);
router.get('/failed-emails', authenticateToken, requireAdmin, getFailedEmails);
router.post('/retry-emails', authenticateToken, requireAdmin, retryFailedEmails);
router.post('/retry-email/:emailId', authenticateToken, requireAdmin, retrySingleEmail);

// Admin list
router.get('/', authenticateToken, requireAdmin, getAllOrders);

// Param routes last
router.get('/:id', authenticateToken, getOrderById);
router.put('/:id/cancel', authenticateToken, cancelOrder);
router.put('/:id/status', authenticateToken, requireAdmin, updateOrderStatus);

export default router;
