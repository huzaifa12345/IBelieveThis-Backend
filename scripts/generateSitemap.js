import dotenv from 'dotenv';
dotenv.config();

import sequelize from '../config/db.js';
import { refreshSitemap } from '../services/sitemapService.js';

const run = async () => {
  await refreshSitemap();
  await sequelize.close();
};

run().catch(async (error) => {
  console.error(error);
  await sequelize.close();
  process.exit(1);
});
