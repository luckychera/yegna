const {
  listMyMembershipCards,
  verifyMembershipCard,
  regenerateCardCode,
} = require('./membership-card.service');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function listMine(req, res, next) {
  try {
    const cards = await listMyMembershipCards(req.user.id);

    return res.status(200).json({
      success: true,
      data: { cards },
    });
  } catch (error) {
    return next(error);
  }
}

async function verify(req, res, next) {
  try {
    const card = await verifyMembershipCard(req.params.code);

    // Verification results must reflect the current membership status.
    res.set('Cache-Control', 'no-store');

    return res.status(200).json({
      success: true,
      data: { card },
    });
  } catch (error) {
    return next(error);
  }
}

async function regenerate(req, res, next) {
  try {
    const { membershipId } = req.params;

    if (!UUID_PATTERN.test(membershipId)) {
      const error = new Error('Membership ID must be a valid UUID');
      error.statusCode = 400;
      error.code = 'INVALID_MEMBERSHIP_ID';
      throw error;
    }

    const card = await regenerateCardCode(req.user.id, membershipId);

    return res.status(200).json({
      success: true,
      message: 'A new card verification code was issued. The previous QR code no longer works.',
      data: { card },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listMine,
  verify,
  regenerate,
};
