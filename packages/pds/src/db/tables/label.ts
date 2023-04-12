export const tableName = 'label'

export interface Label {
  sourceDid: string
  subjectUri: string
  subjectCid: string | null
  value: string
  negated: 0 | 1 // @TODO convert to boolean in app-view
  createdAt: string
}

export type PartialDB = { [tableName]: Label }
