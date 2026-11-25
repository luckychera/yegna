const service = require('./announcement.service');
const { validateAnnouncementId, validateAnnouncementInput } = require('./announcement.validation');

function parseLimit(value, fallback, max) {
  if (value === undefined) return fallback;

  const number = Number(value);

  if (!Number.isInteger(number) || number < 1 || number > max) {
    const error = new Error(`limit must be between 1 and ${max}`);
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  return number;
}

function parseOffset(value) {
  if (value === undefined) return 0;

  const number = Number(value);

  if (!Number.isInteger(number) || number < 0) {
    const error = new Error('offset must be a non-negative integer');
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  return number;
}

function requestContext(req) {
  return {
    userId: req.user.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent') || null,
  };
}

async function list(req, res, next) {
  try {
    const limit = parseLimit(req.query.limit, 20, 100);
    const offset = parseOffset(req.query.offset);

    const { announcements, unreadCount } = await service.listCommunityAnnouncements({
      communityId: req.params.communityId,
      userId: req.user.id,
      limit,
      offset,
    });

    return res.status(200).json({
      success: true,
      data: { announcements, unreadCount },
      pagination: { limit, offset, count: announcements.length },
    });
  } catch (error) {
    return next(error);
  }
}

async function listMine(req, res, next) {
  try {
    const limit = parseLimit(req.query.limit, 5, 20);
    const announcements = await service.listMyAnnouncements({ userId: req.user.id, limit });

    return res.status(200).json({
      success: true,
      data: { announcements },
    });
  } catch (error) {
    return next(error);
  }
}

async function getById(req, res, next) {
  try {
    const announcement = await service.getAnnouncement({
      communityId: req.params.communityId,
      announcementId: validateAnnouncementId(req.params.announcementId),
      userId: req.user.id,
    });

    return res.status(200).json({
      success: true,
      data: { announcement },
    });
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const input = validateAnnouncementInput(req.body);

    const { announcement, notifiedMembers } = await service.createAnnouncement({
      communityId: req.params.communityId,
      input,
      ...requestContext(req),
    });

    return res.status(201).json({
      success: true,
      message: 'Announcement published',
      data: { announcement, notifiedMembers },
    });
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const announcementId = validateAnnouncementId(req.params.announcementId);
    const input = validateAnnouncementInput(req.body, { partial: true });

    const announcement = await service.updateAnnouncement({
      communityId: req.params.communityId,
      announcementId,
      input,
      ...requestContext(req),
    });

    return res.status(200).json({
      success: true,
      message: 'Announcement updated',
      data: { announcement },
    });
  } catch (error) {
    return next(error);
  }
}

async function archive(req, res, next) {
  try {
    await service.archiveAnnouncement({
      communityId: req.params.communityId,
      announcementId: validateAnnouncementId(req.params.announcementId),
      ...requestContext(req),
    });

    return res.status(200).json({
      success: true,
      message: 'Announcement removed',
    });
  } catch (error) {
    return next(error);
  }
}

async function markRead(req, res, next) {
  try {
    await service.markAnnouncementRead({
      communityId: req.params.communityId,
      announcementId: validateAnnouncementId(req.params.announcementId),
      userId: req.user.id,
    });

    return res.status(200).json({
      success: true,
      data: { read: true },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  list,
  listMine,
  getById,
  create,
  update,
  archive,
  markRead,
};
