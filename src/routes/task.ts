import { Router } from 'express'
import { authRequired } from '../middlewares/auth'
import {
    listTasksHandler,
    getTaskHandler,
    createTaskHandler,
    updateTaskHandler,
    deleteTaskHandler,
    publishTaskHandler,
    pauseTaskHandler,
    takeTaskHandler,
    completeTaskHandler
} from '../controllers/taskController'

const router: Router = Router()

// 所有 task 接口都需要登录
router.use(authRequired)

/**
 * 任务模块路由
 */
router.get('/', listTasksHandler)                        // 任务列表
router.post('/', createTaskHandler)                      // 创建任务（管理员）
router.get('/:id', getTaskHandler)                       // 任务详情
router.put('/:id', updateTaskHandler)                    // 更新任务（管理员）
router.delete('/:id', deleteTaskHandler)                 // 删除任务（管理员）
router.patch('/:id/publish', publishTaskHandler)         // 发布任务（管理员）
router.patch('/:id/pause', pauseTaskHandler)             // 暂停任务（管理员）
router.patch('/:id/take', takeTaskHandler)               // 接单（成员）
router.patch('/:id/complete', completeTaskHandler)       // 完成任务（成员）

export default router
