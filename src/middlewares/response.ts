import { Response, Request, NextFunction } from 'express'

/**
 * 统一响应封装
 * 用法：res.success(data) / res.fail(message)
 */
declare module 'express-serve-static-core' {
    interface Response {
        success(data?: any, message?: string): void
        fail(message: string, code?: number): void
    }
}

export function responseEnhance(_req: Request, res: Response, next: NextFunction): void {
    res.success = function (data?: any, message = 'success'): void {
        res.json({ code: 0, message, data })
    }

    res.fail = function (message: string, code = -1): void {
        res.json({ code, message, data: null })
    }

    next()
}
