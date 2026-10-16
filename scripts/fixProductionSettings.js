import WebsiteSetting from '../models/WebsiteSetting.js';

const updateSettingsForProduction = async () => {
  try {
    console.log('Updating website settings for production...');

    // Update logo setting
    const logoSetting = await WebsiteSetting.findOne({ where: { key: 'website_logo' } });
    if (logoSetting) {
      await logoSetting.update({
        value: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQwIiBoZWlnaHQ9IjgwIiB2aWV3Qm94PSIwIDAgMjQwIDgwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cmVjdCB3aWR0aD0iMjQwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjZjNmNGY2Ii8+Cjx0ZXh0IHg9IjEyMCIgeT0iNDAiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzMzMzMzMyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkxvZ288L3RleHQ+Cjwvc3ZnPg=='
      });
      console.log('Logo setting updated');
    }

    // Update hero slide settings
    const heroSlides = ['hero_slide_1', 'hero_slide_2', 'hero_slide_3', 'hero_slide_4'];
    for (let i = 0; i < heroSlides.length; i++) {
      const slideSetting = await WebsiteSetting.findOne({ where: { key: heroSlides[i] } });
      if (slideSetting) {
        await slideSetting.update({
          value: `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYwMCIgaGVpZ2h0PSI2MDAiIHZpZXdCb3g9IjAgMCAxNjAwIDYwMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjE2MDAiIGhlaWdodD0iNjAwIiBmaWxsPSIjZGRkIi8+Cjx0ZXh0IHg9IjgwMCIgeT0iMzAwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iNDAiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5IZXJvIFNsaWRlICQ7aSsxfTwvdGV4dD4KPHRleHQgeD0iODAwIiB5PSIzNDAiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkNvbWUgU2hvcCBOb3chPC90ZXh0Pgo8L3N2Zz4=`
        });
        console.log(`Hero slide ${i + 1} updated`);
      }
    }

    console.log('All settings updated successfully for production');
  } catch (error) {
    console.error('Error updating settings:', error);
  }
};

updateSettingsForProduction();