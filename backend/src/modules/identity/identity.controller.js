const { getCurrentUserIdentity } = require('./identity.service');

async function getMyIdentity(req, res, next) {
  try {
    const identity = await getCurrentUserIdentity(req.user.id);

    if (!identity) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'IDENTITY_NOT_FOUND',
          message: 'No identity record was found for this account',
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        identity,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMyIdentity,
};
