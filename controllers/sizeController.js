import { Size } from '../models/index.js';
import { Op } from 'sequelize';

// Get all sizes
const getSizes = async (req, res) => {
  try {
    const sizes = await Size.findAll({
      order: [['size', 'ASC']]
    });
    res.json(sizes);
  } catch (error) {
    console.error('Error fetching sizes:', error);
    res.status(500).json({ error: 'Failed to fetch sizes' });
  }
};

// Create new size
const createSize = async (req, res) => {
  try {
    const { size, description } = req.body;
    
    if (!size || size.trim() === '') {
      return res.status(400).json({ error: 'Size name is required' });
    }
    
    // Check if size already exists
    const existingSize = await Size.findOne({ where: { size } });
    if (existingSize) {
      return res.status(400).json({ error: 'Size already exists' });
    }
    
    const newSize = await Size.create({
      size: size.trim(),
      description: description || null
    });
    
    res.status(201).json({ 
      id: newSize.id,
      size: newSize.size,
      description: newSize.description,
      message: 'Size created successfully'
    });
  } catch (error) {
    console.error('Error creating size:', error);
    res.status(500).json({ error: 'Failed to create size' });
  }
};

// Update size
const updateSize = async (req, res) => {
  try {
    const { id } = req.params;
    const { size, description } = req.body;
    
    if (!size || size.trim() === '') {
      return res.status(400).json({ error: 'Size name is required' });
    }
    
    // Check if size name already exists (excluding current size)
    const existingSize = await Size.findOne({ 
      where: { 
        size: size.trim(),
        id: { [Op.ne]: id }
      }
    });
    if (existingSize) {
      return res.status(400).json({ error: 'Size already exists' });
    }
    
    const [updatedRows] = await Size.update(
      {
        size: size.trim(),
        description: description || null
      },
      {
        where: { id }
      }
    );
    
    if (updatedRows === 0) {
      return res.status(404).json({ error: 'Size not found' });
    }
    
    res.json({ message: 'Size updated successfully' });
  } catch (error) {
    console.error('Error updating size:', error);
    res.status(500).json({ error: 'Failed to update size' });
  }
};

// Delete size
const deleteSize = async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedRows = await Size.destroy({
      where: { id }
    });
    
    if (deletedRows === 0) {
      return res.status(404).json({ error: 'Size not found' });
    }
    
    res.json({ message: 'Size deleted successfully' });
  } catch (error) {
    console.error('Error deleting size:', error);
    res.status(500).json({ error: 'Failed to delete size' });
  }
};

export {
  getSizes,
  createSize,
  updateSize,
  deleteSize
};
