const slugify = require('slugify');

/**
 * Generate unique slug for topics/categories
 * @param {String} text - Text to slugify
 * @param {Model} Model - Mongoose model to check uniqueness
 * @returns {String} Unique slug
 */
const generateUniqueSlug = async (text, Model) => {
  let slug = slugify(text, {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@]/g
  });

  // Check if slug exists
  let count = 0;
  let uniqueSlug = slug;

  while (await Model.exists({ slug: uniqueSlug })) {
    count++;
    uniqueSlug = `${slug}-${count}`;
  }

  return uniqueSlug;
};

/**
 * Generate slug from Vietnamese text
 * @param {String} text - Vietnamese text
 * @returns {String} Slug
 */
const generateVietnameseSlug = (text) => {
  // Remove Vietnamese accents
  const from = 'àáäâèéëêìíïîòóöôùúüûñç·/_,:;';
  const to   = 'aaaaeeeeiiiioooouuuunc------';
  const vietnameseMap = {
    'à': 'a', 'á': 'a', 'ạ': 'a', 'ả': 'a', 'ã': 'a',
    'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ậ': 'a', 'ẩ': 'a', 'ẫ': 'a',
    'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ặ': 'a', 'ẳ': 'a', 'ẵ': 'a',
    'è': 'e', 'é': 'e', 'ẹ': 'e', 'ẻ': 'e', 'ẽ': 'e',
    'ê': 'e', 'ề': 'e', 'ế': 'e', 'ệ': 'e', 'ể': 'e', 'ễ': 'e',
    'ì': 'i', 'í': 'i', 'ị': 'i', 'ỉ': 'i', 'ĩ': 'i',
    'ò': 'o', 'ó': 'o', 'ọ': 'o', 'ỏ': 'o', 'õ': 'o',
    'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ộ': 'o', 'ổ': 'o', 'ỗ': 'o',
    'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ợ': 'o', 'ở': 'o', 'ỡ': 'o',
    'ù': 'u', 'ú': 'u', 'ụ': 'u', 'ủ': 'u', 'ũ': 'u',
    'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ự': 'u', 'ử': 'u', 'ữ': 'u',
    'ỳ': 'y', 'ý': 'y', 'ỵ': 'y', 'ỷ': 'y', 'ỹ': 'y',
    'đ': 'd', 'Đ': 'd'
  };

  let processedText = text.toLowerCase();
  
  // Replace Vietnamese characters
  for (let [viet, latin] of Object.entries(vietnameseMap)) {
    processedText = processedText.replace(new RegExp(viet, 'g'), latin);
  }

  return slugify(processedText, {
    lower: true,
    strict: true
  });
};

module.exports = {
  generateUniqueSlug,
  generateVietnameseSlug
};