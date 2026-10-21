import { Product, Category, Size, Stock, Review, sequelize } from '../models/index.js';
import { Op } from 'sequelize';
import { refreshSitemapAsync } from '../services/sitemapService.js';
import { triggerFrontendRebuildAsync } from '../services/deployHookService.js';

/** Attach averageRating / reviewCount for approved reviews only (never invent ratings). */
async function attachReviewStats(products) {
  const rows = Array.isArray(products) ? products : [];
  if (!rows.length) return rows;
  const ids = rows.map((p) => p.id).filter(Boolean);
  const stats = await Review.findAll({
    where: { product_id: { [Op.in]: ids }, status: 'approved' },
    attributes: [
      'product_id',
      [sequelize.fn('AVG', sequelize.col('rating')), 'averageRating'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'reviewCount'],
    ],
    group: ['product_id'],
    raw: true,
  });
  const map = Object.fromEntries(
    stats.map((s) => [
      s.product_id,
      {
        averageRating: Number(parseFloat(s.averageRating || 0).toFixed(1)),
        reviewCount: parseInt(s.reviewCount || 0, 10),
      },
    ])
  );
  return rows.map((p) => {
    const plain = typeof p.toJSON === 'function' ? p.toJSON() : { ...p };
    const s = map[plain.id];
    if (s && s.reviewCount > 0) {
      plain.averageRating = s.averageRating;
      plain.reviewCount = s.reviewCount;
    }
    return plain;
  });
}

/** Effective storefront price: discount when set and lower than unit price */
const effectivePriceSql = `COALESCE(NULLIF("Product"."discount_price", 0), "Product"."price")`;

const applyEffectivePriceFilter = (where, minPrice, maxPrice) => {
  if (minPrice == null && maxPrice == null) return where;
  const parts = [];
  if (minPrice != null && minPrice !== '') {
    parts.push(sequelize.where(sequelize.literal(effectivePriceSql), { [Op.gte]: Number(minPrice) }));
  }
  if (maxPrice != null && maxPrice !== '') {
    parts.push(sequelize.where(sequelize.literal(effectivePriceSql), { [Op.lte]: Number(maxPrice) }));
  }
  if (!parts.length) return where;
  where[Op.and] = [...(where[Op.and] || []), ...parts];
  return where;
};

const getSortConfig = (sortByRaw = 'created_at', orderRaw = 'DESC') => {
  const sortBy = String(sortByRaw).toLowerCase();
  const order = String(orderRaw).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const map = {
    created_at: ['created_at', order],
    newest: ['created_at', 'DESC'],
    oldest: ['created_at', 'ASC'],
    price_low: ['__effective_price__', 'ASC'],
    price_high: ['__effective_price__', 'DESC'],
    name_asc: ['name', 'ASC'],
    name_desc: ['name', 'DESC'],
    price: ['__effective_price__', order],
    name: ['name', order],
  };

  return map[sortBy] || ['created_at', 'DESC'];
};

const toOrderClause = (sortField, sortOrder) => {
  if (sortField === '__effective_price__') {
    return [[sequelize.literal(effectivePriceSql), sortOrder]];
  }
  return [[sortField, sortOrder]];
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
      include_inactive,
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
    const includeInactive =
      include_inactive === 'true' || include_inactive === '1' || include_inactive === true;

    console.log('INFO [PRODUCTS/GET_ALL]: Query params:', { page, limit, category_id, category, search, minPrice, maxPrice, sortBy, order, includeInactive });

    // Storefront keeps active-only; admin can request include_inactive=true
    const where = includeInactive ? {} : { is_active: true };
    
    // Filter by category
    if (category_id) {
      where.category_id = category_id;
    }
    
    if (category) {
      where.category = category;
    }
    
    // Search: name/category ranking (no description match — avoids "bel" → patch noise)
    let orderClause = toOrderClause(sortField, sortOrder);
    if (search) {
      const q = String(search).trim();
      where[Op.or] = [
        { name: { [Op.iLike]: `%${q}%` } },
        { category: { [Op.iLike]: `%${q}%` } },
        { '$category_relation.name$': { [Op.iLike]: `%${q}%` } },
        { brand: { [Op.iLike]: `%${q}%` } },
      ];
      const safe = q.replace(/'/g, "''");
      orderClause = [
        [
          sequelize.literal(`CASE
            WHEN "Product"."name" ILIKE '${safe}%' THEN 0
            WHEN "Product"."name" ILIKE '%${safe}%' THEN 1
            WHEN "Product"."category" ILIKE '%${safe}%' THEN 2
            WHEN "category_relation"."name" ILIKE '%${safe}%' THEN 2
            ELSE 3 END`),
          'ASC',
        ],
        ...toOrderClause(sortField, sortOrder),
      ];
    }

    applyEffectivePriceFilter(where, minPrice, maxPrice);

    const offset = (page - 1) * limit;

    console.log('INFO [PRODUCTS/GET_ALL]: Querying database');
    const { count, rows: products } = await Product.findAndCountAll({
      where,
      include: [{
        model: Category,
        as: 'category_relation',
        attributes: ['id', 'name'],
        required: false,
      }],
      limit: parseInt(limit),
      offset,
      order: orderClause,
      subQuery: false,
    });

    console.log('INFO [PRODUCTS/GET_ALL]: Found', count, 'products');
    const productsWithReviews = await attachReviewStats(products);
    res.json({
      products: productsWithReviews,
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

    const rawCat = decodeURIComponent(String(category || '')).trim();
    const categoryId = parseInt(rawCat, 10);
    const isNumeric = !isNaN(categoryId) && String(categoryId) === rawCat;

    const whereCondition = {
      is_active: true
    };

    if (isNumeric) {
      whereCondition.category_id = categoryId;
    } else {
      // Resolve SEO slug → category id (matches sitemap /category/:slug)
      const { slugify } = await import('../utils/slugify.js');
      const cats = await Category.findAll({ where: { is_active: true } });
      const matched =
        cats.find((c) => c.slug === rawCat) ||
        cats.find((c) => slugify(c.name) === rawCat) ||
        cats.find((c) => c.name?.toLowerCase() === rawCat.toLowerCase());

      if (matched) {
        whereCondition.category_id = matched.id;
      } else {
        whereCondition.category = rawCat;
      }
    }

    if (search) {
      const q = String(search).trim();
      whereCondition[Op.or] = [
        { name: { [Op.iLike]: `%${q}%` } },
        { category: { [Op.iLike]: `%${q}%` } },
        { '$category_relation.name$': { [Op.iLike]: `%${q}%` } },
        { brand: { [Op.iLike]: `%${q}%` } },
      ];
    }

    applyEffectivePriceFilter(whereCondition, minPrice, maxPrice);

    console.log(`[DEBUG] whereCondition:`, whereCondition);

    const { count, rows: products } = await Product.findAndCountAll({
      where: whereCondition,
      include: [{
        model: Category,
        as: 'category_relation',
        attributes: ['id', 'name'],
        required: false,
      }],
      limit: parseInt(limit),
      offset,
      order: toOrderClause(sortField, sortOrder),
      subQuery: false,
    });

    console.log(`[DEBUG] Found ${count} products`);
    console.log(`[DEBUG] Products:`, products.map(p => ({ id: p.id, name: p.name, category_id: p.category_id })));

    const productsWithReviews = await attachReviewStats(products);
    res.json({
      products: productsWithReviews,
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
    const { name, description, price, discount_price, stock_quantity, category_id, image_url, images, sizes, brand, category, barcode } = req.body;
    
    console.log('INFO [PRODUCTS/CREATE]: Form data received:', { 
      name, 
      price, 
      stock_quantity,
      barcode,
      sizes_count: Array.isArray(sizes) ? sizes.length : 0,
    });
    
    // Validate required fields
    if (!name || !price || stock_quantity === null || stock_quantity === undefined) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, price, stock_quantity' 
      });
    }

    const normalizedSizes = Array.isArray(sizes)
      ? sizes
          .filter((s) => s && String(s.size || '').trim())
          .map((s) => ({
            size: String(s.size).trim(),
            quantity: Math.max(0, parseInt(s.quantity, 10) || 0),
          }))
      : [];

    const sizeStockTotal = normalizedSizes.reduce((sum, s) => sum + s.quantity, 0);
    const resolvedStock =
      normalizedSizes.length > 0 ? sizeStockTotal : parseInt(stock_quantity, 10) || 0;

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
      stock_quantity: resolvedStock,
      category_id: category_id || null,
      image_url: image_url || '',
      images: images || [],
      brand: brand || null,
      category: category || null,
      sku: nextSku,
      barcode: barcode ? barcode.trim() : null,
      sizes: normalizedSizes,
    };

    console.log('INFO [PRODUCTS/CREATE]: Product data:', { 
      ...productData, 
      price: productData.price ? 'set' : 'not set',
      stock_quantity: productData.stock_quantity,
      barcode: productData.barcode || 'none'
    });

    console.log('INFO [PRODUCTS/CREATE]: Creating product in database');
    const product = await Product.create(productData);

    // Create size catalog + stock rows for Etsy-style variations
    if (normalizedSizes.length > 0) {
      for (const sizeItem of normalizedSizes) {
        const [sizeRecord] = await Size.findOrCreate({
          where: { size: sizeItem.size },
          defaults: { size: sizeItem.size, description: '' },
        });
        await Stock.findOrCreate({
          where: { product_id: product.id, size_id: sizeRecord.id },
          defaults: {
            product_id: product.id,
            size_id: sizeRecord.id,
            quantity: sizeItem.quantity,
            reorder_level: 5,
          },
        });
      }
    }
    
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
    triggerFrontendRebuildAsync('product-change');
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
            const sizeName = String(sizeItem.size || '').trim();
            if (!sizeName) continue;

            let sizeId = sizeMap[sizeName];
            if (!sizeId) {
              const [createdSize] = await Size.findOrCreate({
                where: { size: sizeName },
                defaults: { size: sizeName, description: '' },
              });
              sizeId = createdSize.id;
              sizeMap[sizeName] = sizeId;
            }

            stockPromises.push(
              Stock.create({
                product_id: parseInt(id),
                size_id: parseInt(sizeId),
                quantity: Math.max(0, parseInt(sizeItem.quantity, 10) || 0),
                reorder_level: 5
              })
            );
            console.log(`INFO [PRODUCTS/UPDATE]: Adding stock for size ${sizeName} (ID: ${sizeId})`);
          }

          // Keep product.stock_quantity in sync with size totals
          const sizeTotal = sizes.reduce(
            (sum, s) => sum + (Math.max(0, parseInt(s.quantity, 10) || 0)),
            0
          );
          await product.update({ stock_quantity: sizeTotal });
          
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
    triggerFrontendRebuildAsync('product-change');
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
    triggerFrontendRebuildAsync('product-change');
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

    const term = String(q).trim();
    const safe = term.replace(/'/g, "''");
    const { count, rows: products } = await Product.findAndCountAll({
      where: {
        [Op.and]: [
          { is_active: true },
          {
            [Op.or]: [
              { name: { [Op.iLike]: `%${term}%` } },
              { category: { [Op.iLike]: `%${term}%` } },
              { '$category_relation.name$': { [Op.iLike]: `%${term}%` } },
              { brand: { [Op.iLike]: `%${term}%` } },
            ],
          },
        ],
      },
      include: [{
        model: Category,
        as: 'category_relation',
        attributes: ['id', 'name'],
        required: false,
      }],
      limit: parseInt(limit),
      offset,
      subQuery: false,
      order: [
        [
          sequelize.literal(`CASE
            WHEN "Product"."name" ILIKE '${safe}%' THEN 0
            WHEN "Product"."name" ILIKE '%${safe}%' THEN 1
            WHEN "Product"."category" ILIKE '%${safe}%' THEN 2
            WHEN "category_relation"."name" ILIKE '%${safe}%' THEN 2
            ELSE 3 END`),
          'ASC',
        ],
        ['created_at', 'DESC'],
      ],
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
