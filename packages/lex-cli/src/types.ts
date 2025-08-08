export interface GeneratedFile {
  path: string
  content?: string
}

export interface GeneratedAPI {
  files: GeneratedFile[]
}

export interface FileDiff {
  act: 'add' | 'mod' | 'del' | 'leave'
  path: string
  content?: string
}

export type ModificationTimes = Record<string, number>
