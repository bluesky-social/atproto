export interface Params {
  uri: string;
  limit?: number;
  before?: string;
}

export interface Response {
  uri: string;
  likedBy: {
    did: string;
    name: string;
    displayName?: string;
    createdAt?: string;
    indexedAt: string;
  }[];
}
