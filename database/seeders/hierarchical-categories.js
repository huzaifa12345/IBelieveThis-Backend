'use strict';

import Category from '../../models/Category.js';

export const up = async () => {
  try {
    console.log('Creating hierarchical category structure...');

    // Level 1: Seasons
    const winter = await Category.create({
      name: 'Winter',
      description: 'Winter collection for kids',
      level: 1,
      sort_order: 1,
      is_active: true
    });

    const summer = await Category.create({
      name: 'Summer',
      description: 'Summer collection for kids',
      level: 1,
      sort_order: 2,
      is_active: true
    });

    // Level 2: Gender under Winter
    const winterBoys = await Category.create({
      name: 'Boys',
      description: 'Winter collection for boys',
      parent_id: winter.id,
      level: 2,
      sort_order: 1,
      is_active: true
    });

    const winterGirls = await Category.create({
      name: 'Girls',
      description: 'Winter collection for girls',
      parent_id: winter.id,
      level: 2,
      sort_order: 2,
      is_active: true
    });

    // Level 2: Gender under Summer
    const summerBoys = await Category.create({
      name: 'Boys',
      description: 'Summer collection for boys',
      parent_id: summer.id,
      level: 2,
      sort_order: 1,
      is_active: true
    });

    const summerGirls = await Category.create({
      name: 'Girls',
      description: 'Summer collection for girls',
      parent_id: summer.id,
      level: 2,
      sort_order: 2,
      is_active: true
    });

    // Level 3: Custom categories under Winter Boys
    await Category.create({
      name: 'Fashion Collection',
      description: 'Fashion items for winter boys',
      parent_id: winterBoys.id,
      level: 3,
      sort_order: 1,
      is_active: true
    });

    await Category.create({
      name: 'School Wear',
      description: 'School uniforms and wear for winter boys',
      parent_id: winterBoys.id,
      level: 3,
      sort_order: 2,
      is_active: true
    });

    // Level 3: Custom categories under Winter Girls
    await Category.create({
      name: 'Fashion Collection',
      description: 'Fashion items for winter girls',
      parent_id: winterGirls.id,
      level: 3,
      sort_order: 1,
      is_active: true
    });

    await Category.create({
      name: 'Party Wear',
      description: 'Party dresses for winter girls',
      parent_id: winterGirls.id,
      level: 3,
      sort_order: 2,
      is_active: true
    });

    // Level 3: Custom categories under Summer Boys
    await Category.create({
      name: 'Beach Wear',
      description: 'Beach wear for summer boys',
      parent_id: summerBoys.id,
      level: 3,
      sort_order: 1,
      is_active: true
    });

    await Category.create({
      name: 'Sports Wear',
      description: 'Sports wear for summer boys',
      parent_id: summerBoys.id,
      level: 3,
      sort_order: 2,
      is_active: true
    });

    // Level 3: Custom categories under Summer Girls
    await Category.create({
      name: 'Casual Wear',
      description: 'Casual wear for summer girls',
      parent_id: summerGirls.id,
      level: 3,
      sort_order: 1,
      is_active: true
    });

    await Category.create({
      name: 'Party Wear',
      description: 'Party dresses for summer girls',
      parent_id: summerGirls.id,
      level: 3,
      sort_order: 2,
      is_active: true
    });

    console.log('Hierarchical category structure created successfully!');
  } catch (error) {
    console.error('Error creating category structure:', error);
  }
};

export const down = async () => {
  try {
    console.log('Removing hierarchical category structure...');
    
    // Remove all categories
    await Category.destroy({ where: {} });
    
    console.log('Category structure removed successfully!');
  } catch (error) {
    console.error('Error removing category structure:', error);
  }
};
