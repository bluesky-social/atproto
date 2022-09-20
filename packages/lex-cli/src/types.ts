export interface GeneratedFile {
  path: string
  content: string
}

export interface GeneratedAPI {
  files: GeneratedFile[]
}
