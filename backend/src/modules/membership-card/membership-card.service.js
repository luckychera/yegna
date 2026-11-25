const { pool } = require('../../config/database');
const { getUserAuthorization } = require('../authorization/authorization.service');

const CARD_CODE_PATTERN = /^[2-9A-HJKMNP-Z]{24}$/;

function createCardError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

// Name printed on a card and shown to whoever scans it: the member's chosen
// display name, otherwise first name and last initial. Never contact details.
function publicHolderName(row) {
  const displayName = row.display_name && row.display_name.trim();

  if (displayName) {
    return displayName;
  }

  const first = (row.first_name || '').trim();
  const lastInitial = (row.last_name || '').trim().charAt(0);

  return [first, lastInitial ? `${lastInitial}.` : ''].filter(Boolean).join(' ') || 'Yegna member';
}

function fullHolderName(row) {
  const displayName = row.display_name && row.display_name.trim();

  if (displayName) {
    return displayName;
  }

  return [row.first_name, row.last_name].filter((part) => part && part.trim()).join(' ') || 'Yegna member';
}

/** Cards for the caller's active memberships, including their private verification codes. */
async function listMyMembershipCards(userId) {
  const result = await pool.query(
    `
      SELECT
        cm.id AS membership_id,
        cm.membership_number,
        cm.status,
        cm.joined_at,
        cm.approved_at,
        cm.card_verification_code,
        c.id AS community_id,
        c.name AS community_name,
        c.community_type,
        c.logo_url,
        up.first_name,
        up.last_name,
        up.display_name,
        up.avatar_url
      FROM community_memberships cm
      JOIN communities c
        ON c.id = cm.community_id
       AND c.archived_at IS NULL
      LEFT JOIN user_profiles up
        ON up.user_id = cm.user_id
      WHERE cm.user_id = $1
        AND cm.status = 'active'
      ORDER BY cm.joined_at ASC NULLS LAST, cm.created_at ASC;
    `,
    [userId],
  );

  const authorizations = await getUserAuthorization(userId);
  const rolesByCommunity = new Map(
    authorizations.map((authorization) => [authorization.communityId, authorization.roles]),
  );

  return result.rows.map((row) => ({
    membershipId: row.membership_id,
    membershipNumber: row.membership_number,
    status: row.status,
    joinedAt: row.joined_at,
    issuedAt: row.approved_at || row.joined_at,
    verificationCode: row.card_verification_code,
    roles: (rolesByCommunity.get(row.community_id) || []).map((role) => role.name),
    community: {
      id: row.community_id,
      name: row.community_name,
      communityType: row.community_type,
      logoUrl: row.logo_url,
    },
    holder: {
      name: fullHolderName(row),
      avatarUrl: row.avatar_url,
    },
  }));
}

/**
 * Public card check used by the QR code. Knowing the 24-character code is the
 * only credential, so the response is deliberately minimal and never includes
 * contact details, identity data or internal IDs.
 */
async function verifyMembershipCard(code) {
  if (typeof code !== 'string' || !CARD_CODE_PATTERN.test(code)) {
    throw createCardError('Membership card not found', 404, 'CARD_NOT_FOUND');
  }

  const result = await pool.query(
    `
      SELECT
        cm.membership_number,
        cm.status,
        cm.joined_at,
        c.name AS community_name,
        c.community_type,
        c.logo_url,
        c.status AS community_status,
        up.first_name,
        up.last_name,
        up.display_name,
        up.avatar_url
      FROM community_memberships cm
      JOIN communities c
        ON c.id = cm.community_id
      LEFT JOIN user_profiles up
        ON up.user_id = cm.user_id
      WHERE cm.card_verification_code = $1
        AND c.archived_at IS NULL;
    `,
    [code],
  );

  const row = result.rows[0];

  if (!row) {
    throw createCardError('Membership card not found', 404, 'CARD_NOT_FOUND');
  }

  const valid = row.status === 'active' && row.community_status === 'active';

  return {
    valid,
    status: row.status,
    community: {
      name: row.community_name,
      communityType: row.community_type,
      logoUrl: row.logo_url,
    },
    // Only an active member's details are confirmed to the person scanning.
    ...(valid
      ? {
          membershipNumber: row.membership_number,
          holderName: publicHolderName(row),
          holderAvatarUrl: row.avatar_url,
          memberSince: row.joined_at,
        }
      : {}),
    checkedAt: new Date().toISOString(),
  };
}

/** Issues a new verification code (for example after a card was shared or lost). */
async function regenerateCardCode(userId, membershipId) {
  const result = await pool.query(
    `
      UPDATE community_memberships
      SET card_verification_code = NULL
      WHERE id = $1
        AND user_id = $2
        AND status = 'active'
      RETURNING id;
    `,
    [membershipId, userId],
  );

  if (result.rowCount === 0) {
    throw createCardError('Active membership not found', 404, 'MEMBERSHIP_NOT_FOUND');
  }

  const cards = await listMyMembershipCards(userId);

  return cards.find((card) => card.membershipId === membershipId);
}

module.exports = {
  listMyMembershipCards,
  verifyMembershipCard,
  regenerateCardCode,
};
