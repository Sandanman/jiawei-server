import { Router } from 'express'

const router: Router = Router()

/**
 * 示例路由占位
 * 后续按业务模块拆分：
 *   /api/family       家庭
 *   /api/members      成员
 *   /api/menu         菜单
 *   /api/orders       订单
 *   /api/tasks        任务
 *   /api/points       积分
 *   /api/auth         登录/鉴权
 */

router.get('/', (_req, res) => {
    res.success({
        name: 'jiawei-server',
        version: '1.0.0',
        modules: ['/auth', '/family', '/members', '/menu', '/orders', '/tasks', '/points']
    })
})

export default router
