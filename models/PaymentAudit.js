import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

// One row per payment attempt outcome.
// status: succeeded | failed | canceled | processing | requires_action | order_failed
// source: checkout (browser attempt) | order (order created) | webhook (Stripe event)
const PaymentAudit = sequelize.define("PaymentAudit", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  payment_intent_id: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  stripe_event_id: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  order_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  order_number: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  source: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  attempt_number: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  currency: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'USD',
  },
  payment_method_type: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  card_brand: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  card_last4: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  customer_email: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  customer_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  customer_phone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  error_code: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  details: {
    type: DataTypes.JSON,
    allowNull: true,
  },
}, {
  tableName: 'payment_audits',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['payment_intent_id'], name: 'idx_payment_audits_intent' },
    { fields: ['status'], name: 'idx_payment_audits_status' },
    { fields: ['order_id'], name: 'idx_payment_audits_order' },
  ],
});

export default PaymentAudit;
