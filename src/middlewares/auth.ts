import type { Request, Response, NextFunction } from 'express'
import { extractToken } from '../utils/jwt'
import type { JwtPayload } from '../types/api'

// 扩展 Request 类型，挂载用户信息
declare module 'express-serve-static-core' {
    interface Request {
        userId?: number
        jwt?: JwtPayload
    }
}

/**
 * JWT 鉴权中间件
 * - 从 Authorization: Bearer <token> 提取
 * - 验证通过挂载 req.userId / req.jwt
 * - 未通过返回 401
 */
export function authRequired(req: Request, res: Response, next: NextFunction): void {
    const payload = extractToken(req.headers.authorization)

    if (!payload) {
        res.status(401).json({
            code: 401,
            message: '未登录或登录已过期',
            data: null
        })
        return
    }

    req.userId = payload.userId
    req.jwt = payload
    next()
}

/**
 * 可选鉴权：有 token 就解析，没 token 也放行
 */
export function authOptional(req: Request, _res: Response, next: NextFunction): void {
    const payload = extractToken(req.headers.authorization)
    if (payload) {
        req.userId = payload.userId
        req.jwt = payload
    }
    next()
}
