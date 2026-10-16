import { Review, Product } from '../models/index.js';
import { Op } from 'sequelize';

// Create a new review
export const createReview = async (req, res) => {
  try {
    const { product_id, customer_name, rating, comment, email, review_images } = req.body;

    // Validate required fields
    if (!product_id || !customer_name || !rating || !comment) {
      return res.status(400).json({ 
        error: 'Missing required fields: product_id, customer_name, rating, comment' 
      });
    }

    // Validate rating range
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ 
        error: 'Rating must be between 1 and 5' 
      });
    }

    // Check if product exists
    const product = await Product.findByPk(product_id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Create the review
    const review = await Review.create({
      product_id,
      customer_name,
      rating,
      comment,
      email: email || null,
      review_images: review_images || []
    });

    res.status(201).json({
      message: 'Review created successfully',
      review
    });

  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ 
      error: 'Failed to create review',
      details: error.message 
    });
  }
};

// Get all reviews for a product
export const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;

    const reviews = await Review.findAll({
      where: {
        product_id: productId,
        status: 'approved' // Only show approved reviews
      },
      order: [['created_at', 'DESC']]
    });

    // Calculate average rating
    const avgRating = await Review.findOne({
      where: {
        product_id: productId,
        status: 'approved'
      },
      attributes: [
        [Review.sequelize.fn('AVG', Review.sequelize.col('rating')), 'averageRating'],
        [Review.sequelize.fn('COUNT', Review.sequelize.col('id')), 'totalReviews']
      ],
      raw: true
    });

    res.json({
      reviews,
      averageRating: parseFloat(avgRating?.averageRating || 0).toFixed(1),
      totalReviews: parseInt(avgRating?.totalReviews || 0)
    });

  } catch (error) {
    console.error('Error fetching product reviews:', error);
    res.status(500).json({ 
      error: 'Failed to fetch reviews',
      details: error.message 
    });
  }
};

// Get all reviews (for admin)
export const getAllReviews = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, rating } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (status) whereClause.status = status;
    if (rating) whereClause.rating = rating;

    const reviews = await Review.findAndCountAll({
      where: whereClause,
      include: [{
        model: Product,
        as: 'product',
        attributes: ['id', 'name']
      }],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      reviews: reviews.rows,
      total: reviews.count,
      page: parseInt(page),
      totalPages: Math.ceil(reviews.count / limit)
    });

  } catch (error) {
    console.error('Error fetching all reviews:', error);
    res.status(500).json({ 
      error: 'Failed to fetch reviews',
      details: error.message 
    });
  }
};

// Update review status (for admin)
export const updateReviewStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const review = await Review.findByPk(id);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    await review.update({ 
      status,
      is_approved: status === 'approved'
    });

    res.json({
      message: 'Review status updated successfully',
      review
    });

  } catch (error) {
    console.error('Error updating review status:', error);
    res.status(500).json({ 
      error: 'Failed to update review status',
      details: error.message 
    });
  }
};

// Delete a review (for admin)
export const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;

    const review = await Review.findByPk(id);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    await review.destroy();

    res.json({
      message: 'Review deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ 
      error: 'Failed to delete review',
      details: error.message 
    });
  }
};
