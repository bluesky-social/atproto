export interface Params {
  author?: string;
  limit?: number;
  before?: string;
}

export interface Response {
  feed: FeedItem[];
}
export interface FeedItem {
  uri: string;
  author: User;
  repostedBy?: User;
  record: {};
  embed?: RecordEmbed | ExternalEmbed | UnknownEmbed;
  replyCount: number;
  repostCount: number;
  likeCount: number;
  indexedAt: string;
  myState?: {
    repost?: string;
    like?: string;
  };
}
export interface User {
  did: string;
  name: string;
  displayName?: string;
}
export interface RecordEmbed {
  type: "record";
  author: User;
  record: {};
}
export interface ExternalEmbed {
  type: "external";
  uri: string;
  title: string;
  description: string;
  imageUri: string;
}
export interface UnknownEmbed {
  type: string;
}
