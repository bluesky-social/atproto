export interface Params {
  limit?: number;
  before?: string;
}

export interface Response {
  notifications: Notification[];
}
export interface Notification {
  uri: string;
  author: {
    did: string;
    name: string;
    displayName: string;
  };
  record: {};
  isRead: boolean;
  indexedAt: string;
}
