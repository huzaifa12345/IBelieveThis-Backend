import WebsiteSetting from '../models/WebsiteSetting.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { cloudinary } from '../config/cloudinary.js';

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

// Get all website settings
export const getWebsiteSettings = async (req, res) => {
  try {
    const settings = await WebsiteSetting.findAll({
      where: { is_active: true },
      order: [['category', 'ASC'], ['sort_order', 'ASC']]
    });

    // Group settings by category
    const groupedSettings = {};
    settings.forEach(setting => {
      if (!groupedSettings[setting.category]) {
        groupedSettings[setting.category] = [];
      }
      groupedSettings[setting.category].push(setting);
    });

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

// Initialize default settings
export const initializeSettings = async (req, res) => {
  try {
    const defaultSettings = [
      // Logo settings
      {
        key: 'website_logo',
        value: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQwIiBoZWlnaHQ9IjgwIiB2aWV3Qm94PSIwIDAgMjQwIDgwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cmVjdCB3aWR0aD0iMjQwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjZjNmNGY2Ii8+Cjx0ZXh0IHg9IjEyMCIgeT0iNDAiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzMzMzMzMyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkxvZ288L3RleHQ+Cjwvc3ZnPg==',
        type: 'image',
        description: 'Website main logo',
        category: 'logo',
        sort_order: 1
      },
      // Hero slider settings
      {
        key: 'hero_slide_1',
        value: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYwMCIgaGVpZ2h0PSI2MDAiIHZpZXdCb3g9IjAgMCAxNjAwIDYwMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjE2MDAiIGhlaWdodD0iNjAwIiBmaWxsPSIjZGRkIi8+Cjx0ZXh0IHg9IjgwMCIgeT0iMzAwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iNDAiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2ZWtIj5IZXJvIFNsaWRlIDE8L3RleHQ+Cjx0ZXh0IHg9IjgwMCIgeT0iMzQwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2ZWtIj5Db21lIFNob3AgTm93ITwvdGV4dD4KPHN2Zz4=',
        type: 'image',
        description: 'Hero slider image 1',
        category: 'hero',
        sort_order: 1
      },
      {
        key: 'hero_slide_2',
        value: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYwMCIgaGVpZ2h0PSI2MDAiIHZpZXdCb3g9IjAgMCAxNjAwIDYwMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjE2MDAiIGhlaWdodD0iNjAwIiBmaWxsPSIjZGRkIi8+Cjx0ZXh0IHg9IjgwMCIgeT0iMzAwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iNDAiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2ZWtIj5IZXJvIFNsaWRlIDI8L3RleHQ+Cjx0ZXh0IHg9IjgwMCIgeT0iMzQwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2ZWtIj5EZWFscyAmIE9mZmVJzITwvdGV4dD4KPHN2Zz4=',
        type: 'image',
        description: 'Hero slider image 2',
        category: 'hero',
        sort_order: 2
      },
      {
        key: 'hero_slide_3',
        value: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYwMCIgaGVpZ2h0PSI2MDAiIHZpZXdCb3g9IjAgMCAxNjAwIDYwMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjE2MDAiIGhlaWdodD0iNjAwIiBmaWxsPSIjZGRkIi8+Cjx0ZXh0IHg9IjgwMCIgeT0iMzAwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iNDAiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2ZWtIj5IZXJvIFNsaWRlIDM8L3RleHQ+Cjx0ZXh0IHg9IjgwMCIgeT0iMzQwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2ZWtIj5OZXcgQXJyaXZhbHMhPC90ZXh0Pgo8L3N2Zz4=',
        type: 'image',
        description: 'Hero slider image 3',
        category: 'hero',
        sort_order: 3
      },
      {
        key: 'hero_slide_4',
        value: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYwMCIgaGVpZ2h0PSI2MDAiIHZpZXdCb3g9IjAgMCAxNjAwIDYwMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjE2MDAiIGhlaWdodD0iNjAwIiBmaWxsPSIjZGRkIi8+Cjx0ZXh0IHg9IjgwMCIgeT0iMzAwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iNDAiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2ZWtIj5IZXJvIFNsaWRlIDQ8L3RleHQ+Cjx0ZXh0IHg9IjgwMCIgeT0iMzQwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2ZWtIj5TcGVjaWFsIE9mZmVycyE8L3RleHQ+Cjwvc3ZnPg==',
        type: 'image',
        description: 'Hero slider image 4',
        category: 'hero',
        sort_order: 4
      },
      // Hero text settings
      {
        key: 'hero_title_1',
        value: 'Welcome to Kids Colours',
        type: 'text',
        description: 'Hero slide 1 title',
        category: 'hero',
        sort_order: 5
      },
      {
        key: 'hero_description_1',
        value: 'Discover amazing products with unbeatable prices and quality',
        type: 'text',
        description: 'Hero slide 1 description',
        category: 'hero',
        sort_order: 6
      },
      {
        key: 'hero_title_2',
        value: 'Trendy Fashion for Kids',
        type: 'text',
        description: 'Hero slide 2 title',
        category: 'hero',
        sort_order: 7
      },
      {
        key: 'hero_description_2',
        value: 'Explore our latest collection of stylish kids\' clothing',
        type: 'text',
        description: 'Hero slide 2 description',
        category: 'hero',
        sort_order: 8
      },
      {
        key: 'hero_title_3',
        value: 'Fun Toys & Games',
        type: 'text',
        description: 'Hero slide 3 title',
        category: 'hero',
        sort_order: 9
      },
      {
        key: 'hero_description_3',
        value: 'Educational and entertaining toys for your little ones',
        type: 'text',
        description: 'Hero slide 3 description',
        category: 'hero',
        sort_order: 10
      },
      {
        key: 'hero_title_4',
        value: 'Comfortable Kids Shoes',
        type: 'text',
        description: 'Hero slide 4 title',
        category: 'hero',
        sort_order: 11
      },
      {
        key: 'hero_description_4',
        value: 'Stylish and comfortable footwear for active kids',
        type: 'text',
        description: 'Hero slide 4 description',
        category: 'hero',
        sort_order: 12
      }
    ];

    for (const setting of defaultSettings) {
      const [existingSetting] = await WebsiteSetting.findOrCreate({
        where: { key: setting.key },
        defaults: setting
      });
    }

    res.json({
      success: true,
      message: 'Default settings initialized successfully'
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