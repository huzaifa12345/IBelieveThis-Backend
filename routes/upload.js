import express from 'express';
import upload from '../middleware/upload.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { v2 as cloudinary } from 'cloudinary';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Cloudinary for payment screenshots
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Cloudinary storage for payment screenshots
const paymentStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'ecommerce_payments',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    public_id: (req, file) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      return `payment-${uniqueSuffix}`;
    }
  },
});

const paymentUpload = multer({
  storage: paymentStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

const router = express.Router();

// Upload multiple images for a product
router.post('/upload-images', 
  authenticateToken, 
  requireAdmin, 
  upload.array('images', 4), 
  (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      // Generate Cloudinary URLs
      const imageUrls = req.files.map(file => {
        // Cloudinary automatically provides the URL in req.file.path
        return file.path; // This is now the Cloudinary URL
      });

      console.log('Product images uploaded to Cloudinary:', imageUrls);

      res.json({
        message: 'Images uploaded successfully',
        images: imageUrls
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Failed to upload images' });
    }
  }
);

// Upload payment screenshot (public endpoint - no auth required)
router.post('/payment-screenshot', paymentUpload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Return the Cloudinary URL
    const imageUrl = req.file.path; // This is now the Cloudinary URL
    
    console.log('Payment screenshot uploaded to Cloudinary:', imageUrl);
    
    res.status(200).json({
      message: 'File uploaded successfully',
      imageUrl: imageUrl
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Handle multer errors
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large. Maximum size is 5MB.' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files. Maximum is 4 files.' });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Unexpected file field.' });
    }
  }
  
  if (error.message === 'Only image files are allowed!') {
    return res.status(400).json({ error: 'Only image files are allowed!' });
  }
  
  res.status(500).json({ error: 'File upload error' });
});

export default router;
