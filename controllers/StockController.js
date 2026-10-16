import { Stock, Product, Size } from '../models/index.js';
import { Op, Sequelize } from 'sequelize';

class StockController {
  static async getAllStock(req, res) {
    try {
      const stock = await Stock.findAll({
        include: [
          {
            model: Product,
            as: 'product',
            attributes: ['id', 'name', 'price', 'image_url']
          },
          {
            model: Size,
            as: 'size',
            attributes: ['id', 'size', 'description']
          }
        ],
        order: [
          [{ model: Product, as: 'product' }, 'name', 'ASC'],
          [{ model: Size, as: 'size' }, 'size', 'ASC']
        ]
      });
      
      res.json({
        success: true,
        data: stock
      });
    } catch (error) {
      console.error('Error fetching stock:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch stock'
      });
    }
  }

  static async getLowStock(req, res) {
    try {
      const lowStock = await Stock.findAll({
        where: {
          quantity: {
            [Op.lte]: Sequelize.col('reorder_level')
          }
        },
        include: [
          {
            model: Product,
            as: 'product',
            attributes: ['id', 'name', 'price']
          },
          {
            model: Size,
            as: 'size',
            attributes: ['id', 'size', 'description']
          }
        ],
        order: [['quantity', 'ASC']]
      });
      
      res.json({
        success: true,
        data: lowStock
      });
    } catch (error) {
      console.error('Error fetching low stock:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch low stock items'
      });
    }
  }

  static async updateStock(req, res) {
    try {
      const { product_id, size_id, quantity } = req.body;
      
      if (!product_id || !size_id || quantity === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Product ID, size ID, and quantity are required'
        });
      }

      await Stock.update(
        { quantity },
        { 
          where: { product_id, size_id }
        }
      );
      
      res.json({
        success: true,
        message: 'Stock updated successfully'
      });
    } catch (error) {
      console.error('Error updating stock:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update stock'
      });
    }
  }

  static async createStock(req, res) {
    try {
      const { product_id, size_id, quantity, reorder_level } = req.body;
      
      if (!product_id || !size_id || quantity === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Product ID, size ID, and quantity are required'
        });
      }

      await Stock.create({
        product_id,
        size_id,
        quantity,
        reorder_level: reorder_level || 10
      });
      
      res.json({
        success: true,
        message: 'Stock created successfully'
      });
    } catch (error) {
      console.error('Error creating stock:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create stock'
      });
    }
  }

  static async checkStock(req, res) {
    try {
      const { product_id, size_id, quantity } = req.query;
      
      if (!product_id || !size_id) {
        return res.status(400).json({
          success: false,
          error: 'Product ID and size ID are required'
        });
      }

      const stock = await Stock.findOne({
        where: { product_id, size_id }
      });
      
      if (!stock) {
        return res.json({
          success: true,
          data: { available: false, message: 'Product size not found' }
        });
      }
      
      const requestedQty = parseInt(quantity) || 1;
      const available = stock.quantity >= requestedQty;
      
      res.json({
        success: true,
        data: {
          available,
          currentStock: stock.quantity,
          message: available ? 'In stock' : `Only ${stock.quantity} items available`
        }
      });
    } catch (error) {
      console.error('Error checking stock:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check stock availability'
      });
    }
  }
}

export default StockController;
