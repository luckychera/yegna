const {
  createInvitation,
  getInvitationById,
  listInvitations,
  acceptInvitation,
  rejectInvitation,
  revokeInvitation,
  listMyInvitations,
} = require('./invitation.service');

const {
  validateInvitationId,
  validateListMyInvitationsQuery,
} = require('./invitation.validation');
const { buildPagination } = require('../../utils/pagination');

function getRequestContext(req) {
  return {
    ipAddress: req.ip || null,
    userAgent: req.get('user-agent') || null,
  };
}

async function create(req, res, next) {
  try {
    const { communityId } = req.params;
    const { invitedUserId, metadata } = req.body;

    const invitation = await createInvitation({
      communityId,
      inviterUserId: req.user.id,
      invitedUserId,
      metadata,
      ...getRequestContext(req),
    });

    return res.status(201).json({
      success: true,
      data: invitation,
    });
  } catch (error) {
    return next(error);
  }
}

async function list(req, res, next) {
  try {
    const { communityId } = req.params;
    const { status } = req.query;

    const invitations = await listInvitations(communityId, status);

    return res.status(200).json({
      success: true,
      data: invitations,
    });
  } catch (error) {
    return next(error);
  }
}

async function getById(req, res, next) {
  try {
    const { communityId, invitationId } = req.params;

    validateInvitationId(invitationId);

    const invitation = await getInvitationById(communityId, invitationId);

    return res.status(200).json({
      success: true,
      data: invitation,
    });
  } catch (error) {
    return next(error);
  }
}

async function accept(req, res, next) {
  try {
    const { invitationToken } = req.body;

    const result = await acceptInvitation({
      invitationToken,
      invitedUserId: req.user.id,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

async function reject(req, res, next) {
  try {
    const { invitationId } = req.params;

    validateInvitationId(invitationId);

    const invitation = await rejectInvitation(
      invitationId,
      req.user.id,
    );

    return res.status(200).json({
      success: true,
      data: invitation,
    });
  } catch (error) {
    return next(error);
  }
}

async function revoke(req, res, next) {
  try {
    const { communityId, invitationId } = req.params;

    validateInvitationId(invitationId);

    // communityId scopes the revoke to the community the permission was checked for.
    const invitation = await revokeInvitation(invitationId, req.user.id, communityId);

    return res.status(200).json({
      success: true,
      data: invitation,
    });
  } catch (error) {
    return next(error);
  }
}

async function listMine(req, res, next) {
  try {
    const query = validateListMyInvitationsQuery(req.query);

    const { invitations, total } = await listMyInvitations({
      userId: req.user.id,
      ...query,
    });

    return res.status(200).json({
      success: true,
      data: {
        invitations,
      },
      pagination: buildPagination({
        limit: query.limit,
        offset: query.offset,
        count: invitations.length,
        total,
      }),
    });
  } catch (error) {
    return next(error);
  }
}

async function acceptById(req, res, next) {
  try {
    const { invitationId } = req.params;

    validateInvitationId(invitationId);

    const result = await acceptInvitation({
      invitationId,
      invitedUserId: req.user.id,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listMine,
  acceptById,

  create,
  list,
  getById,
  accept,
  reject,
  revoke,
};
