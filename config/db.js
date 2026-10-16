import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
dotenv.config();

const sequelize = process.env.DATABASE_URL 
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false, // Neon connection ke liye zaroori hai
        },
      },
      logging: false,
    })
  : new Sequelize(
      process.env.DB_NAME || 'ecommerce_db',
      process.env.DB_USER || 'postgres',
      process.env.DB_PASS || 'password',
      {
        host: process.env.DB_HOST || 'localhost',
        dialect: 'postgres',
        logging: false,
      }
    );

export default sequelize;