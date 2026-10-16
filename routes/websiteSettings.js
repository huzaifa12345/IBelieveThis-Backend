import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  getWebsiteSettings, 
  getSettingByKey, 
  updateWebsiteSetting, 
  initializeSettings 
} from '../controllers/WebsiteSettingController.js';
import { upload } from '../config/cloudinary.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for file uploads
// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, path.join(__dirname, '../uploads/website'));
//   },
//   filename: function (req, file, cb) {
//     cb(null, Date.now() + '-' + file.originalname);
//   }
// });

// const upload = multer({ 
//   storage: storage,
//   limits: {
//     fileSize: 5 * 1024 * 1024 // 5MB limit
//   },
//   fileFilter: function (req, file, cb) {
//     // Accept images only
//     if (file.mimetype.startsWith('image/')) {
//       cb(null, true);
//     } else {
//       cb(new Error('Only image files are allowed'));
//     }
//   }
// });

// Get all website settings
router.get('/', getWebsiteSettings);

// Get specific setting by key
router.get('/:key', getSettingByKey);

// Update setting with file upload
router.put('/:id', upload.single('image'), updateWebsiteSetting);

// Initialize default settings
router.post('/initialize', initializeSettings);

export default router;
