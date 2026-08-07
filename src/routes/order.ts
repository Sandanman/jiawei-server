import { Router } from 'express'
import { authRequired } from '../middlewares/auth'
import {
    listOrdersHandler,
    getOrderHandler,
    createOrderHandler,
    confirmOrderHandler,
    completeOrderHandler,
    cancelOrderHandler
} from '../controllers/orderController'

const router: Router = Router()

// 所有 order 接口都需要登录
router.use(authRequired)

/**
 * 订单模块路由
 */
router.get('/', listOrdersHandler)                        // 订单列表
router.post('/', createOrderHandler)                      // 下单
router.get('/:id', getOrderHandler)                       // 订单详情
router.patch('/:id/confirm', confirmOrderHandler)         // 确认订单
router.patch('/:id/complete', completeOrderHandler)       // 完成订单
router.patch('/:id/cancel', cancelOrderHandler)           // 取消订单

export default router
