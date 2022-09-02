export * from './schemas/defs'
export * from './types'
export * from './validators'

// @TODO move this
export type Labeled<T> = T & {
  $type: string
  uri: string
}
