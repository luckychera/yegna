const NOTIFICATION_CHANNEL = Object.freeze({
  IN_APP: 'in_app',
  EMAIL: 'email',
  SMS: 'sms',
});

const NOTIFICATION_PRIORITY = Object.freeze({
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
});

const NOTIFICATION_DELIVERY_STATUS = Object.freeze({
  PENDING: 'pending',
  QUEUED: 'queued',
  SENT: 'sent',
  DELIVERED: 'delivered',
  FAILED: 'failed',
});

const NOTIFICATION_TYPE = Object.freeze({
  INVITATION_RECEIVED: 'invitation_received',
  INVITATION_ACCEPTED: 'invitation_accepted',
  INVITATION_REJECTED: 'invitation_rejected',

  MEMBERSHIP_APPROVED: 'membership_approved',
  MEMBERSHIP_SUSPENDED: 'membership_suspended',
  MEMBERSHIP_REMOVED: 'membership_removed',

  CONTRIBUTION_CREATED: 'contribution_created',
  CONTRIBUTION_DUE: 'contribution_due',
  CONTRIBUTION_OVERDUE: 'contribution_overdue',

  PAYMENT_SUCCESSFUL: 'payment_successful',
  PAYMENT_FAILED: 'payment_failed',
  PAYMENT_REFUNDED: 'payment_refunded',

  COMMUNITY_ANNOUNCEMENT: 'community_announcement',

  SYSTEM: 'system',
});

module.exports = {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_DELIVERY_STATUS,
  NOTIFICATION_TYPE,
};
