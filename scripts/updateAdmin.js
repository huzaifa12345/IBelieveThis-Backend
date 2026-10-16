import User from '../models/User.js';
import sequelize from '../config/db.js';

const updateToAdmin = async (email) => {
  try {
    // Connect to database
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    // Find the user by email
    const user = await User.findOne({ where: { email } });
    
    if (!user) {
      console.log(`User with email ${email} not found.`);
      return;
    }

    // Update user role to admin
    await user.update({ role: 'admin' });
    
    console.log(`✅ Success! User ${email} has been updated to admin role.`);
    console.log(`User details:`, {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role
    });

  } catch (error) {
    console.error('❌ Error updating user role:', error);
  } finally {
    await sequelize.close();
  }
};

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.log('Usage: node updateAdmin.js <user-email>');
  console.log('Example: node updateAdmin.js user@example.com');
  process.exit(1);
}

updateToAdmin(email);
