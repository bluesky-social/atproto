import express from 'express'

export const setRepoRev = (res: express.Response, rev: string | null) => {
  if (rev !== null) {
    res.setHeader('Atproto-Repo-Rev', rev)
  }
}

export const clearlyBadCursor = (cursor?: string) => {
  // hallmark of v1 cursor, highly unlikely in v2 cursors based on time or rkeys
  return !!cursor?.includes('::')
}
