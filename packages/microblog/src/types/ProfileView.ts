export interface Params {
  user: string;
}

export interface Response {
  did: string;
  name: string;
  displayName?: string;
  description?: string;
  followersCount: number;
  followsCount: number;
  postsCount: number;
  badges: Badge[];
  myState?: {
    follow?: string;
  };
}
export interface Badge {
  uri: string;
  error?: string;
  issuer?: {
    did: string;
    name: string;
    displayName: string;
  };
  assertion?: {
    type: string;
  };
  createdAt?: string;
}
