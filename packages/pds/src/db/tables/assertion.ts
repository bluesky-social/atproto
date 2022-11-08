export interface Assertion {
  uri: string
  cid: string
  creator: string
  assertion: string
  subjectDid: string
  subjectDeclarationCid: string
  createdAt: string
  indexedAt: string
  confirmed: 0 | 1
  confirmUri: string | null
  confirmCid: string | null
  confirmCreated: string | null
  confirmIndexed: string | null
}

export const tableName = 'assertion'

export type PartialDB = { [tableName]: Assertion }
