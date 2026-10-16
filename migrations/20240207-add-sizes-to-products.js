'use strict';

import { DataTypes } from 'sequelize';

export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('products', 'sizes', {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      comment: 'Array of size objects with size name and quantity'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('products', 'sizes');
  }
};
