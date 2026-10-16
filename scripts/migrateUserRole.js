import { sequelize } from '../config/db.js';
import { QueryTypes } from 'sequelize';

const migrateUserRole = async () => {
  try {
    console.log('Starting user role migration...');
    
    // Connect to database
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    // Step 1: Drop the existing ENUM constraint
    console.log('Step 1: Dropping existing ENUM constraint...');
    await sequelize.query(`
      ALTER TABLE users 
      DROP CONSTRAINT IF EXISTS users_role_check;
    `);
    console.log('✅ ENUM constraint dropped successfully.');

    // Step 2: Update existing 'customer' values to 'user'
    console.log('Step 2: Updating existing customer roles to user...');
    const updateResult = await sequelize.query(`
      UPDATE users 
      SET role = 'user' 
      WHERE role = 'customer';
    `, { type: QueryTypes.UPDATE });
    console.log(`✅ Updated ${updateResult[1]} records from 'customer' to 'user'.`);

    // Step 3: Alter the column type to VARCHAR
    console.log('Step 3: Converting role column to VARCHAR...');
    await sequelize.query(`
      ALTER TABLE users 
      ALTER COLUMN role TYPE VARCHAR(255);
    `);
    console.log('✅ Role column converted to VARCHAR successfully.');

    // Step 4: Set default value
    console.log('Step 4: Setting default value...');
    await sequelize.query(`
      ALTER TABLE users 
      ALTER COLUMN role SET DEFAULT 'user';
    `);
    console.log('✅ Default value set to "user" successfully.');

    // Step 5: Verify the migration
    console.log('Step 5: Verifying migration...');
    const users = await sequelize.query(`
      SELECT id, email, role FROM users LIMIT 5;
    `, { type: QueryTypes.SELECT });
    
    console.log('Sample users after migration:');
    users.forEach(user => {
      console.log(`  ID: ${user.id}, Email: ${user.email}, Role: ${user.role}`);
    });

    console.log('\n🎉 Migration completed successfully!');
    console.log('The User model role field is now a STRING type with default value "user"');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Error details:', error.message);
  } finally {
    await sequelize.close();
  }
};

// Run the migration
migrateUserRole();
