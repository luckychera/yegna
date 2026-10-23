const { getCurrentUserProfile } = require('./users.service');

async function getMe(req, res, next) {
  try {
    const data = await getCurrentUserProfile(req.user.id);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getMe,
};
