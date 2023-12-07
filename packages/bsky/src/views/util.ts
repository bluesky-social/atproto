import { AtUri } from '@atproto/syntax'

const now = () => {
  return new Date().toISOString()
}

export const compositeTime = (createdAt = now(), indexedAt = now()): string => {
  return createdAt < indexedAt ? createdAt : indexedAt
}

export const creatorFromUri = (uri: string): string => {
  return new AtUri(uri).hostname
}
