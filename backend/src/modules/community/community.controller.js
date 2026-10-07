const {
  createCommunity,
  getCommunityById,
  updateCommunity,
} = require('./community.service');

const {
  validateCreateCommunityInput,
  validateUpdateCommunityInput,
} = require('./community.validation');

async function create(req, res, next) {
  try {
    const data = validateCreateCommunityInput(req.body);

    const community = await createCommunity({
      userId: req.user.id,
      ...data,
    });

    return res.status(201).json({
      success: true,
      message: 'Community created successfully',
      data: community,
    });
  } catch (error) {
    next(error);
  }
}

async function getById(req, res, next) {
  try {
    const community = await getCommunityById(req.params.communityId);

    return res.status(200).json({
      success: true,
      data: {
        community,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const updates = validateUpdateCommunityInput(req.body);

    const community = await updateCommunity(
      req.params.communityId,
      updates,
    );

    return res.status(200).json({
      success: true,
      message: 'Community updated successfully',
      data: {
        community,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  create,
  getById,
  update,
};
