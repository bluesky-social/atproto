export const tableName = 'label'

export interface Label {
  sourceDid: string
  subjectUri: string
  subjectCid: string
  value: string
  createdAt: string
}

export type PartialDB = { [tableName]: Label }
