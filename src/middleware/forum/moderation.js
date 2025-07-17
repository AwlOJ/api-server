const isAdmin = (req, res, next) => {
    // Assuming 'role' is added to req.user by the auth middleware
    if (req.user && req.user.role === 'admin') {
        return next();
    }
    return res.status(403).json({ success: false, message: 'Permission denied. Admin access required.' });
};

const isModerator = (req, res, next) => {
    // Placeholder for more complex logic, e.g., checking if user moderates a specific category
    if (req.user && (req.user.role === 'admin' || req.user.role === 'moderator')) {
        return next();
    }
    return res.status(403).json({ success: false, message: 'Permission denied. Moderator access required.' });
};

module.exports = {
    isAdmin,
    isModerator,
};
