import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Stock = sequelize.define('Stock', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'products',
      key: 'id',
    },
  },
  size_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'sizes',
      key: 'id',
    },
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  reorder_level: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 5 // Alert when stock reaches 5 units
  }
}, {
  tableName: 'stock',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['product_id', 'size_id'],
      name: 'unique_product_size'
    },
    {
      fields: ['product_id'],
      name: 'idx_product_id'
    },
    {
      fields: ['size_id'],
      name: 'idx_size_id'
    }
  ]
});

export default Stock;
