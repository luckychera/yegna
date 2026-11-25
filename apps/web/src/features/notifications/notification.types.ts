export interface AppNotification {
  id: string;
  communityId: string | null;
  type: string;
  title: string;
  message: string;
  priority: string;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}
