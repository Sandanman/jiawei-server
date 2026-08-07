import { Router } from 'express'
import { authRequired } from '../middlewares/auth'
import {
    listRewardsHandler,
    getRewardHandler,
    createRewardHandler,
    updateRewardHandler,
    deleteRewardHandler,
    togglePublishHandler,
    redeemRewardHandler,
    listRewardOrdersHandler,
    markRewardReceivedHandler,
    cancelRewardOrderHandler
} from '../controllers/rewardController'

const router: Router = Router()

// 所有 reward 接口都需要登录
router.use(authRequired)

/**
 * 积分商城模块路由
 */
router.get('/', listRewardsHandler)                          // 奖励商品列表
router.post('/', createRewardHandler)                        // 创建奖励（管理员）
router.post('/redeem', redeemRewardHandler)                  // 兑换奖励（扣积分）
router.get('/orders', listRewardOrdersHandler)               // 兑换记录列表
router.patch('/orders/:id/received', markRewardReceivedHandler) // 确认已领取（管理员）
router.patch('/orders/:id/cancel', cancelRewardOrderHandler) // 撤销兑换（本人待领取）
router.get('/:id', getRewardHandler)                         // 奖励详情
router.put('/:id', updateRewardHandler)                      // 更新奖励（管理员）
router.delete('/:id', deleteRewardHandler)                   // 删除奖励（管理员）
router.patch('/:id/publish', togglePublishHandler)           // 上架/下架（管理员）

export default router
