import sequelize from '../config/db.js';

const run = async () => {
  await sequelize.query('ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL');
  console.log('orders.user_id is now nullable (guest checkout enabled)');

  const [rows] = await sequelize.query(
    `SELECT column_name, is_nullable
     FROM information_schema.columns
     WHERE table_name = 'orders'
       AND column_name IN ('user_id', 'currency', 'payment_method', 'payment_status')
     ORDER BY column_name`
  );
  console.table(rows);

  await sequelize.close();
};

run().catch(async (error) => {
  console.error('Migration failed:', error.message);
  await sequelize.close();
  process.exit(1);
});
