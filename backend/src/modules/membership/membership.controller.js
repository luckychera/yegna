const {
  listMembers,
  getMembershipById,
  createMembership,
  updateMembership,
  changeMembershipStatus,
} = require('./membership.service');

const {
  validateCreateMembershipInput,
  validateUpdateMembershipInput,
  validateMembershipId,
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
      ...data,
    });

    return res.status(201).json({
      success: true,
      message: 'Membership created successfully',
      data: {
        membership,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const membershipId = validateMembershipId(req.params.membershipId);

    const updates = validateUpdateMembershipInput(req.body);

    const membership = await updateMembership(req.params.communityId, membershipId, updates);

    return res.status(200).json({
      success: true,
      message: 'Membership updated successfully',
      data: {
        membership,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function approve(req, res, next) {
  try {
    const membershipId = validateMembershipId(req.params.membershipId);

    const membership = await changeMembershipStatus(req.params.communityId, membershipId, 'active');

    return res.status(200).json({
      success: true,
      message: 'Membership approved successfully',
      data: {
        membership,
      },
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
    );

    return res.status(200).json({
      success: true,
      message: 'Membership rejected successfully',
      data: {
        membership,
      },
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
    );

    return res.status(200).json({
      success: true,
      message: 'Membership suspended successfully',
      data: {
        membership,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    const membershipId = validateMembershipId(req.params.membershipId);

    const membership = await changeMembershipStatus(req.params.communityId, membershipId, 'left');

    return res.status(200).json({
      success: true,
      message: 'Membership removed successfully',
      data: {
        membership,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  approve,
  reject,
  suspend,
  remove,
};
