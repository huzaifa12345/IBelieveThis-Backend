import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Order = sequelize.define("Order", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  order_number: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled'),
    defaultValue: 'pending',
  },
  subtotal: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  tax_amount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  shipping_amount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  total_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  currency: {
    type: DataTypes.STRING,
    defaultValue: 'USD',
  },
  shipping_address: {
    type: DataTypes.JSON,
    allowNull: false,
  },
  billing_address: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  payment_method: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  payment_status: {
    type: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded'),
    defaultValue: 'pending',
  },
  account_holder_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  account_number: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  bank_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  transaction_id: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  payment_screenshot: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  tracking_number: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  tableName: 'orders',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

export default Order;
