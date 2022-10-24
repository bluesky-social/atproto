/**
* GENERATED CODE - DO NOT MODIFY
*/
/**
 * @minItems 2
 * @maxItems 2
 */
export type AppBskyPostTextSlice = [number, number]
export type AppBskyPostEntity = {
  index: AppBskyPostTextSlice,
  type: string,
  value: string,
  [k: string]: unknown,
}[]

export interface Record {
  text: string;
  entities?: AppBskyPostEntity;
  reply?: {
    root: AppBskyPostPostRef,
    parent: AppBskyPostPostRef,
    [k: string]: unknown,
  };
  createdAt: string;
  [k: string]: unknown;
}
export interface AppBskyPostPostRef {
  uri: string;
  cid: string;
  [k: string]: unknown;
}
