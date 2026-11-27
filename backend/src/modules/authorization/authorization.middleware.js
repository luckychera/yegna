const { getUserCommunityAuthorization } = require('./authorization.service');
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function deny(res, status, code, message) {
  res.status(status).json({
    success: false,
    error: { code, message },
  });

  return null;
}

// Resolves the caller's active membership in req.params.communityId, or sends
// the error response and returns null.
async function resolveCommunityAuthorization(req, res) {
  if (!req.user || !req.user.id) {
    return deny(res, 401, 'AUTHENTICATION_REQUIRED', 'Authentication is required');
  }

  const { communityId } = req.params;

  if (!communityId) {
    return deny(res, 400, 'COMMUNITY_ID_REQUIRED', 'Community ID is required');
  }

  if (!UUID_REGEX.test(communityId)) {
    return deny(res, 400, 'INVALID_COMMUNITY_ID', 'Community ID must be a valid UUID.');
  }

  const authorization = await getUserCommunityAuthorization(req.user.id, communityId);

  if (!authorization) {
    return deny(res, 403, 'COMMUNITY_ACCESS_DENIED', 'You do not have access to this community');
  }

  return authorization;
}

function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      const authorization = await resolveCommunityAuthorization(req, res);

      if (!authorization) return undefined;

      if (!authorization.permissions.includes(permission)) {
        return deny(res, 403, 'PERMISSION_DENIED', 'You do not have permission to perform this action');
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
      const authorization = await resolveCommunityAuthorization(req, res);

      if (!authorization) return undefined;

      const hasRole = authorization.roles.some((role) => role.name === roleName);

      if (!hasRole) {
        return deny(res, 403, 'ROLE_REQUIRED', 'You do not have the required role');
      }

      req.authorization = authorization;

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

function requireAnyPermission(permissions) {
  return async (req, res, next) => {
    try {
      const authorization = await resolveCommunityAuthorization(req, res);

      if (!authorization) return undefined;

      const allowed = permissions.some((permission) => authorization.permissions.includes(permission));

      if (!allowed) {
        return deny(res, 403, 'PERMISSION_DENIED', 'You do not have permission to perform this action');
      }

      req.authorization = authorization;

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

// Any active member. Announcements stay available to every active member,
// including one whose only role is member.
function requireActiveMembership() {
  return async (req, res, next) => {
    try {
      const authorization = await resolveCommunityAuthorization(req, res);

      if (!authorization) return undefined;

      req.authorization = authorization;

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = {
  requirePermission,
  requireAnyPermission,
  requireRole,
  requireActiveMembership,
};
