const { getUserCommunityAuthorization } = require('../modules/authorization/authorization.service');

function getCommunityId(req) {
  return req.params.communityId || req.body.communityId || req.query.communityId;
}

function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication is required',
          },
        });
      }

      const communityId = getCommunityId(req);

      if (!communityId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'COMMUNITY_ID_REQUIRED',
            message: 'Community ID is required for this operation',
          },
        });
      }

      const authorization = await getUserCommunityAuthorization(req.user.id, communityId);

      if (!authorization.membershipId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'COMMUNITY_ACCESS_DENIED',
            message: 'You are not an active member of this community',
          },
        });
      }

      if (!authorization.permissions.includes(permission)) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'You do not have permission to perform this action',
          },
        });
      }

      req.authorization = authorization;

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

function requireRole(roleName) {
  return async (req, res, next) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication is required',
          },
        });
      }

      const communityId = getCommunityId(req);

      if (!communityId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'COMMUNITY_ID_REQUIRED',
            message: 'Community ID is required for this operation',
          },
        });
      }

      const authorization = await getUserCommunityAuthorization(req.user.id, communityId);

      if (!authorization.membershipId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'COMMUNITY_ACCESS_DENIED',
            message: 'You are not an active member of this community',
          },
        });
      }

      const hasRole = authorization.roles.some((role) => role.name === roleName);

      if (!hasRole) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ROLE_REQUIRED',
            message: `The ${roleName} role is required for this action`,
          },
        });
      }

      req.authorization = authorization;

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = {
  requirePermission,
  requireRole,
};
