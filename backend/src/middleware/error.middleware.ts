import type { NextFunction, Request, Response } from 'express'

export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof Error) {
    const known = err.message.startsWith('Validation') || err.message.includes('Límite')
    res.status(known ? 400 : 500).json({
      error: known ? err.message : 'Error interno del servidor',
    })
    return
  }
  res.status(500).json({ error: 'Error interno del servidor' })
}
