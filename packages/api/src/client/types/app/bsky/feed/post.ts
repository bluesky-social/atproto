/**
* GENERATED CODE - DO NOT MODIFY
*/
export interface Record {
  text: string;
  entities?: Entity[];
  reply?: ReplyRef;
  createdAt: string;
  [k: string]: unknown;
}

export interface ReplyRef {
  root: PostRef;
  parent: PostRef;
  [k: string]: unknown;
}

export interface PostRef {
  uri: string;
  cid: string;
  [k: string]: unknown;
}

export interface Entity {
  index: TextSlice;
  /** Expected values are 'mention', 'hashtag', and 'link'. */
  type: string;
  value: string;
  [k: string]: unknown;
}

export interface TextSlice {
  start: number;
  end: number;
  [k: string]: unknown;
}
