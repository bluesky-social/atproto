/**
* GENERATED CODE - DO NOT MODIFY
*/
/**
 * @minItems 2
 * @maxItems 2
 */
export type TextSlice = [number, number]
export type Entity = {
  index: TextSlice,
  type: string,
  value: string,
  [k: string]: unknown,
}[]

export interface Record {
  text: string;
  entities?: Entity;
  reply?: {
    root: string,
    parent?: string,
    [k: string]: unknown,
  };
  createdAt: string;
  [k: string]: unknown;
}
