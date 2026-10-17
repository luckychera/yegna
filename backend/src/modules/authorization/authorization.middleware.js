const { getUserCommunityAuthorization } = require('./authorization.service');

function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication is required',
          },
        });
      }

      const { communityId } = req.params;

      if (!communityId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'COMMUNITY_ID_REQUIRED',
            message: 'Community ID is required',
          },
        });
      }

      const authorization = await getUserCommunityAuthorization(req.user.id, communityId);

      if (!authorization) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'COMMUNITY_ACCESS_DENIED',
            message: 'You do not have access to this community',
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
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication is required',
          },
        });
      }

      const { communityId } = req.params;

      if (!communityId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'COMMUNITY_ID_REQUIRED',
            message: 'Community ID is required',
          },
        });
      }

      const authorization = await getUserCommunityAuthorization(req.user.id, communityId);

      if (!authorization) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'COMMUNITY_ACCESS_DENIED',
            message: 'You do not have access to this community',
          },
        });
      }

      const hasRole = authorization.roles.some((role) => role.name === roleName);

      if (!hasRole) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ROLE_REQUIRED',
            message: 'You do not have the required role',
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
