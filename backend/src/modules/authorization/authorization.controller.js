const { getUserAuthorization } = require('./authorization.service');

async function getMyAuthorization(req, res, next) {
  try {
    const authorization = await getUserAuthorization(req.user.id);

    return res.status(200).json({
      success: true,
      data: {
        communities: authorization,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMyAuthorization,
};
