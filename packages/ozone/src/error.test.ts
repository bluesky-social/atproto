import type { Request, Response } from 'express'
import { expect, it, vi } from 'vitest'
import { handler as errorHandler } from './error.js'

it('turns unknown errors into 500s', () => {
  const res = {
    headersSent: false,
    status: vi.fn(() => res),
    json: vi.fn(() => res),
  }
  const next = vi.fn()

  errorHandler(
    new Error('Oops!'),
    {} as Request,
    res as unknown as Response,
    next,
  )

  expect(res.status).toHaveBeenCalledWith(500)
  expect(res.json).toHaveBeenCalledWith({
    error: 'InternalServerError',
    message: 'Internal Server Error',
  })
  expect(next).not.toHaveBeenCalled()
})
