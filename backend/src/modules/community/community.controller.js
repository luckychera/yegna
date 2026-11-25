const {
  createCommunity,
  getCommunityById,
  updateCommunity,
  listCommunities,
  listMyCommunities,
} = require('./community.service');

const {
  validateCreateCommunityInput,
  validateUpdateCommunityInput,
  validateListCommunitiesQuery,
  validateListMyCommunitiesQuery,
} = require('./community.validation');
const { buildPagination } = require('../../utils/pagination');

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

async function list(req, res, next) {
  try {
    const query = validateListCommunitiesQuery(req.query);

    const { communities, total } = await listCommunities({
      userId: req.user.id,
      ...query,
    });

    return res.status(200).json({
      success: true,
      data: {
        communities,
      },
      pagination: buildPagination({
        limit: query.limit,
        offset: query.offset,
        count: communities.length,
        total,
      }),
    });
  } catch (error) {
    next(error);
  }
}

async function listMine(req, res, next) {
  try {
    const query = validateListMyCommunitiesQuery(req.query);

    const { memberships, total } = await listMyCommunities({
      userId: req.user.id,
      ...query,
    });

    return res.status(200).json({
      success: true,
      data: {
        memberships,
      },
      pagination: buildPagination({
        limit: query.limit,
        offset: query.offset,
        count: memberships.length,
        total,
      }),
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  list,
  listMine,
  create,
  getById,
  update,
};
