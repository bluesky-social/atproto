export const tableName = 'tagged_suggestion'

export interface TaggedSuggestion {
  tag: string
  subject: string
  subjectType: string
}

export type PartialDB = {
  [tableName]: TaggedSuggestion
}
