import { sequelize } from '../config/db.js';

const fixUserRoleColumn = async () => {
  try {
    console.log('🔧 Fixing user role column...');
    
    // Connect to database
    await sequelize.authenticate();
    console.log('✅ Database connected successfully.');

    // First, let's check what constraints exist
    console.log('📋 Checking existing constraints...');
    const constraints = await sequelize.query(`
      SELECT conname, contype 
      FROM pg_constraint 
      WHERE conrelid = 'users'::regclass AND conname LIKE '%role%';
    `);
    
    console.log('Found constraints:', constraints[0]);

    // Drop any existing role-related constraints
    if (constraints[0].length > 0) {
      for (const constraint of constraints[0]) {
        console.log(`🗑️  Dropping constraint: ${constraint.conname}`);
        await sequelize.query(`
          ALTER TABLE users DROP CONSTRAINT IF EXISTS ${constraint.conname};
        `);
      }
    }

    // Update existing data to use valid enum values first
    console.log('🔄 Updating existing data...');
    await sequelize.query(`
      UPDATE users SET role = 'admin' WHERE role = 'admin';
    `);
    
    await sequelize.query(`
      UPDATE users SET role = 'customer' WHERE role NOT IN ('admin', 'customer');
    `);
    console.log('✅ Data updated to use valid enum values');

    // Now try to alter the column
    console.log('🔄 Altering column type...');
    await sequelize.query(`
      ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(255) USING role::VARCHAR(255);
    `);
    console.log('✅ Column type changed to VARCHAR');

    // Set the new default
    console.log('🎯 Setting new default value...');
    await sequelize.query(`
      ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user';
    `);
    console.log('✅ Default value set to "user"');

    // Update all 'customer' to 'user'
    console.log('🔄 Converting customer roles to user...');
    const updateResult = await sequelize.query(`
      UPDATE users SET role = 'user' WHERE role = 'customer';
    `);
    console.log(`✅ Updated ${updateResult[1]} records from customer to user`);

    // Verify the changes
    console.log('🔍 Verifying changes...');
    const users = await sequelize.query(`
      SELECT id, email, role FROM users;
    `);
    
    console.log('📊 Current users:');
    users[0].forEach(user => {
      console.log(`  ID: ${user.id}, Email: ${user.email}, Role: ${user.role}`);
    });

    console.log('\n🎉 User role column fixed successfully!');
    console.log('You can now start the server normally.');

  } catch (error) {
    console.error('❌ Error fixing user role column:', error);
    console.error('Error details:', error.message);
  } finally {
    await sequelize.close();
  }
};

// Run the fix
fixUserRoleColumn();
