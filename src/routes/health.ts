import { Router, Request, Response } from 'express'
import { testConnection } from '../db'

const router: Router = Router()

/**
 * GET /api/health
 * 健康检查 + 数据库连接测试
 */
router.get('/', async (_req: Request, res: Response) => {
    try {
        await testConnection()
        res.success({
            status: 'ok',
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        })
    } catch (err) {
        res.fail(`服务正常，但数据库连接失败: ${(err as Error).message}`)
    }
})

export default router
