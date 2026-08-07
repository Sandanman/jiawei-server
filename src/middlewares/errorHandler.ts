import type { Request, Response, NextFunction } from 'express'

/**
 * 统一错误处理中间件
 */
export function errorHandler(
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
): void {
    console.error('[ERROR]', err.message)

    res.status(500).json({
        code: 500,
        message: err.message || '服务器内部错误',
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    })
}

/**
 * 404 处理
 */
export function notFound(req: Request, res: Response): void {
    res.status(404).json({
        code: 404,
        message: `接口不存在: ${req.method} ${req.path}`
    })
}
