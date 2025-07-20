const getUserId = (req) => {
  return req.user?.userId || req.userId || req.user?._id || req.user?.id;
};

const getUserRole = (req) => {
  return req.user?.role || 'user';
};

module.exports = {
  getUserId,
  getUserRole
};