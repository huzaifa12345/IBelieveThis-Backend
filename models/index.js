import sequelize from "../config/db.js";
import User from "./User.js";
import Product from "./Product.js";
import Category from "./Category.js";
import Order from "./Order.js";
import OrderItem from "./OrderItem.js";
import initReview from "./Review.js";
import Size from "./Size.js";
import Stock from "./Stock.js";
import WebsiteSetting from "./WebsiteSetting.js";
import FailedEmail from "./FailedEmail.js";
import PaymentAudit from "./PaymentAudit.js";
import ContactMessage from "./ContactMessage.js";

// Initialize Review model
const Review = initReview(sequelize);

const FailedEmailModel = FailedEmail(sequelize);

// Setup associations
const setupAssociations = () => {
  // User associations
  User.hasMany(Order, { foreignKey: 'user_id', as: 'orders' });
  Order.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  // Category associations
  Category.hasMany(Product, { foreignKey: 'category_id', as: 'products' });
  Product.belongsTo(Category, { foreignKey: 'category_id', as: 'category_relation' });
  
  // Self-referencing category for parent-child relationships
  Category.hasMany(Category, { foreignKey: 'parent_id', as: 'children' });
  Category.belongsTo(Category, { foreignKey: 'parent_id', as: 'parent' });

  // Order associations
  Order.hasMany(OrderItem, { foreignKey: 'order_id', as: 'order_items' });
  OrderItem.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

  // Product associations
  Product.hasMany(OrderItem, { foreignKey: 'product_id', as: 'order_items' });
  OrderItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

  // Review associations
  Product.hasMany(Review, { foreignKey: 'product_id', as: 'reviews' });
  Review.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

  // Stock associations
  Product.hasMany(Stock, { foreignKey: 'product_id', as: 'stock_items' });
  Stock.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
  
  Size.hasMany(Stock, { foreignKey: 'size_id', as: 'stock_items' });
  Stock.belongsTo(Size, { foreignKey: 'size_id', as: 'size' });

  // Payment audit associations
  Order.hasMany(PaymentAudit, { foreignKey: 'order_id', as: 'payment_audits' });
  PaymentAudit.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });
};

// Initialize associations
setupAssociations();

export {
  sequelize,
  User,
  Product,
  Category,
  Order,
  OrderItem,
  Review,
  Size,
  Stock,
  WebsiteSetting,
  FailedEmailModel,
  PaymentAudit,
  ContactMessage,
};
