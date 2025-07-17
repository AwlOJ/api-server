const Category = require('../../models/forum/Category');

// GET /api/forum/categories
const getCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ order: 1 });
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// GET /api/forum/categories/:slug
const getCategoryBySlug = async (req, res) => {
    try {
        const category = await Category.findOne({ slug: req.params.slug });
        if (!category) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }
        res.json({ success: true, data: category });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};


// POST /api/forum/categories
const createCategory = async (req, res) => {
  try {
    const { name, description, icon, color, order } = req.body;
    const newCategory = new Category({ name, description, icon, color, order });
    await newCategory.save();
    res.status(201).json({ success: true, data: newCategory });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

module.exports = {
  getCategories,
  getCategoryBySlug,
  createCategory,
};
