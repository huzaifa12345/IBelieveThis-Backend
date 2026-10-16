import express from 'express';
import StockController from '../controllers/StockController.js';

const router = express.Router();

// Get all stock
router.get('/', StockController.getAllStock);

// Get low stock items
router.get('/low-stock', StockController.getLowStock);

// Check stock availability
router.get('/check', StockController.checkStock);

// Update stock
router.put('/update', StockController.updateStock);

// Create new stock entry
router.post('/create', StockController.createStock);

export default router;
