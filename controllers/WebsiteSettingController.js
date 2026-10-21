import WebsiteSetting from '../models/WebsiteSetting.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { cloudinary } from '../config/cloudinary.js';
import {
  BRAND_DEFAULT_SETTINGS,
  ensureBrandSettings,
} from '../services/websiteBrandSettingsService.js';
import {
  getCachedWebsiteSettingsGrouped,
  invalidateWebsiteSettingsCache,
} from '../services/websiteSettingsCache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



export const updateWebsiteSetting = async (req, res) => {
  try {
    const { id } = req.params;
    const value = req.body ? req.body.value : undefined;

    console.log('=== UPDATE WEBSITE SETTING DEBUG (CLOUDINARY) ===');
    
    const setting = await WebsiteSetting.findByPk(id);
    if (!setting) {
      return res.status(404).json({ success: false, error: 'Setting not found' });
    }

    let finalValue = value;

    // Handle file upload
    if (setting.type === 'image' && req.file) {
      console.log('File detected on Cloudinary:', req.file.path);
      
      // Cloudinary/Multer-Storage-Cloudinary automatically file upload kar deta hai
      // req.file.path mein ab local path nahi balki "https://res.cloudinary.com/..." hota hai
      finalValue = req.file.path; 
      
      // NOTE: Ab aapko fs.copyFileSync aur fs.unlinkSync ki zaroorat nahi hai
      // Kyunke file ab server par hai hi nahi, Cloudinary par hai.
    }

    console.log('Updating setting with value:', finalValue);
    await setting.update({ value: finalValue });
    invalidateWebsiteSettingsCache();

    res.json({
      success: true,
      data: await setting.reload()
    });
  } catch (error) {
    console.error('Error updating website setting:', error);
    res.status(500).json({ success: false, error: 'Failed to update setting' });
  }
};
// Update website setting
// export const updateWebsiteSetting = async (req, res) => {
//   try {
//     const { id } = req.params;
    
//     // For multer multipart/form-data, the value field is in req.body
//     const value = req.body ? req.body.value : undefined;

//     console.log('=== UPDATE WEBSITE SETTING DEBUG ===');
//     console.log('Setting ID:', id);
//     console.log('Request body:', req.body);
//     console.log('Request file:', req.file);
//     console.log('Request headers:', req.headers);
//     console.log('Extracted value:', value);

//     const setting = await WebsiteSetting.findByPk(id);
//     if (!setting) {
//       console.log('Setting not found for ID:', id);
//       return res.status(404).json({
//         success: false,
//         error: 'Setting not found'
//       });
//     }

//     // Handle file upload for image settings
//     let finalValue = value;
//     if (setting.type === 'image' && req.file) {
//       console.log('File upload detected');
//       console.log('File details:', {
//         originalname: req.file.originalname,
//         filename: req.file.filename,
//         path: req.file.path,
//         mimetype: req.file.mimetype,
//         size: req.file.size
//       });
      
//       // Copy file to frontend assets/images folder
//       const frontendAssetsPath = path.join(__dirname, '../../Frontend/src/assets/images');
//       const frontendImagePath = path.join(frontendAssetsPath, req.file.filename);
      
//       // Create frontend assets directory if it doesn't exist
//       if (!fs.existsSync(frontendAssetsPath)) {
//         fs.mkdirSync(frontendAssetsPath, { recursive: true });
//       }
      
//       // Copy file from backend temp to frontend assets
//       fs.copyFileSync(req.file.path, frontendImagePath);
      
//       // Save path relative to frontend
//       finalValue = `/src/assets/images/${req.file.filename}`;
//       console.log('Final file path:', finalValue);
      
//       // Clean up temp file
//       fs.unlinkSync(req.file.path);
//     } else {
//       console.log('No file upload detected, using text value:', value);
//     }

//     console.log('Updating setting with value:', finalValue);
//     await setting.update({ value: finalValue });

//     console.log('Setting updated successfully');
//     res.json({
//       success: true,
//       data: await setting.reload()
//     });
//   } catch (error) {
//     console.error('Error updating website setting:', error);
//     console.error('Error stack:', error.stack);
//     res.status(500).json({
//       success: false,
//       error: 'Failed to update setting'
//     });
//   }
// };

// Get all website settings (in-memory cache 5 min; invalidated on admin save)
export const getWebsiteSettings = async (req, res) => {
  try {
    const groupedSettings = await getCachedWebsiteSettingsGrouped();
    res.set('Cache-Control', 'public, max-age=300');
    res.json({
      success: true,
      data: groupedSettings
    });
  } catch (error) {
    console.error('Error fetching website settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch website settings'
    });
  }
};


// Get specific setting by key
export const getSettingByKey = async (req, res) => {
  try {
    const { key } = req.params;
    const setting = await WebsiteSetting.findOne({
      where: { key, is_active: true }
    });

    if (!setting) {
      return res.status(404).json({
        success: false,
        error: 'Setting not found'
      });
    }

    res.json({
      success: true,
      data: setting
    });
  } catch (error) {
    console.error('Error fetching setting:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch setting'
    });
  }
};

// Initialize default settings (logo + hero). Safe to call anytime — findOrCreate only.
export const initializeSettings = async (req, res) => {
  try {
    await ensureBrandSettings();
    invalidateWebsiteSettingsCache();

    res.json({
      success: true,
      message: 'Default logo & hero settings initialized successfully',
      keys: BRAND_DEFAULT_SETTINGS.map((s) => s.key),
    });
  } catch (error) {
    console.error('Error initializing settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize settings'
    });
  }
};

// export {
//   getWebsiteSettings,
//   updateWebsiteSetting,
//   getSettingByKey,
//   initializeSettings,
// }