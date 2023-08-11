import express from 'express'

export const setRepoRev = (res: express.Response, rev: string | null) => {
  if (rev !== null) {
    res.setHeader('Atproto-Repo-Rev', rev)
  }
}
