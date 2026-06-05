import type { NextFunction, Request, Response } from 'express'
import { isAdminUser } from '@/lib/admin.js'

export async function adminGuardMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.userId
  if (!userId || !(await isAdminUser(userId))) {
    res.status(403).json({ error: 'Acceso de administrador requerido' })
    return
  }
  next()
}
