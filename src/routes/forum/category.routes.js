const express = require('express');
const router = express.Router();
const { getCategories, getCategoryBySlug, createCategory } = require('../../controllers/forum/category.controller');
const { auth } = require('../../middleware/auth');
const { isAdmin } = require('../../middleware/forum/moderation');

router.get('/', getCategories);
router.get('/:slug', getCategoryBySlug);
router.post('/', auth, isAdmin, createCategory);

module.exports = router;
