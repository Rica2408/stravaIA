import { config as loadEnv } from 'dotenv'
import { createHash } from 'node:crypto'
import { z } from 'zod'

loadEnv()

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET debe tener al menos 16 caracteres'),
  DATABASE_URL: z.string().min(1),
  STRAVA_CLIENT_ID: z.string().min(1),
  STRAVA_CLIENT_SECRET: z.string().min(1),
  STRAVA_REDIRECT_URI: z.string().url(),
  STRAVA_VERIFY_TOKEN: z.string().min(4),
  ANTHROPIC_API_KEY: z.string().min(1),
  FRONTEND_URL: z.string().url(),
  TOKEN_ENCRYPTION_KEY: z.string().min(32).optional(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const formatted = parsed.error.flatten().fieldErrors
  throw new Error(`Variables de entorno inválidas: ${JSON.stringify(formatted)}`)
}

export const env = parsed.data

// Clave AES-256: 32 bytes. Si no hay clave dedicada, derivamos de JWT_SECRET.
export const tokenEncryptionKey: Buffer = env.TOKEN_ENCRYPTION_KEY
  ? Buffer.from(env.TOKEN_ENCRYPTION_KEY, 'utf8').subarray(0, 32)
  : createHash('sha256').update(env.JWT_SECRET).digest()
