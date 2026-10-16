#!/usr/bin/env node
/**
 * Database Sync Script
 * This script syncs the database with the current models
 * Run with: node scripts/syncDatabase.js
 */

import sequelize from '../config/db.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import Size from '../models/Size.js';
import Stock from '../models/Stock.js';
import User from '../models/User.js';
import Order from '../models/Order.js';
import OrderItem from '../models/OrderItem.js';
import Review from '../models/Review.js';

async function syncDatabase() {
  try {
    console.log('Starting database sync...\n');
    
    // Test connection
    await sequelize.authenticate();
    console.log('✓ Database connection established\n');
    
    // Sync all models (alter: true will modify existing tables, force: false keeps data)
    console.log('Syncing models...');
    await sequelize.sync({ alter: true, force: false });
    console.log('✓ Database synced successfully\n');
    
    // Show current table structure
    console.log('Current tables:');
    const tables = await sequelize.showAllSchemas();
    console.log(tables);
    
    console.log('\n✓ Sync complete!');
    process.exit(0);
  } catch (error) {
    console.error('✗ Sync failed:', error);
    process.exit(1);
  }
}

syncDatabase();
