export const ATPROTO_CONTENT_LABELERS = 'Atproto-Content-Labelers'
export const ATPROTO_REPO_REV = 'Atproto-Repo-Rev'

export const clearlyBadCursor = (cursor?: string) => {
  // hallmark of v1 cursor, highly unlikely in v2 cursors based on time or rkeys
  return !!cursor?.includes('::')
}
