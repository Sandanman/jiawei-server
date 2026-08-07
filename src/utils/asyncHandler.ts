import { Request, Response } from 'express'

/**
 * 统一控制器异步错误捕获装饰器
 * 用法：
 *   asyncHandler(async (req, res) => { ... })
 */
export type AsyncHandler = (req: Request, res: Response) => Promise<any>

export function asyncHandler(handler: AsyncHandler) {
    return (req: Request, res: Response, next: (err?: any) => void) => {
        Promise.resolve(handler(req, res)).catch(next)
    }
}
