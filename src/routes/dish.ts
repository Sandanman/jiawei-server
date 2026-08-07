import { Router } from 'express'
import { authRequired } from '../middlewares/auth'
import {
    listDishesHandler,
    getDishHandler,
    createDishHandler,
    updateDishHandler,
    deleteDishHandler,
    togglePublishHandler
} from '../controllers/dishController'

const router: Router = Router()

// 所有 dish 接口都需要登录
router.use(authRequired)

/**
 * 菜品模块路由
 */
router.get('/', listDishesHandler)                        // 菜品列表
router.post('/', createDishHandler)                       // 创建菜品
router.get('/:id', getDishHandler)                        // 菜品详情
router.put('/:id', updateDishHandler)                      // 更新菜品
router.delete('/:id', deleteDishHandler)                   // 删除菜品
router.patch('/:id/publish', togglePublishHandler)         // 上架/下架

export default router
