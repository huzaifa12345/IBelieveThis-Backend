import express from 'express';
import {
  getAllProducts,
  getProductById,
  getProductsByCategory,
  createProduct,
  // createSingleSizeProduct,
  // createAllSizeProduct,
  updateProduct,
  deleteProduct,
  searchProducts,
  generateNextSKU,
  cleanupProblematicProducts
} from '../controllers/ProductController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/', getAllProducts);
router.get('/search', searchProducts);
router.get('/next-sku', generateNextSKU);
router.get('/category/:category', getProductsByCategory);
router.get('/:id', getProductById);

// Admin routes
router.post('/', authenticateToken, requireAdmin, createProduct);
// router.post('/single-size', authenticateToken, requireAdmin, createSingleSizeProduct);
// router.post('/all-sizes', authenticateToken, requireAdmin, createAllSizeProduct);
router.put('/:id', authenticateToken, requireAdmin, updateProduct);
router.delete('/:id', authenticateToken, requireAdmin, deleteProduct);

// Temporary cleanup endpoint for problematic products
router.delete('/cleanup-problematic', authenticateToken, requireAdmin, cleanupProblematicProducts);

export default router;
