import express from 'express';
import {
  createReview,
  getProductReviews,
  getAllReviews,
  updateReviewStatus,
  deleteReview
} from '../controllers/reviewController.js';

const router = express.Router();

// Public routes
router.post('/', createReview);
router.get('/product/:productId', getProductReviews);

// Admin routes (add authentication middleware later)
router.get('/admin/all', getAllReviews);
router.put('/admin/:id/status', updateReviewStatus);
router.delete('/admin/:id', deleteReview);

export default router;
