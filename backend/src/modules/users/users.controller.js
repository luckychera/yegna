const {
  getCurrentUserProfile,
  updateCurrentUserProfile,
} = require('./users.service');

const { validateUpdateProfileInput } = require('./users.validation');

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
async function updateMe(req, res, next) {
  try {
    const updates = validateUpdateProfileInput(req.body);
    const data = await updateCurrentUserProfile(req.user.id, updates);

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getMe,
  updateMe,
};
