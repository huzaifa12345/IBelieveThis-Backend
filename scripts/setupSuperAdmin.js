import dotenv from 'dotenv';
import sequelize from '../config/db.js';
import { User } from '../models/index.js';

dotenv.config();

// Usage: node scripts/setupSuperAdmin.js [email-to-promote]
const emailToPromote = process.argv[2];

const run = async () => {
  try {
    await sequelize.authenticate();

    // Postgres enums need an explicit ADD VALUE; sequelize.sync cannot do this.
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum e
          JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'enum_users_role' AND e.enumlabel = 'super_admin'
        ) THEN
          ALTER TYPE "enum_users_role" ADD VALUE 'super_admin';
        END IF;
      END $$;
    `);
    console.log("Role enum now includes 'super_admin'");

    if (emailToPromote) {
      const user = await User.findOne({ where: { email: emailToPromote } });
      if (!user) {
        console.error(`No user found with email ${emailToPromote}`);
        process.exitCode = 1;
      } else {
        await user.update({ role: 'super_admin' });
        console.log(`Promoted ${user.email} to super_admin`);
      }
    }

    const staff = await User.findAll({
      where: { role: ['admin', 'super_admin'] },
      attributes: ['id', 'email', 'first_name', 'last_name', 'role', 'is_active'],
      order: [['role', 'DESC'], ['id', 'ASC']],
    });

    console.log(`\nStaff accounts (${staff.length}):`);
    staff.forEach((user) => {
      const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'no name set';
      console.log(`  #${user.id} ${user.email} - ${user.role}${user.is_active ? '' : ' (inactive)'} - ${name}`);
    });

    if (!emailToPromote) {
      console.log('\nTo promote someone: node scripts/setupSuperAdmin.js their@email.com');
    }
  } catch (error) {
    console.error('Super admin setup failed:', error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
};

run();
