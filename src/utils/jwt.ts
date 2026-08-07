import jwt from 'jsonwebtoken'
import { config } from '../config'
import type { JwtPayload } from '../types/api'

/**
 * 签发 JWT
 */
export function signToken(payload: Pick<JwtPayload, 'userId' | 'nickname'>): string {
    return jwt.sign(payload, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn as any
    })
}

/**
 * 验证 JWT，返回载荷或 null
 */
export function verifyToken(token: string): JwtPayload | null {
    try {
        return jwt.verify(token, config.jwt.secret) as JwtPayload
    } catch {
        return null
    }
}

/**
 * 从 Authorization 头提取并验证 token
 */
export function extractToken(authHeader?: string): JwtPayload | null {
    if (!authHeader) return null
    const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : authHeader
    return verifyToken(token)
}
