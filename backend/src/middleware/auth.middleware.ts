import type { NextFunction, Request, Response } from 'express'
import { verifyAccessToken } from '@/lib/jwt.js'
import { prisma } from '@/lib/prisma.js'

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No autorizado' })
      return
    }
    const token = header.slice('Bearer '.length).trim()
    const payload = verifyAccessToken(token)
    const user = await prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user || user.tokenVersion !== payload.tv) {
      res.status(401).json({ error: 'Sesión inválida' })
      return
    }
    req.userId = user.id
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' })
  }
}
