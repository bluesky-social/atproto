const now = () => {
  return new Date().toISOString()
}

export const compositeTime = (createdAt = now(), indexedAt = now()): string => {
  return createdAt < indexedAt ? createdAt : indexedAt
}
