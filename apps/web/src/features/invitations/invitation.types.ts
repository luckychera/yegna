export type InvitationStatus = 'pending' | 'accepted' | 'rejected' | 'revoked' | 'expired';

/** An invitation addressed to the signed-in user (GET /invitations/me). */
export interface MyInvitation {
  id: string;
  status: InvitationStatus;
  expiresAt: string;
  acceptedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  community: { id: string; name: string; logoUrl: string | null };
  inviter: { name: string | null };
}

/** An invitation as seen by community admins. The backend returns only the invited user's ID. */
export interface CommunityInvitation {
  id: string;
  status: InvitationStatus;
  invitedUserId: string;
  expiresAt: string;
  createdAt: string;
}
