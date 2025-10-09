export type UnknownRecord<T extends string = string> = {
  $type: T
  [k: string]: unknown
}
