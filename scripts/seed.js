import bcrypt from 'bcryptjs';
import { sequelize, User, Product, Category } from '../models/index.js';

const seedData = async () => {
  try {
    console.log('Starting database seeding...');

    // Sync database
    await sequelize.sync({ force: true });
    console.log('Database synchronized.');


    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const adminUser = await User.create({
      first_name: 'Admin',
      last_name: 'User',
      email: 'admin@saithchemical.com',
      password: hashedPassword,
      role: 'admin',
      phone: '+1234567890'
    });

    console.log('Admin user created:', adminUser.email);

    // Create regular user
    const userPassword = await bcrypt.hash('user123', 10);
    const regularUser = await User.create({
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
      password: userPassword,
      role: 'customer',
      phone: '+1234567891'
    });

    console.log('Regular user created:', regularUser.email);

    // Create products
   



    console.log('\n=== Seeding Summary ===');
    console.log(`Categories: ${categories.length}`);
    console.log(`Users: 2 (1 admin, 1 customer)`);
    console.log(`Products: ${createdProducts.length}`);
    console.log('\n=== Admin Credentials ===');
    console.log('Email: admin@saithchemical.com');
    console.log('Password: admin123');
    console.log('\n=== Customer Credentials ===');
    console.log('Email: john@example.com');
    console.log('Password: user123');
    console.log('\n=== API Endpoints ===');
    console.log('Server: http://localhost:3001');
    console.log('Health: http://localhost:3001/api/health');
    console.log('Products: http://localhost:3001/api/products');
    console.log('Categories: http://localhost:3001/api/categories');

    console.log('\nDatabase seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await sequelize.close();
  }
};

// Run the seeding
seedData();
