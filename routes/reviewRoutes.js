import express from 'express';
import {
  createReview,
  adminCreateReview,
  getProductReviews,
  getAllReviews,
  updateReviewStatus,
  deleteReview
} from '../controllers/reviewController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/', createReview);
router.get('/product/:productId', getProductReviews);

// Admin routes
router.get('/admin/all', authenticateToken, requireAdmin, getAllReviews);
router.post('/admin', authenticateToken, requireAdmin, adminCreateReview);
router.put('/admin/:id/status', authenticateToken, requireAdmin, updateReviewStatus);
router.delete('/admin/:id', authenticateToken, requireAdmin, deleteReview);

export default router;
