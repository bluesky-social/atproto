import express from 'express'

export const setAtprotoClock = (
  res: express.Response,
  clock: string | null,
) => {
  if (clock !== null) {
    res.setHeader('Atproto-Clock', clock)
  }
}
