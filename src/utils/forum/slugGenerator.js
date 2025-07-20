const slugify = require('slugify');

/**
 * Generate a unique slug, handling both creation and updates.
 * @param {mongoose.Model} Model - The Mongoose model to check for uniqueness.
 * @param {string} text - The text to slugify.
 * @param {mongoose.Types.ObjectId} [docId=null] - The ID of the document being saved, to exclude it from the uniqueness check during updates.
 * @returns {Promise<string>} A promise that resolves to a unique slug.
 */
const generateUniqueSlug = async (Model, text, docId = null) => {
  const baseSlug = generateVietnameseSlug(text); // Use the Vietnamese helper for all slugs

  let slug = baseSlug;
  let count = 0;

  // Base query to find a conflicting slug
  const query = { slug: slug };

  // If we are updating a document, exclude its own _id from the search
  if (docId) {
    query._id = { $ne: docId };
  }
  
  // Keep searching for a unique slug by appending a number if needed
  while (await Model.exists(query)) {
    count++;
    slug = `${baseSlug}-${count}`;
    query.slug = slug;
  }

  return slug;
};

/**
 * Generate slug from Vietnamese text (and other text).
 * This function now serves as the primary base slug generator.
 * @param {String} text - Text to slugify
 * @returns {String} Slug
 */
const generateVietnameseSlug = (text) => {
  const vietnameseMap = {
    'à': 'a', 'á': 'a', 'ạ': 'a', 'ả': 'a', 'ã': 'a', 'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ậ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ặ': 'a', 'ẳ': 'a', 'ẵ': 'a',
    'è': 'e', 'é': 'e', 'ẹ': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ê': 'e', 'ề': 'e', 'ế': 'e', 'ệ': 'e', 'ể': 'e', 'ễ': 'e',
    'ì': 'i', 'í': 'i', 'ị': 'i', 'ỉ': 'i', 'ĩ': 'i',
    'ò': 'o', 'ó': 'o', 'ọ': 'o', 'ỏ': 'o', 'õ': 'o', 'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ộ': 'o', 'ổ': 'o', 'ỗ': 'o', 'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ợ': 'o', 'ở': 'o', 'ỡ': 'o',
    'ù': 'u', 'ú': 'u', 'ụ': 'u', 'ủ': 'u', 'ũ': 'u', 'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ự': 'u', 'ử': 'u', 'ữ': 'u',
    'ỳ': 'y', 'ý': 'y', 'ỵ': 'y', 'ỷ': 'y', 'ỹ': 'y',
    'đ': 'd', 'Đ': 'd'
  };

  let processedText = text.toLowerCase();
  
  for (let [viet, latin] of Object.entries(vietnameseMap)) {
    processedText = processedText.replace(new RegExp(viet, 'g'), latin);
  }

  return slugify(processedText, {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@]/g
  });
};

module.exports = {
  generateUniqueSlug,
  generateVietnameseSlug, // Exporting it is fine, though it's mainly used internally now
};