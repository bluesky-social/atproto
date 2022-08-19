export const collectionToTableName = (collection: string): string => {
  return `record_${collection.split('/').join('_')}`
}
