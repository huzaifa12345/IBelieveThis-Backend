import { Product, Category, Size, Stock } from '../models/index.js';
import { Op } from 'sequelize';
import { refreshSitemapAsync } from '../services/sitemapService.js';

const getSortConfig = (sortByRaw = 'created_at', orderRaw = 'DESC') => {
  const sortBy = String(sortByRaw).toLowerCase();
  const order = String(orderRaw).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const map = {
    created_at: ['created_at', order],
    newest: ['created_at', 'DESC'],
    oldest: ['created_at', 'ASC'],
    price_low: ['price', 'ASC'],
    price_high: ['price', 'DESC'],
    name_asc: ['name', 'ASC'],
    name_desc: ['name', 'DESC'],
    price: ['price', order],
    name: ['name', order],
  };

  return map[sortBy] || ['created_at', 'DESC'];
};

// Generate next SKU
const generateNextSKU = async (req, res) => {
  try {
    console.log('[SKU_GENERATION] Starting SKU generation...');
    
    const lastProduct = await Product.findOne({
      where: { is_active: true }, // Only count active products
      order: [['sku', 'DESC']],
      attributes: ['sku']
    });
    
    console.log('[SKU_GENERATION] Last active product found:', lastProduct ? { id: lastProduct.id, sku: lastProduct.sku, skuType: typeof lastProduct.sku } : 'None');
    
    let nextSku;
    if (lastProduct && lastProduct.sku) {
      const lastSkuStr = String(lastProduct.sku).trim();
      console.log('[SKU_GENERATION] Last SKU as string:', lastSkuStr);
      
      const lastNumber = parseInt(lastSkuStr);
      console.log('[SKU_GENERATION] Last SKU parsed as number:', lastNumber, 'isNaN:', isNaN(lastNumber));
      
      if (isNaN(lastNumber)) {
        console.log('[SKU_GENERATION] Last SKU is not a number, starting from 001');
        nextSku = '001';
      } else {
        const nextNumber = lastNumber + 1;
        nextSku = nextNumber.toString().padStart(3, '0');
        console.log('[SKU_GENERATION] Next number:', nextNumber, 'Next SKU:', nextSku);
      }
    } else {
      console.log('[SKU_GENERATION] No previous SKU found, starting from 001');
      nextSku = '001';
    }
    
    console.log(`[SKU_GENERATION] Final Next SKU: ${nextSku}`);
    
    res.json({ sku: nextSku });
  } catch (error) {
    console.error('[SKU_GENERATION] Error generating SKU:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get all products with optional filtering
const getAllProducts = async (req, res) => {
  try {
    console.log('INFO [PRODUCTS/GET_ALL]: Starting products fetch');
    const {
      page = 1,
      limit = 20,
      category_id,
      category,
      search,
      min_price: minPriceSnake,
      max_price: maxPriceSnake,
      minPrice: minPriceCamel,
      maxPrice: maxPriceCamel,
      sort_by: sortBySnake,
      sortBy: sortByCamel,
      order = 'DESC'
    } = req.query;

    const minPrice = minPriceSnake ?? minPriceCamel;
    const maxPrice = maxPriceSnake ?? maxPriceCamel;
    const sortBy = sortBySnake ?? sortByCamel ?? 'created_at';
    const [sortField, sortOrder] = getSortConfig(sortBy, order);

    console.log('INFO [PRODUCTS/GET_ALL]: Query params:', { page, limit, category_id, category, search, minPrice, maxPrice, sortBy, order });

    const where = { is_active: true };
    
    // Filter by category
    if (category_id) {
      where.category_id = category_id;
    }
    
    if (category) {
      where.category = category;
    }
    
    // Search functionality
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
        { brand: { [Op.iLike]: `%${search}%` } }
      ];
    }
    
    // Price range filter
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price[Op.gte] = minPrice;
      if (maxPrice) where.price[Op.lte] = maxPrice;
    }

    const offset = (page - 1) * limit;

    console.log('INFO [PRODUCTS/GET_ALL]: Querying database');
    const { count, rows: products } = await Product.findAndCountAll({
      where,
      include: [{
        model: Category,
        as: 'category_relation',
        attributes: ['id', 'name']
      }],
      limit: parseInt(limit),
      offset,
      order: [[sortField, sortOrder]],
    });

    console.log('INFO [PRODUCTS/GET_ALL]: Found', count, 'products');
    res.json({
      products,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('ERROR AT [PRODUCTS/GET_ALL]:', error);
    console.error('ERROR AT [PRODUCTS/GET_ALL]: Stack:', error.stack);
    res.status(500).json({ 
      message: error.message, 
      stack: error.stack,
      error: 'Failed to fetch products'
    });
  }
};

const productDetailInclude = [{
  model: Category,
  as: 'category_relation',
  attributes: ['id', 'name']
}];

// Get product by SEO slug, barcode, or numeric id (in that order)
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const param = decodeURIComponent(String(id || '')).trim();

    let product = await Product.findOne({
      where: { slug: param, is_active: true },
      include: productDetailInclude,
    });

    if (!product) {
      product = await Product.findOne({
        where: { barcode: param, is_active: true },
        include: productDetailInclude,
      });
    }

    if (!product) {
      const numericId = parseInt(param, 10);
      if (!isNaN(numericId) && String(numericId) === param) {
        product = await Product.findOne({
          where: { id: numericId, is_active: true },
          include: productDetailInclude,
        });
      }
    }

    // Legacy fallback: name-id style URLs before slug column existed
    if (!product && /-\d+$/.test(param)) {
      const maybeId = Number(param.split('-').pop());
      if (Number.isFinite(maybeId)) {
        product = await Product.findOne({
          where: { id: maybeId, is_active: true },
          include: productDetailInclude,
        });
      }
    }

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get products by category
const getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const {
      page = 1,
      limit = 20,
      search,
      min_price: minPriceSnake,
      max_price: maxPriceSnake,
      minPrice: minPriceCamel,
      maxPrice: maxPriceCamel,
      sort_by: sortBySnake,
      sortBy: sortByCamel,
      order = 'DESC',
    } = req.query;
    const minPrice = minPriceSnake ?? minPriceCamel;
    const maxPrice = maxPriceSnake ?? maxPriceCamel;
    const sortBy = sortBySnake ?? sortByCamel ?? 'created_at';
    const [sortField, sortOrder] = getSortConfig(sortBy, order);
    
    console.log(`[DEBUG] Getting products for category: ${category}`);
    
    const offset = (page - 1) * limit;

    // Try to parse category as ID first, if it fails, search by category name
    const categoryId = parseInt(category);
    const isNumeric = !isNaN(categoryId);

    console.log(`[DEBUG] Parsed categoryId: ${categoryId}, isNumeric: ${isNumeric}`);

    const whereCondition = {
      is_active: true
    };

    if (isNumeric) {
      // If category is a number, filter by category_id
      whereCondition.category_id = categoryId;
      console.log(`[DEBUG] Filtering by category_id: ${categoryId}`);
    } else {
      // Otherwise, filter by category name
      whereCondition.category = category;
      console.log(`[DEBUG] Filtering by category name: ${category}`);
    }

    if (search) {
      whereCondition[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
        { brand: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (minPrice || maxPrice) {
      whereCondition.price = {};
      if (minPrice) whereCondition.price[Op.gte] = minPrice;
      if (maxPrice) whereCondition.price[Op.lte] = maxPrice;
    }

    console.log(`[DEBUG] whereCondition:`, whereCondition);

    const { count, rows: products } = await Product.findAndCountAll({
      where: whereCondition,
      include: [{
        model: Category,
        as: 'category_relation',
        attributes: ['id', 'name']
      }],
      limit: parseInt(limit),
      offset,
      order: [[sortField, sortOrder]]
    });

    console.log(`[DEBUG] Found ${count} products`);
    console.log(`[DEBUG] Products:`, products.map(p => ({ id: p.id, name: p.name, category_id: p.category_id })));

    res.json({
      products,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error(`[DEBUG] Error in getProductsByCategory:`, error);
    res.status(500).json({ error: error.message });
  }
};

// Create new product (Admin only)
// const createSingleSizeProduct = async (req, res) => {
//     try {
//       console.log('INFO [PRODUCTS/CREATE-SINGLE-SIZE]: Starting single size product creation');
      
//       // Extract and validate required fields
//       const { name, description, price, stock_quantity, category_id, image_url, images, sizes, brand, category } = req.body;
      
//       console.log('INFO [PRODUCTS/CREATE-SINGLE-SIZE]: Form data received:', { 
//         name, 
//         price, 
//         stock_quantity, 
//         sizes: sizes || 'undefined',
//         sizes_length: sizes ? sizes.length : 0
//       });
      
//       // Validate required fields
//       if (!name || !price || stock_quantity === null || stock_quantity === undefined) {
//         return res.status(400).json({ 
//           error: 'Missing required fields: name, price, stock_quantity' 
//         });
//       }

//       if (!sizes || sizes.length === 0) {
//         return res.status(400).json({ 
//           error: 'At least one size must be selected for single size product' 
//         });
//       }

//       // Generate auto-increment SKU (001, 002, 003...)
//       let nextSku = '001';
//       const lastProduct = await Product.findOne({
//         order: [['sku', 'DESC']]
//       });
//       if (lastProduct && lastProduct.sku) {
//         const lastSku = parseInt(lastProduct.sku, 10);
//         if (!isNaN(lastSku)) {
//           nextSku = String(lastSku + 1).padStart(3, '0');
//         }
//       }
//       console.log('INFO [PRODUCTS/CREATE-SINGLE-SIZE]: Generated SKU:', nextSku);

//       const productData = {
//         name: name.trim(),
//         description: description || '',
//         price: parseFloat(price),
//         stock_quantity: parseInt(stock_quantity),
//         category_id: category_id || null,
//         image_url: image_url || '',
//         images: images || [],
//         sizes: sizes || [],
//         brand: brand || null,
//         category: category || null,
//         sku: nextSku
//       };

//       console.log('INFO [PRODUCTS/CREATE-SINGLE-SIZE]: Creating product in database');
//       const product = await Product.create(productData);
      
//       console.log('INFO [PRODUCTS/CREATE-SINGLE-SIZE]: Fetching created product with category');
//       const createdProduct = await Product.findByPk(product.id, {
//         include: [{
//           model: Category,
//           as: 'category_relation',
//           attributes: ['id', 'name']
//         }]
//       });

//       console.log('INFO [PRODUCTS/CREATE-SINGLE-SIZE]: Product created successfully with ID:', product.id);
      
//       // Create stock entries only for selected sizes
//       const stockPromises = [];
//       console.log('INFO [PRODUCTS/CREATE-SINGLE-SIZE]: Creating stock for selected sizes:', sizes);
      
//       // Get all sizes from database to map names to IDs
//       const allSizes = await Size.findAll();
//       const sizeMap = {};
//       allSizes.forEach(size => {
//         sizeMap[size.size] = size.id;
//       });
      
//       console.log('INFO [PRODUCTS/CREATE-SINGLE-SIZE]: Size mapping:', sizeMap);
      
//       for (const sizeItem of sizes) {
//         const sizeName = typeof sizeItem === 'string' ? sizeItem : sizeItem.size;
//         const sizeId = sizeMap[sizeName];
//         if (sizeId) {
//           stockPromises.push(
//             Stock.create({
//               product_id: product.id,
//               size_id: parseInt(sizeId),
//               quantity: parseInt(stock_quantity) || 0,
//               reorder_level: 5
//             })
//           );
//           console.log(`INFO [PRODUCTS/CREATE-SINGLE-SIZE]: Adding stock for size ${sizeName} (ID: ${sizeId})`);
//         } else {
//           console.warn(`INFO [PRODUCTS/CREATE-SINGLE-SIZE]: Size not found in database: ${sizeName}`);
//         }
//       }
      
//       await Promise.all(stockPromises);
//       console.log(`INFO [PRODUCTS/CREATE-SINGLE-SIZE]: Stock entries created for ${stockPromises.length} selected sizes for product ${product.id}`);
    
//       res.status(201).json(createdProduct);
//     } catch (error) {
//       console.error('ERROR AT [PRODUCTS/CREATE-SINGLE-SIZE]:', error);
//       console.error('ERROR AT [PRODUCTS/CREATE-SINGLE-SIZE]: Stack:', error.stack);
//       res.status(400).json({ 
//         message: error.message, 
//         stack: error.stack,
//         error: 'Failed to create single size product'
//       });
//     }
//   }

//   const createAllSizeProduct = async (req, res) => {
//     try {
//       console.log('INFO [PRODUCTS/CREATE-ALL-SIZE]: Starting all size product creation');
      
//       // Extract and validate required fields
//       const { name, description, price, stock_quantity, category_id, image_url, images, brand, category } = req.body;
      
//       console.log('INFO [PRODUCTS/CREATE-ALL-SIZE]: Form data received:', { 
//         name, 
//         price, 
//         stock_quantity
//       });
      
//       // Validate required fields
//       if (!name || !price || stock_quantity === null || stock_quantity === undefined) {
//         return res.status(400).json({ 
//           error: 'Missing required fields: name, price, stock_quantity' 
//         });
//       }

//       // Generate auto-increment SKU (001, 002, 003...)
//       let nextSku = '001';
//       const lastProduct = await Product.findOne({
//         order: [['sku', 'DESC']]
//       });
//       if (lastProduct && lastProduct.sku) {
//         const lastSku = parseInt(lastProduct.sku, 10);
//         if (!isNaN(lastSku)) {
//           nextSku = String(lastSku + 1).padStart(3, '0');
//         }
//       }
//       console.log('INFO [PRODUCTS/CREATE-ALL-SIZE]: Generated SKU:', nextSku);

//       const productData = {
//         name: name.trim(),
//         description: description || '',
//         price: parseFloat(price),
//         stock_quantity: parseInt(stock_quantity),
//         category_id: category_id || null,
//         image_url: image_url || '',
//         images: images || [],
//         sizes: [], // Empty sizes array for all size products
//         brand: brand || null,
//         category: category || null,
//         sku: nextSku
//       };

//       console.log('INFO [PRODUCTS/CREATE-ALL-SIZE]: Creating product in database');
//       const product = await Product.create(productData);
      
//       console.log('INFO [PRODUCTS/CREATE-ALL-SIZE]: Fetching created product with category');
//       const createdProduct = await Product.findByPk(product.id, {
//         include: [{
//           model: Category,
//           as: 'category_relation',
//           attributes: ['id', 'name']
//         }]
//       });

//       console.log('INFO [PRODUCTS/CREATE-ALL-SIZE]: Product created successfully with ID:', product.id);
      
//       // Create stock entries for all available sizes
//       const stockPromises = [];
//       console.log('INFO [PRODUCTS/CREATE-ALL-SIZE]: Creating stock for all sizes');
      
//       const allSizes = await Size.findAll();
      
//       for (const size of allSizes) {
//         stockPromises.push(
//           Stock.create({
//             product_id: product.id,
//             size_id: size.id,
//             quantity: parseInt(stock_quantity) || 0,
//             reorder_level: 5
//           })
//         );
//       }
      
//       await Promise.all(stockPromises);
//       console.log(`INFO [PRODUCTS/CREATE-ALL-SIZE]: Stock entries created for all ${stockPromises.length} sizes for product ${product.id}`);
    
//       res.status(201).json(createdProduct);
//     } catch (error) {
//       console.error('ERROR AT [PRODUCTS/CREATE-ALL-SIZE]:', error);
//       console.error('ERROR AT [PRODUCTS/CREATE-ALL-SIZE]: Stack:', error.stack);
//       res.status(400).json({ 
//         message: error.message, 
//         stack: error.stack,
//         error: 'Failed to create all size product'
//       });
//     }
//   }

const createProduct = async (req, res) => {
  try {
    console.log('INFO [PRODUCTS/CREATE]: Starting product creation');
    
    // Extract and validate required fields
    const { name, description, price, discount_price, stock_quantity, category_id, image_url, images, brand, category, barcode } = req.body;
    
    console.log('INFO [PRODUCTS/CREATE]: Form data received:', { 
      name, 
      price, 
      stock_quantity,
      barcode
    });
    
    // Validate required fields
    if (!name || !price || stock_quantity === null || stock_quantity === undefined) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, price, stock_quantity' 
      });
    }

    // Check for duplicate barcode if provided
    if (barcode && barcode.trim()) {
      const existingBarcode = await Product.findOne({
        where: { barcode: barcode.trim() }
      });
      if (existingBarcode) {
        return res.status(400).json({ 
          error: `Barcode "${barcode.trim()}" already exists for product: ${existingBarcode.name}. Each product must have a unique barcode.` 
        });
      }
    }

    // Generate auto-increment SKU (001, 002, 003...)
    let nextSku = '001';
    const lastProduct = await Product.findOne({
      order: [['sku', 'DESC']]
    });
    if (lastProduct && lastProduct.sku) {
      const lastSku = parseInt(lastProduct.sku, 10);
      if (!isNaN(lastSku)) {
        nextSku = String(lastSku + 1).padStart(3, '0');
      }
    }
    console.log('INFO [PRODUCTS/CREATE]: Generated SKU:', nextSku);
    
    const productData = {
      name: name.trim(),
      description: description || '',
      price: parseFloat(price),
      discount_price: discount_price ? parseFloat(discount_price) : null,
      stock_quantity: parseInt(stock_quantity),
      category_id: category_id || null,
      image_url: image_url || '',
      images: images || [],
      brand: brand || null,
      category: category || null,
      sku: nextSku,
      barcode: barcode ? barcode.trim() : null,
      // No sizes for chemical products - simplified inventory
    };

    console.log('INFO [PRODUCTS/CREATE]: Product data:', { 
      ...productData, 
      price: productData.price ? 'set' : 'not set',
      stock_quantity: productData.stock_quantity,
      barcode: productData.barcode || 'none'
    });

    console.log('INFO [PRODUCTS/CREATE]: Creating product in database');
    const product = await Product.create(productData);
    
    console.log('INFO [PRODUCTS/CREATE]: Fetching created product with category');
    const createdProduct = await Product.findByPk(product.id, {
      include: [{
        model: Category,
        as: 'category_relation',
        attributes: ['id', 'name']
      }]
    });

    console.log('INFO [PRODUCTS/CREATE]: Product created successfully with ID:', product.id);

    refreshSitemapAsync();
    res.status(201).json(createdProduct);
  } catch (error) {
    console.error('ERROR AT [PRODUCTS/CREATE]:', error);
    console.error('ERROR AT [PRODUCTS/CREATE]: Stack:', error.stack);
    res.status(400).json({ 
      message: error.message, 
      stack: error.stack,
    });
  }
};

// Update product (Admin only)
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Extract and validate fields
    const { name, description, price, discount_price, stock_quantity, category_id, image_url, images, sizes, brand, category, product_type, barcode } = req.body;
    
    // Check for duplicate barcode if provided and different from current
    if (barcode !== undefined && barcode && barcode.trim()) {
      const barcodeToCheck = barcode.trim();
      // Only check if barcode is different from existing one
      if (barcodeToCheck !== product.barcode) {
        const existingBarcode = await Product.findOne({
          where: { barcode: barcodeToCheck }
        });
        if (existingBarcode) {
          return res.status(400).json({ 
            error: `Barcode "${barcodeToCheck}" already exists for product: ${existingBarcode.name}. Each product must have a unique barcode.` 
          });
        }
      }
    }
    
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = parseFloat(price);
    if (discount_price !== undefined) updateData.discount_price = discount_price ? parseFloat(discount_price) : null;
    if (stock_quantity !== undefined) updateData.stock_quantity = parseInt(stock_quantity);
    if (category_id !== undefined) updateData.category_id = category_id;
    if (image_url !== undefined) updateData.image_url = image_url;
    if (images !== undefined) updateData.images = images;
    if (sizes !== undefined) updateData.sizes = sizes;
    if (brand !== undefined) updateData.brand = brand;
    if (category !== undefined) updateData.category = category;
    if (barcode !== undefined) updateData.barcode = barcode ? barcode.trim() : null;

    await product.update(updateData);
    
    // Update stock entries if stock_quantity or sizes changed
    if (stock_quantity !== undefined || sizes !== undefined) {
      try {
        console.log('INFO [PRODUCTS/UPDATE]: Updating stock entries for product:', id);
        
        // Get current stock entries for this product
        const currentStock = await Stock.findAll({
          where: { product_id: id }
        });
        
        // If sizes are provided, update only those sizes
        if (sizes && sizes.length > 0) {
          console.log('INFO [PRODUCTS/UPDATE]: Updating stock for selected sizes:', sizes);
          
          // Get all sizes from database to map names to IDs
          const allSizes = await Size.findAll();
          const sizeMap = {};
          allSizes.forEach(size => {
            sizeMap[size.size] = size.id;
          });
          
          console.log('INFO [PRODUCTS/UPDATE]: Size mapping:', sizeMap);
          
          // Delete existing stock entries
          await Stock.destroy({ where: { product_id: id } });
          
          // Create new stock entries for selected sizes
          const stockPromises = [];
          for (const sizeItem of sizes) {
            const sizeId = sizeMap[sizeItem.size];
            if (sizeId) {
              stockPromises.push(
                Stock.create({
                  product_id: parseInt(id),
                  size_id: parseInt(sizeId),
                  quantity: parseInt(stock_quantity) || 0,
                  reorder_level: 5
                })
              );
              console.log(`INFO [PRODUCTS/UPDATE]: Adding stock for size ${sizeItem.size} (ID: ${sizeId})`);
            } else {
              console.warn(`INFO [PRODUCTS/UPDATE]: Size not found in database: ${sizeItem.size}`);
            }
          }
          
          await Promise.all(stockPromises);
          console.log(`INFO [PRODUCTS/UPDATE]: Stock entries updated for ${stockPromises.length} sizes`);
        } else {
          // Update all existing stock entries with new quantity
          await Stock.update(
            { quantity: parseInt(stock_quantity) || 0 },
            { where: { product_id: id } }
          );
          console.log(`INFO [PRODUCTS/UPDATE]: Updated quantity for ${currentStock.length} existing stock entries`);
        }
      } catch (stockError) {
        console.error('ERROR [PRODUCTS/UPDATE]: Failed to update stock entries:', stockError);
        // Don't fail the product update if stock update fails
      }
    }
    
    const updatedProduct = await Product.findByPk(id, {
      include: [{
        model: Category,
        as: 'category_relation',
        attributes: ['id', 'name']
      }]
    });

    refreshSitemapAsync();
    res.json(updatedProduct);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete product (Admin only)
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Hard delete
    await product.destroy();

    refreshSitemapAsync();
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Search products
const searchProducts = async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const offset = (page - 1) * limit;

    const { count, rows: products } = await Product.findAndCountAll({
      where: {
        [Op.and]: [
          { is_active: true },
          {
            [Op.or]: [
              { name: { [Op.iLike]: `%${q}%` } },
              { description: { [Op.iLike]: `%${q}%` } },
              { brand: { [Op.iLike]: `%${q}%` } },
              { category: { [Op.iLike]: `%${q}%` } }
            ]
          }
        ]
      },
      include: [{
        model: Category,
        as: 'category_relation',
        attributes: ['id', 'name']
      }],
      limit: parseInt(limit),
      offset,
      order: [['created_at', 'DESC']]
    });

    res.json({
      products,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Cleanup problematic products
const cleanupProblematicProducts = async (req, res) => {
  try {
    console.log('[CLEANUP] Starting cleanup of problematic products...');
    
    // Find active products with non-numeric SKUs
    const { Op } = require('sequelize');
    const problematicProducts = await Product.findAll({
      where: {
        is_active: true, // Only active products
        sku: {
          [Op.not]: /^[0-9]+$/
        }
      }
    });
    
    console.log(`[CLEANUP] Found ${problematicProducts.length} problematic active products`);
    
    // Delete problematic products
    let deletedCount = 0;
    for (const product of problematicProducts) {
      console.log(`[CLEANUP] Deleting product: ${product.id} - ${product.name} - SKU: ${product.sku}`);
      await product.destroy(); // Hard delete
      deletedCount++;
    }
    
    console.log(`[CLEANUP] Successfully deleted ${deletedCount} problematic products`);
    
    res.json({ 
      message: `Successfully deleted ${deletedCount} problematic products`,
      deletedCount 
    });
  } catch (error) {
    console.error('[CLEANUP] Error:', error);
    res.status(500).json({ error: error.message });
  }
};

export {
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
};
