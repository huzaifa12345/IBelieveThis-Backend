import { Category, Product } from '../models/index.js';
import { Op } from 'sequelize';
import { slugify } from '../utils/slugify.js';

/** Resolve category by numeric id or public name-slug (matches sitemap). */
async function findCategoryByParam(param) {
  const raw = decodeURIComponent(String(param || '')).trim();
  if (!raw) return null;

  if (/^\d+$/.test(raw)) {
    return Category.findOne({ where: { id: Number(raw), is_active: true } });
  }

  const categories = await Category.findAll({ where: { is_active: true } });
  return (
    categories.find((c) => c.slug && c.slug === raw) ||
    categories.find((c) => slugify(c.name) === raw) ||
    null
  );
}

// Get all categories (simplified)
const getAllCategories = async (req, res) => {
  try {
    console.log('INFO [CATEGORIES/GET_ALL]: Starting categories fetch');
    const { include_product_count = false } = req.query;
    
    console.log('INFO [CATEGORIES/GET_ALL]: Query params:', { include_product_count });
    
    let categories;
    
    if (include_product_count === 'true') {
      categories = await Category.findAll({
        where: { is_active: true },
        order: [['sort_order', 'ASC'], ['name', 'ASC']],
        include: [{
          model: Product,
          as: 'products',
          attributes: ['id'],
          required: false
        }]
      });
      
      // Add product count
      categories = categories.map(category => ({
        ...category.toJSON(),
        product_count: category.products ? category.products.length : 0,
        products: undefined // Remove products array from response
      }));
    } else {
      categories = await Category.findAll({
        where: { is_active: true },
        order: [['sort_order', 'ASC'], ['name', 'ASC']]
      });
    }

    console.log('INFO [CATEGORIES/GET_ALL]: Found', categories.length, 'categories');
    res.json(categories);
  } catch (error) {
    console.error('ERROR AT [CATEGORIES/GET_ALL]:', error);
    res.status(500).json({ 
      message: error.message, 
      error: 'Failed to fetch categories'
    });
  }
};

// Get category by ID or SEO slug
const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await findCategoryByParam(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found',
      });
    }

    // Return plain category object (storefront expects this shape)
    res.json(category);
  } catch (error) {
    console.error('ERROR AT [CATEGORIES/GET_BY_ID]:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch category',
    });
  }
};

const getCategoryBySlug = async (req, res) => {
  try {
    const category = await findCategoryByParam(req.params.slug);
    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }
    res.json(category);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch category' });
  }
};

// Create new category
const createCategory = async (req, res) => {
  try {
    const { name, description, image_url, sort_order = 0 } = req.body;

    if (!name) {
      return res.status(400).json({ 
        success: false, 
        error: 'Category name is required' 
      });
    }

    // Check if category already exists
    const existingCategory = await Category.findOne({
      where: { name: name.trim() }
    });

    if (existingCategory) {
      return res.status(400).json({ 
        success: false, 
        error: 'Category with this name already exists' 
      });
    }

    const category = await Category.create({
      name: name.trim(),
      description: description?.trim() || null,
      image_url: image_url || null,
      sort_order: parseInt(sort_order) || 0
    });

    console.log('INFO [CATEGORIES/CREATE]: Created category:', category.name);

    try {
      const { refreshSitemapAsync } = await import('../services/sitemapService.js');
      refreshSitemapAsync();
    } catch (_) { /* ignore */ }

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category
    });
  } catch (error) {
    console.error('ERROR AT [CATEGORIES/CREATE]:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create category'
    });
  }
};

// Update category
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, image_url, sort_order } = req.body;

    const category = await Category.findByPk(id);
    if (!category) {
      return res.status(404).json({ 
        success: false, 
        error: 'Category not found' 
      });
    }

    // Check if name is being changed and if new name already exists
    if (name && name.trim() !== category.name) {
      const existingCategory = await Category.findOne({
        where: { name: name.trim() }
      });

      if (existingCategory) {
        return res.status(400).json({ 
          success: false, 
          error: 'Category with this name already exists' 
        });
      }
    }

    await category.update({
      name: name?.trim() || category.name,
      description: description?.trim() || category.description,
      image_url: image_url || category.image_url,
      sort_order: sort_order !== undefined ? parseInt(sort_order) : category.sort_order
    });

    console.log('INFO [CATEGORIES/UPDATE]: Updated category:', category.name);

    try {
      const { refreshSitemapAsync } = await import('../services/sitemapService.js');
      refreshSitemapAsync();
    } catch (_) { /* ignore */ }

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: category
    });
  } catch (error) {
    console.error('ERROR AT [CATEGORIES/UPDATE]:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update category'
    });
  }
};

// Delete category
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findByPk(id);
    if (!category) {
      return res.status(404).json({ 
        success: false, 
        error: 'Category not found' 
      });
    }

    // Check if category has products
    const productCount = await Product.count({
      where: { category_id: id }
    });

    if (productCount > 0) {
      return res.status(400).json({ 
        success: false, 
        error: `Cannot delete category. It has ${productCount} products associated with it.` 
      });
    }

    await category.destroy();

    console.log('INFO [CATEGORIES/DELETE]: Deleted category:', category.name);

    try {
      const { refreshSitemapAsync } = await import('../services/sitemapService.js');
      refreshSitemapAsync();
    } catch (_) { /* ignore */ }

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('ERROR AT [CATEGORIES/DELETE]:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete category'
    });
  }
};

// Get root categories (simplified - returns all active categories)
const getRootCategories = async (req, res) => {
  try {
    const categories = await Category.findAll({
      where: { is_active: true },
      order: [['sort_order', 'ASC'], ['name', 'ASC']]
    });

    res.json(categories);
  } catch (error) {
    console.error('ERROR AT [CATEGORIES/GET_ROOT]:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch categories'
    });
  }
};

// Get category tree (simplified - returns flat list)
const getCategoryTree = async (req, res) => {
  try {
    const categories = await Category.findAll({
      where: { is_active: true },
      order: [['sort_order', 'ASC'], ['name', 'ASC']]
    });

    res.json(categories);
  } catch (error) {
    console.error('ERROR AT [CATEGORIES/GET_TREE]:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch category tree'
    });
  }
};

export {
  getAllCategories,
  getCategoryById,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
  getRootCategories,
  getCategoryTree
};
