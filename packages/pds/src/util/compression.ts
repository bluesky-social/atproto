import compression from 'compression'
import express from 'express'

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
