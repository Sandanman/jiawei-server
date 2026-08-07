/**
 * 密码哈希工具
 * 采用 Node 内置 crypto.scrypt（同步），格式：salt:hash
 */
import { scryptSync, randomBytes, timingSafeEqual } from 'crypto'

const SALT_BYTES = 16
const KEY_LENGTH = 64

/** 生成密码哈希（salt:hash） */
export function hashPassword(password: string): string {
    const salt = randomBytes(SALT_BYTES).toString('hex')
    const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex')
    return `${salt}:${hash}`
}

/** 校验明文密码是否匹配哈希 */
export function verifyPassword(password: string, stored: string): boolean {
    if (!stored || !stored.includes(':')) return false
    const [salt, hash] = stored.split(':')
    if (!salt || !hash) return false
    try {
        const hashBuf = Buffer.from(hash, 'hex')
        const testBuf = scryptSync(password, salt, KEY_LENGTH)
        if (hashBuf.length !== testBuf.length) return false
        return timingSafeEqual(hashBuf, testBuf)
    } catch {
        return false
    }
}
