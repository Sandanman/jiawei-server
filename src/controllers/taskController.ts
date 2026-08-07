import { Request, Response } from 'express'
import { asyncHandler } from '../utils/asyncHandler'
import * as taskService from '../services/taskService'
import type { TaskStatus } from '../types/db'

type AuthedRequest = Request & { userId?: number }

const VALID_STATUS = ['draft', 'published', 'paused', 'completed'] as const

function getFamilyId(req: AuthedRequest, res: Response): number | null {
    const familyId = Number(req.query.familyId || req.body?.familyId)
    if (!familyId) {
        res.fail('familyId 不能为空')
        return null
    }
    return familyId
}

/**
 * GET /api/task?familyId=1&status=published&mine=1
 */
export const listTasksHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const familyId = getFamilyId(req, res)
    if (!familyId) return

    const status = req.query.status as TaskStatus | undefined
    if (status && !VALID_STATUS.includes(status as any)) {
        return res.fail('status 参数无效')
    }

    const list = await taskService.listTasks(req.userId, familyId, {
        status,
        mine: req.query.mine === '1' || req.query.mine === 'true'
    })
    res.success(list)
})

/**
 * GET /api/task/:id?familyId=1
 */
export const getTaskHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const familyId = getFamilyId(req, res)
    if (!familyId) return
    const taskId = Number(req.params.id)
    if (!taskId) return res.fail('taskId 不能为空')

    const task = await taskService.getTask(req.userId, familyId, taskId)
    if (!task) return res.fail('任务不存在', 404)
    res.success(task)
})

/**
 * POST /api/task
 * Body: { familyId, title, description?, category?, categoryName?, points?, deadline, assigneeIds?, status? }
 */
export const createTaskHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const { familyId, title, description, category, categoryName, points, deadline, assigneeIds, status } = req.body || {}
    if (!familyId) return res.fail('familyId 不能为空')

    try {
        const result = await taskService.createTask(req.userId, Number(familyId), {
            familyId: Number(familyId),
            title,
            description,
            category,
            categoryName,
            points: points !== undefined ? Number(points) : undefined,
            deadline,
            assigneeIds: Array.isArray(assigneeIds) ? assigneeIds.map(Number) : [],
            status
        })
        res.success(result, '任务创建成功')
    } catch (err) {
        res.fail((err as Error).message)
    }
})

/**
 * PUT /api/task/:id
 * Body: { familyId, title?, description?, category?, categoryName?, points?, deadline?, assigneeIds? }
 */
export const updateTaskHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const taskId = Number(req.params.id)
    if (!taskId) return res.fail('taskId 不能为空')
    const { familyId, title, description, category, categoryName, points, deadline, assigneeIds } = req.body || {}
    if (!familyId) return res.fail('familyId 不能为空')

    try {
        const ok = await taskService.updateTask(req.userId, Number(familyId), taskId, {
            familyId: Number(familyId),
            title,
            description,
            category,
            categoryName,
            points: points !== undefined ? Number(points) : undefined,
            deadline,
            assigneeIds: Array.isArray(assigneeIds) ? assigneeIds.map(Number) : undefined
        })
        if (!ok) return res.fail('任务更新失败')
        res.success(null, '任务已更新')
    } catch (err) {
        res.fail((err as Error).message)
    }
})

/**
 * DELETE /api/task/:id?familyId=1
 */
export const deleteTaskHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const taskId = Number(req.params.id)
    if (!taskId) return res.fail('taskId 不能为空')
    const familyId = getFamilyId(req, res)
    if (!familyId) return

    try {
        const ok = await taskService.deleteTask(req.userId, familyId, taskId)
        if (!ok) return res.fail('任务删除失败')
        res.success(null, '任务已删除')
    } catch (err) {
        res.fail((err as Error).message)
    }
})

/**
 * PATCH /api/task/:id/publish
 * Body: { familyId }
 */
export const publishTaskHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const taskId = Number(req.params.id)
    if (!taskId) return res.fail('taskId 不能为空')
    const { familyId } = req.body || {}
    if (!familyId) return res.fail('familyId 不能为空')

    try {
        const ok = await taskService.publishTask(req.userId, Number(familyId), taskId)
        if (!ok) return res.fail('任务发布失败')
        res.success(null, '任务已发布')
    } catch (err) {
        res.fail((err as Error).message)
    }
})

/**
 * PATCH /api/task/:id/pause
 * Body: { familyId }
 */
export const pauseTaskHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const taskId = Number(req.params.id)
    if (!taskId) return res.fail('taskId 不能为空')
    const { familyId } = req.body || {}
    if (!familyId) return res.fail('familyId 不能为空')

    try {
        const ok = await taskService.pauseTask(req.userId, Number(familyId), taskId)
        if (!ok) return res.fail('任务暂停失败')
        res.success(null, '任务已暂停')
    } catch (err) {
        res.fail((err as Error).message)
    }
})

/**
 * PATCH /api/task/:id/take
 * Body: { familyId }
 */
export const takeTaskHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const taskId = Number(req.params.id)
    if (!taskId) return res.fail('taskId 不能为空')
    const { familyId } = req.body || {}
    if (!familyId) return res.fail('familyId 不能为空')

    try {
        const result = await taskService.takeTask(req.userId, Number(familyId), taskId)
        res.success(result, '接单成功')
    } catch (err) {
        res.fail((err as Error).message)
    }
})

/**
 * PATCH /api/task/:id/complete
 * Body: { familyId }
 */
export const completeTaskHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const taskId = Number(req.params.id)
    if (!taskId) return res.fail('taskId 不能为空')
    const { familyId } = req.body || {}
    if (!familyId) return res.fail('familyId 不能为空')

    try {
        const result = await taskService.completeTask(req.userId, Number(familyId), taskId)
        res.success(result, `任务完成！+${result.points} 积分`)
    } catch (err) {
        res.fail((err as Error).message)
    }
})
