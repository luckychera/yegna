export const ANNOUNCEMENT_CATEGORIES = ['update', 'meeting', 'event', 'contribution_reminder', 'notice'] as const;

export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number];

export const ANNOUNCEMENT_CATEGORY_LABELS: Record<AnnouncementCategory, string> = {
  update: 'Update',
  meeting: 'Meeting',
  event: 'Event',
  contribution_reminder: 'Contribution reminder',
  notice: 'Important notice',
};

export interface Announcement {
  id: string;
  communityId: string;
  category: AnnouncementCategory;
  title: string;
  body: string;
  eventAt: string | null;
  location: string | null;
  isPinned: boolean;
  publishedAt: string;
  updatedAt: string;
  isRead: boolean;
  author: {
    id: string | null;
    name: string;
    avatarUrl: string | null;
  };
  /** Present on the cross-community feed (GET /announcements/me). */
  community?: {
    id: string;
    name: string;
    logoUrl: string | null;
  };
}

export interface AnnouncementInput {
  title: string;
  body: string;
  category: AnnouncementCategory;
  eventAt: string | null;
  location: string | null;
  isPinned: boolean;
}
