import { Request, Response } from 'express'
import { asyncHandler } from '../utils/asyncHandler'
import * as rewardService from '../services/rewardService'
import type { RewardCategory, RewardOrderStatus } from '../types/db'

type AuthedRequest = Request & { userId?: number }

function getFamilyId(req: AuthedRequest, res: Response): number | null {
    const familyId = Number(req.query.familyId || req.body?.familyId)
    if (!familyId) {
        res.fail('familyId 不能为空')
        return null
    }
    return familyId
}

/**
 * GET /api/reward?familyId=1&category=gift&includeUnpublished=1
 */
export const listRewardsHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const familyId = Number(req.query.familyId)
    if (!familyId) return res.fail('familyId 不能为空')

    const list = await rewardService.listRewards(req.userId, familyId, {
        category: req.query.category as RewardCategory | undefined,
        includeUnpublished: req.query.includeUnpublished === '1' || req.query.includeUnpublished === 'true'
    })
    res.success(list)
})

/**
 * GET /api/reward/:id?familyId=1
 */
export const getRewardHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const rewardId = Number(req.params.id)
    const familyId = getFamilyId(req, res)
    if (!familyId || !rewardId) return

    const reward = await rewardService.getReward(req.userId, familyId, rewardId)
    if (!reward) return res.fail('奖励不存在', 404)
    res.success(reward)
})

/**
 * POST /api/reward
 * Body: { familyId, name, description?, category, points, imageUrl?, stock?, dishId?, isPublished?, sortOrder? }
 */
export const createRewardHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const { familyId, name, description, category, points, imageUrl, stock, dishId, isPublished, sortOrder } = req.body || {}
    if (!familyId) return res.fail('familyId 不能为空')
    if (!name || !String(name).trim()) return res.fail('奖励名称不能为空')
    if (!category) return res.fail('奖励类型不能为空')

    try {
        const id = await rewardService.createReward(req.userId, Number(familyId), {
            name: String(name).trim(),
            description,
            category,
            points: Number(points),
            imageUrl,
            stock: stock !== undefined && stock !== null && stock !== '' ? Number(stock) : -1,
            dishId: dishId === undefined || dishId === null || dishId === '' ? null : Number(dishId),
            isPublished,
            sortOrder: sortOrder ? Number(sortOrder) : 0
        })
        res.success({ id }, '创建成功')
    } catch (err) {
        res.fail((err as Error).message)
    }
})

/**
 * PUT /api/reward/:id
 * Body: { familyId, ... 可更新字段 }
 */
export const updateRewardHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const rewardId = Number(req.params.id)
    const { familyId, name, description, category, points, imageUrl, stock, dishId, isPublished, sortOrder } = req.body || {}
    if (!familyId) return res.fail('familyId 不能为空')

    try {
        const ok = await rewardService.updateReward(req.userId, Number(familyId), rewardId, {
            name: name !== undefined ? String(name).trim() : undefined,
            description,
            category,
            points: points !== undefined ? Number(points) : undefined,
            imageUrl,
            stock: stock !== undefined ? Number(stock) : undefined,
            dishId: dishId === undefined
                ? undefined
                : (dishId === null || dishId === '' ? null : Number(dishId)),
            isPublished,
            sortOrder: sortOrder !== undefined ? Number(sortOrder) : undefined
        })
        if (!ok) return res.fail('没有需要更新的字段')
        res.success(null, '更新成功')
    } catch (err) {
        res.fail((err as Error).message)
    }
})

/**
 * DELETE /api/reward/:id?familyId=1
 */
export const deleteRewardHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const rewardId = Number(req.params.id)
    const familyId = getFamilyId(req, res)
    if (!familyId || !rewardId) return

    try {
        const ok = await rewardService.deleteReward(req.userId, familyId, rewardId)
        if (!ok) return res.fail('奖励不存在')
        res.success(null, '删除成功')
    } catch (err) {
        res.fail((err as Error).message)
    }
})

/**
 * PATCH /api/reward/:id/publish
 * Body: { familyId, isPublished }
 */
export const togglePublishHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const rewardId = Number(req.params.id)
    const { familyId, isPublished } = req.body || {}
    if (!familyId) return res.fail('familyId 不能为空')
    if (isPublished === undefined) return res.fail('isPublished 不能为空')

    try {
        const ok = await rewardService.toggleRewardPublish(req.userId, Number(familyId), rewardId, !!isPublished)
        if (!ok) return res.fail('奖励不存在')
        res.success(null, isPublished ? '已上架' : '已下架')
    } catch (err) {
        res.fail((err as Error).message)
    }
})

/**
 * POST /api/reward/redeem
 * Body: { familyId, rewardId, remark? }
 */
export const redeemRewardHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const { familyId, rewardId, remark } = req.body || {}
    if (!familyId) return res.fail('familyId 不能为空')
    if (!rewardId) return res.fail('rewardId 不能为空')

    try {
        const result = await rewardService.redeemReward(req.userId, Number(familyId), {
            rewardId: Number(rewardId),
            remark
        })
        res.success(result, '兑换成功')
    } catch (err) {
        res.fail((err as Error).message)
    }
})

/**
 * GET /api/reward/orders?familyId=1&mine=1&status=pending&userId=3
 */
export const listRewardOrdersHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const familyId = Number(req.query.familyId)
    if (!familyId) return res.fail('familyId 不能为空')

    try {
        const list = await rewardService.listRewardOrders(req.userId, familyId, {
            mine: req.query.mine === '1' || req.query.mine === 'true',
            userId: req.query.userId ? Number(req.query.userId) : undefined,
            status: req.query.status as RewardOrderStatus | undefined
        })
        res.success(list)
    } catch (err) {
        res.fail((err as Error).message)
    }
})

/**
 * PATCH /api/reward/orders/:id/received
 * Body: { familyId }
 */
export const markRewardReceivedHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const orderId = Number(req.params.id)
    const { familyId } = req.body || {}
    if (!familyId) return res.fail('familyId 不能为空')

    try {
        const ok = await rewardService.markRewardReceived(req.userId, Number(familyId), orderId)
        if (!ok) return res.fail('仅待领取状态的兑换可确认')
        res.success(null, '已确认领取')
    } catch (err) {
        res.fail((err as Error).message)
    }
})

/**
 * PATCH /api/reward/orders/:id/cancel
 * Body: { familyId }
 */
export const cancelRewardOrderHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const orderId = Number(req.params.id)
    const { familyId } = req.body || {}
    if (!familyId) return res.fail('familyId 不能为空')

    try {
        const ok = await rewardService.cancelRewardOrder(req.userId, Number(familyId), orderId)
        if (!ok) return res.fail('撤销失败')
        res.success(null, '已撤销兑换，积分已退回')
    } catch (err) {
        res.fail((err as Error).message)
    }
})
