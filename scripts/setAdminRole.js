import sequelize from '../config/db.js';
import { QueryTypes } from 'sequelize';

const findAndUpdateAdmin = async () => {
  try {
    console.log('🔍 Looking for users in the database...');
    
    // Connect to database
    await sequelize.authenticate();
    console.log('✅ Database connected successfully.');

    // Get all users to identify your account
    console.log('📋 Fetching all users...');
    const users = await sequelize.query(`
      SELECT id, email, first_name, last_name, role, created_at 
      FROM users 
      ORDER BY created_at DESC
    `, { type: QueryTypes.SELECT });
    
    if (users.length === 0) {
      console.log('❌ No users found in the database.');
      return;
    }

    console.log('\n👥 Found users:');
    users.forEach((user, index) => {
      console.log(`${index + 1}. ID: ${user.id}, Email: ${user.email}, Name: ${user.first_name} ${user.last_name}, Role: ${user.role}, Created: ${user.created_at}`);
    });

    // Look for the most recently created user (likely yours)
    const latestUser = users[0];
    console.log(`\n🎯 Target user identified: ${latestUser.email} (ID: ${latestUser.id}, Current Role: ${latestUser.role})`);

    // Update the role to admin
    console.log('🔄 Updating user role to admin...');
    const updateResult = await sequelize.query(`
      UPDATE users 
      SET role = 'admin', updated_at = CURRENT_TIMESTAMP 
      WHERE id = :userId
    `, {
      replacements: { userId: latestUser.id },
      type: QueryTypes.UPDATE
    });

    console.log(`✅ Update successful! ${updateResult[1]} row(s) affected.`);

    // Verify the update
    console.log('🔍 Verifying the update...');
    const updatedUser = await sequelize.query(`
      SELECT id, email, first_name, last_name, role, updated_at 
      FROM users 
      WHERE id = :userId
    `, {
      replacements: { userId: latestUser.id },
      type: QueryTypes.SELECT
    });

    if (updatedUser.length > 0) {
      const user = updatedUser[0];
      console.log('\n🎉 SUCCESS! User updated to admin:');
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Name: ${user.first_name} ${user.last_name}`);
      console.log(`   Role: ${user.role} ✅`);
      console.log(`   Updated: ${user.updated_at}`);
    }

    console.log('\n📝 NEXT STEPS:');
    console.log('1. Clear your browser localStorage/token');
    console.log('2. Logout from the application');
    console.log('3. Login again to get fresh JWT with admin role');
    console.log('4. You should now have admin privileges!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
  }
};

// Run the script
findAndUpdateAdmin();
