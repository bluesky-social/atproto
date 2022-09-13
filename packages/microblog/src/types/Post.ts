/**
 * @minItems 2
 * @maxItems 2
 */
export type TextSlice = [number, number];
export type Entity = {
  index: TextSlice;
  type: string;
  value: string;
}[];

export interface Record {
  text: string;
  entities?: Entity;
  reply?: {
    root: string;
    parent?: string;
  };
  createdAt: string;
}
