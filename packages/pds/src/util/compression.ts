import express from 'express'
import compression from 'compression'
import compressible from 'compressible'

export default function () {
  return compression({
    filter,
  })
}

function filter(req: express.Request, res: express.Response) {
  const contentType = res.getHeaders()['content-type']
  if (contentType === 'application/vnd.ipld.car') {
    return true
  }
  return compressible(req, res)
}
