import { DataTypes, Op } from "sequelize";
import sequelize from "../config/db.js";
import { slugify } from "../utils/slugify.js";

const Product = sequelize.define("Product", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  discount_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  stock_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  category_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'categories',
      key: 'id',
    },
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  brand: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  sku: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  image_url: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  images: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
  },
  sizes: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: 'Array of size objects with size name and quantity'
  },
  barcode: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Product barcode/EAN/UPC identifier',
    index: true
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: true,
    // Uniqueness enforced via DB index (products_slug_unique), not column UNIQUE
    // — Sequelize alter sync cannot rewrite VARCHAR(... UNIQUE) on Postgres.
    comment: 'SEO URL slug derived from product name',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'products',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    async beforeValidate(product) {
      if (!product.name) return;

      const nameChanged = product.changed('name');
      const needsSlug = !product.slug || nameChanged;
      if (!needsSlug) return;

      const base = slugify(product.name);
      let candidate = base;
      let suffix = 2;

      // Prefer plain name slug; append -2, -3... only on collision with another product.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const existing = await Product.findOne({
          where: {
            slug: candidate,
            ...(product.id ? { id: { [Op.ne]: product.id } } : {}),
          },
        });
        if (!existing) {
          product.slug = candidate;
          break;
        }
        candidate = `${base}-${suffix}`;
        suffix += 1;
      }
    },
  },
});

export default Product;
