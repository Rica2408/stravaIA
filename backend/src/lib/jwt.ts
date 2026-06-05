import jwt from 'jsonwebtoken'
import { env } from '@/config/index.js'

const JWT_EXPIRY = '7d'

export interface AccessTokenPayload {
  sub: string
  tv: number
}

export function signAccessToken(userId: string, tokenVersion: number): string {
  const payload: AccessTokenPayload = { sub: userId, tv: tokenVersion }
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: JWT_EXPIRY })
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET)
  if (typeof decoded === 'string' || !decoded || typeof decoded !== 'object') {
    throw new Error('Token inválido')
  }
  const sub = 'sub' in decoded && typeof decoded.sub === 'string' ? decoded.sub : null
  const tv = 'tv' in decoded && typeof decoded.tv === 'number' ? decoded.tv : null
  if (!sub || tv === null) {
    throw new Error('Token corrupto')
  }
  return { sub, tv }
}
