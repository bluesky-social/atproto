export interface GeneratedFile {
  path: string
  content: string
}

export interface GeneratedAPI {
  files: GeneratedFile[]
}

export interface FileDiff {
  act: 'add' | 'mod' | 'del'
  path: string
  content?: string
}
