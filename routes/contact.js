import express from 'express';
import {
  submitContact,
  listContactMessages,
  updateContactStatus,
} from '../controllers/ContactController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.post('/', submitContact);
router.get('/', authenticateToken, requireAdmin, listContactMessages);
router.patch('/:id', authenticateToken, requireAdmin, updateContactStatus);

export default router;
