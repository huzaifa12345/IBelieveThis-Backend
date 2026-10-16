import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const FailedEmail = sequelize.define('FailedEmail', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    customer_email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    customer_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    order_number: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email_subject: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email_html: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    retry_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    last_retry_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('pending', 'sent', 'failed'),
      defaultValue: 'pending',
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'failed_emails',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  return FailedEmail;
};
