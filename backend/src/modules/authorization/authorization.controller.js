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

async function checkMembersViewAccess(req, res, next) {
  try {
    return res.status(200).json({
      success: true,
      message: 'You have permission to view community members',
      data: {
        communityId: req.params.communityId,
        permission: 'members.view',
        authorization: req.authorization,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMyAuthorization,
  checkMembersViewAccess,
};
