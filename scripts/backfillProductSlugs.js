import dotenv from 'dotenv';
dotenv.config();

import { Op } from 'sequelize';
import sequelize from '../config/db.js';
import { Product } from '../models/index.js';
import { slugify } from '../utils/slugify.js';

const run = async () => {
  await sequelize.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS slug VARCHAR(255)
  `);

  // Unique index (ignore if already exists)
  try {
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS products_slug_unique ON products (slug)
    `);
  } catch (error) {
    console.warn('Unique index note:', error.message);
  }

  const products = await Product.findAll({ order: [['id', 'ASC']] });
  console.log(`Backfilling slugs for ${products.length} products...`);

  for (const product of products) {
    const base = slugify(product.name);
    let candidate = base;
    let suffix = 2;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const clash = await Product.findOne({
        where: {
          slug: candidate,
          id: { [Op.ne]: product.id },
        },
      });
      if (!clash) break;
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }

    await sequelize.query(
      `UPDATE products SET slug = :slug WHERE id = :id`,
      { replacements: { slug: candidate, id: product.id } }
    );
    console.log(`  #${product.id} "${product.name}" → /product/${candidate}`);
  }

  const [rows] = await sequelize.query(`SELECT id, name, slug FROM products ORDER BY id`);
  console.log('\nCurrent slugs:');
  rows.forEach((row) => console.log(`  #${row.id} ${row.slug}`));

  await sequelize.close();
};

run().catch(async (error) => {
  console.error(error);
  await sequelize.close();
  process.exit(1);
});
