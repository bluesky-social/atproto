export interface Params {
  uri: string;
  depth?: number;
}

export interface Response {
  thread: Post;
}
export interface Post {
  uri: string;
  author: User;
  record: {};
  embed?: RecordEmbed | ExternalEmbed | UnknownEmbed;
  parent?: Post;
  replyCount: number;
  replies?: Post[];
  likeCount: number;
  repostCount: number;
  indexedAt: string;
  myState?: {
    hasReposted?: string;
    hasLiked?: string;
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
