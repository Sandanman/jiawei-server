import { Router } from 'express'
import { authRequired } from '../middlewares/auth'
import {
    listPointsRecordsHandler,
    listPointsSummariesHandler,
    getPointsRecordHandler,
    adjustPointsHandler
} from '../controllers/pointsController'

const router: Router = Router()

// 所有 points 接口都需要登录
router.use(authRequired)

/**
 * 积分模块路由
 */
router.get('/', listPointsRecordsHandler)                  // 积分流水列表
router.get('/summary', listPointsSummariesHandler)         // 家庭成员积分汇总
router.post('/adjust', adjustPointsHandler)                // 管理员手动调整
router.get('/:id', getPointsRecordHandler)                 // 流水详情

export default router
