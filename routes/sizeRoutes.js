import express from 'express';
import { getSizes, createSize, updateSize, deleteSize } from '../controllers/sizeController.js';

const router = express.Router();

// GET /api/sizes - Get all sizes
router.get('/', getSizes);

// POST /api/sizes - Create new size
router.post('/', createSize);

// PUT /api/sizes/:id - Update size
router.put('/:id', updateSize);

// DELETE /api/sizes/:id - Delete size
router.delete('/:id', deleteSize);

export default router;
