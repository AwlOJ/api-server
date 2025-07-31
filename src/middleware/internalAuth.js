const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || 'your-default-secret';

const internalAuth = (req, res, next) => {
  const secret = req.get('x-internal-secret');
  
  if (!secret || secret !== INTERNAL_API_SECRET) {
    return res.status(403).json({ success: false, message: 'Forbidden: Invalid internal secret' });
  }
  
  next();
};

module.exports = internalAuth;
