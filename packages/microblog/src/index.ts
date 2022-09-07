export * from './schemas/defs'
export * from './types'

// @TODO move this
export type Labeled<T> = T & {
  $type: string
  uri: string
}
