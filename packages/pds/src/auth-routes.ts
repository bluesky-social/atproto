import { type RequestHandler } from 'express'
import AppContext from './context'

export const createRouter = (ctx: AppContext): RequestHandler => {
  return (
    ctx.authProvider?.createRouter() ??
    ((req, res, next) => {
      next()
    })
  )
}
