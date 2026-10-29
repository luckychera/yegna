const {
  listMembers,
  getMembershipById,
  createMembership,
  updateMembership,
  changeMembershipStatus,
  joinCommunity,
  leaveCommunity,
} = require('./membership.service');

const {
  validateCreateMembershipInput,
  validateUpdateMembershipInput,
  validateMembershipId,
  validateCommunityId,
} = require('./membership.validation');

async function list(req, res, next) {
  try {
    const members = await listMembers(req.params.communityId);

    return res.status(200).json({
      success: true,
      data: {
        members,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function getById(req, res, next) {
  try {
    const membershipId = validateMembershipId(req.params.membershipId);

    const membership = await getMembershipById(req.params.communityId, membershipId);

    return res.status(200).json({
      success: true,
      data: {
        membership,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const data = validateCreateMembershipInput(req.body);

    const membership = await createMembership({
      communityId: req.params.communityId,
      actorUserId: req.user.id,
      ...data,
    });

    return res.status(201).json({
      success: true,
      message: 'Membership created successfully',
      data: { membership },
    });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const membershipId = validateMembershipId(req.params.membershipId);
    const updates = validateUpdateMembershipInput(req.body);

    const membership = await updateMembership(
      req.params.communityId,
      membershipId,
      updates,
      req.user.id,
    );

    return res.status(200).json({
      success: true,
      message: 'Membership updated successfully',
      data: { membership },
    });
  } catch (error) {
    next(error);
  }
}

async function approve(req, res, next) {
  try {
    const membershipId = validateMembershipId(req.params.membershipId);

    const membership = await changeMembershipStatus(
      req.params.communityId,
      membershipId,
      'active',
      req.user.id,
    );

    return res.status(200).json({
      success: true,
      message: 'Membership approved successfully',
      data: { membership },
    });
  } catch (error) {
    next(error);
  }
}

async function reject(req, res, next) {
  try {
    const membershipId = validateMembershipId(req.params.membershipId);

    const membership = await changeMembershipStatus(
      req.params.communityId,
      membershipId,
      'rejected',
      req.user.id,
    );

    return res.status(200).json({
      success: true,
      message: 'Membership rejected successfully',
      data: { membership },
    });
  } catch (error) {
    next(error);
  }
}

async function suspend(req, res, next) {
  try {
    const membershipId = validateMembershipId(req.params.membershipId);

    const membership = await changeMembershipStatus(
      req.params.communityId,
      membershipId,
      'suspended',
      req.user.id,
    );

    return res.status(200).json({
      success: true,
      message: 'Membership suspended successfully',
      data: { membership },
    });
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    const membershipId = validateMembershipId(req.params.membershipId);

    const membership = await changeMembershipStatus(
      req.params.communityId,
      membershipId,
      'left',
      req.user.id,
    );

    return res.status(200).json({
      success: true,
      message: 'Membership removed successfully',
      data: { membership },
    });
  } catch (error) {
    next(error);
  }
}

function toSelfMembership(row) {
  return {
    id: row.id,
    communityId: row.community_id,
    status: row.status,
    membershipNumber: row.membership_number,
    joinedAt: row.joined_at,
    approvedAt: row.approved_at,
    leftAt: row.left_at,
    createdAt: row.created_at,
  };
}

async function join(req, res, next) {
  try {
    const communityId = validateCommunityId(req.params.communityId);

    const membership = await joinCommunity({
      communityId,
      userId: req.user.id,
    });

    return res.status(201).json({
      success: true,
      message:
        membership.status === 'active'
          ? 'You have joined the community'
          : 'Your request to join has been submitted',
      data: {
        membership: toSelfMembership(membership),
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function leave(req, res, next) {
  try {
    const communityId = validateCommunityId(req.params.communityId);

    const membership = await leaveCommunity({
      communityId,
      userId: req.user.id,
    });

    return res.status(200).json({
      success: true,
      message: 'You have left the community',
      data: {
        membership: toSelfMembership(membership),
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  join,
  leave,

  list,
  getById,
  create,
  update,
  approve,
  reject,
  suspend,
  remove,
};
