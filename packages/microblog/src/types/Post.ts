/**
 * @minItems 2
 * @maxItems 2
 */
export type TextSlice = [number, number]

export interface Record {
  text: string
  entities?: {
    index: TextSlice
    type: string
    value: string
  }[]
  reply?: {
    root: string
    parent?: string // can this be empty? shouldn't it just be `root`?
  }
  createdAt: string
}
