import dotenv from 'dotenv';
import sequelize from '../config/db.js';
import { PaymentAudit } from '../models/index.js';

dotenv.config();

const run = async () => {
  try {
    await sequelize.authenticate();
    await PaymentAudit.sync({ alter: true });

    const [columns] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'payment_audits'
      ORDER BY ordinal_position
    `);

    console.log('payment_audits table is ready:');
    columns.forEach((col) => {
      console.log(`  - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });
  } catch (error) {
    console.error('Failed to sync payment_audits:', error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
};

run();
