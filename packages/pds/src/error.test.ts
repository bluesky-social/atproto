import type { Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'
import { handler } from './error.js'

describe('error handler', () => {
  it('turns unknown errors into 500s.', () => {
    const res = { headersSent: false, status: vi.fn(), json: vi.fn() }
    res.status.mockReturnValue(res)
    const next = vi.fn()

    handler(new Error('Oops!'), {} as Request, res as unknown as Response, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      error: 'InternalServerError',
      message: 'Internal Server Error',
    })
  })
})
