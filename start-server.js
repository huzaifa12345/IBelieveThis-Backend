import { sequelize } from './models/index.js';
import bcrypt from 'bcryptjs';
import { User, Product, Category } from './models/index.js';

const quickStart = async () => {
  try {
    console.log('Starting quick database setup...');
    
    // Sync database
    await sequelize.sync({ force: true });
    console.log('Database synchronized.');

    // Create categories
    const categories = await Category.bulkCreate([
      {
        name: 'Fashion',
        slug: 'fashion',
        description: 'Latest fashion trends and clothing',
        image_url: '/images/fashion-category.jpg',
        sort_order: 1
      },
      {
        name: 'Electronics',
        slug: 'electronic',
        description: 'Cutting-edge electronics and gadgets',
        image_url: '/images/electronic-category.jpg',
        sort_order: 2
      },
      {
        name: 'Jewellery',
        slug: 'jewellery',
        description: 'Elegant jewellery and accessories',
        image_url: '/images/jewellery-category.jpg',
        sort_order: 3
      }
    ]);

    console.log('Categories created:', categories.length);

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const adminUser = await User.create({
      first_name: 'Admin',
      last_name: 'User',
      email: 'admin@eflyer.com',
      password: hashedPassword,
      role: 'admin',
      phone: '+1234567890'
    });

    console.log('Admin user created:', adminUser.email);

    // Create some sample products
    const products = await Product.bulkCreate([
      {
        name: 'Designer T-Shirt',
        description: 'Premium quality cotton t-shirt with modern design',
        price: 29.99,
        stock_quantity: 50,
        category_id: categories[0].id,
        category: 'fashion',
        brand: 'Eflyer Fashion',
        sku: 'TSH-001',
        image_url: '/images/fashion/tshirt-1.jpg'
      },
      {
        name: 'Wireless Headphones',
        description: 'Premium noise-cancelling wireless headphones',
        price: 149.99,
        stock_quantity: 40,
        category_id: categories[1].id,
        category: 'electronic',
        brand: 'Eflyer Tech',
        sku: 'HEAD-001',
        image_url: '/images/electronic/headphones-1.jpg'
      },
      {
        name: 'Gold Necklace',
        description: 'Elegant 18k gold necklace with diamond pendant',
        price: 599.99,
        stock_quantity: 10,
        category_id: categories[2].id,
        category: 'jewellery',
        brand: 'Eflyer Jewels',
        sku: 'NECK-001',
        image_url: '/images/jewellery/necklace-1.jpg'
      }
    ]);

    console.log('Products created:', products.length);

    console.log('\n=== Setup Complete ===');
    console.log('Admin Credentials:');
    console.log('Email: admin@eflyer.com');
    console.log('Password: admin123');
    console.log('\nServer is ready to start!');

    await sequelize.close();
  } catch (error) {
    console.error('Setup error:', error);
  }
};

quickStart();
