const {
  listContributions,
  getContributionById,
  createContribution,
  updateContribution,
  changeContributionStatus,
} = require('./contribution.service');

const {
  validateCreateContributionInput,
  validateUpdateContributionInput,
  validateContributionId,
} = require('./contribution.validation');

const { CONTRIBUTION_STATUS } = require('./contribution.constants');

async function list(req, res, next) {
  try {
    const contributions = await listContributions(req.params.communityId);

    return res.status(200).json({
      success: true,
      data: {
        contributions,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function getById(req, res, next) {
  try {
    const contributionId = validateContributionId(req.params.contributionId);

    const contribution = await getContributionById(req.params.communityId, contributionId);

    return res.status(200).json({
      success: true,
      data: {
        contribution,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const data = validateCreateContributionInput(req.body);

    const contribution = await createContribution({
      communityId: req.params.communityId,
      actorUserId: req.user.id,
      ...data,
    });

    return res.status(201).json({
      success: true,
      message: 'Contribution created successfully',
      data: {
        contribution,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const contributionId = validateContributionId(req.params.contributionId);
    const updates = validateUpdateContributionInput(req.body);

    const contribution = await updateContribution(
      req.params.communityId,
      contributionId,
      updates,
      req.user.id,
    );

    return res.status(200).json({
      success: true,
      message: 'Contribution updated successfully',
      data: {
        contribution,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function waive(req, res, next) {
  try {
    const contributionId = validateContributionId(req.params.contributionId);

    const contribution = await changeContributionStatus(
      req.params.communityId,
      contributionId,
      CONTRIBUTION_STATUS.WAIVED,
      req.user.id,
    );

    return res.status(200).json({
      success: true,
      message: 'Contribution waived successfully',
      data: {
        contribution,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function cancel(req, res, next) {
  try {
    const contributionId = validateContributionId(req.params.contributionId);

    const contribution = await changeContributionStatus(
      req.params.communityId,
      contributionId,
      CONTRIBUTION_STATUS.CANCELLED,
      req.user.id,
    );

    return res.status(200).json({
      success: true,
      message: 'Contribution cancelled successfully',
      data: {
        contribution,
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
  waive,
  cancel,
};
