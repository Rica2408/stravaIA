import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { tokenEncryptionKey } from '@/config/index.js'

const ALGO = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

export function encryptSecret(plainText: string): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGO, tokenEncryptionKey, iv)
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

export function decryptSecret(payload: string): string {
  const buf = Buffer.from(payload, 'base64')
  const iv = buf.subarray(0, IV_LENGTH)
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
  const decipher = createDecipheriv(ALGO, tokenEncryptionKey, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf8')
}
