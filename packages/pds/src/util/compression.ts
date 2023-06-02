import express from 'express'
import compression from 'compression'

export default function () {
  return compression({
    filter,
  })
}

function filter(_req: express.Request, res: express.Response) {
  const contentType = res.getHeader('Content-type')
  if (contentType === 'application/vnd.ipld.car') {
    return true
  }
  return compression.filter(_req, res)
}
