'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('categories', 'level', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
      after: 'parent_id'
    });

    // Add index for better performance
    await queryInterface.addIndex('categories', ['level']);
    await queryInterface.addIndex('categories', ['parent_id']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('categories', 'level');
  }
};
