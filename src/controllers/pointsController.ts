import { Request, Response } from 'express'
import { asyncHandler } from '../utils/asyncHandler'
import * as pointsService from '../services/pointsService'
import type { PointsRecordType } from '../types/db'

type AuthedRequest = Request & { userId?: number }

/**
 * GET /api/points?familyId=1&mine=1&type=order_deduct&userId=3
 * - 列表：默认家庭全部流水；mine=1 仅自己；userId=N 指定成员；type 按类型筛选
 */
export const listPointsRecordsHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const familyId = Number(req.query.familyId)
    if (!familyId) return res.fail('familyId 不能为空')

    const list = await pointsService.listPointsRecords(req.userId, familyId, {
        mine: req.query.mine === '1' || req.query.mine === 'true',
        userId: req.query.userId ? Number(req.query.userId) : undefined,
        type: req.query.type as PointsRecordType | undefined
    })
    res.success(list)
})

/**
 * GET /api/points/summary?familyId=1
 * - 家庭成员积分汇总
 */
export const listPointsSummariesHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const familyId = Number(req.query.familyId)
    if (!familyId) return res.fail('familyId 不能为空')

    const list = await pointsService.listPointsSummaries(req.userId, familyId)
    res.success(list)
})

/**
 * GET /api/points/:id?familyId=1
 * - 流水详情
 */
export const getPointsRecordHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const recordId = Number(req.params.id)
    const familyId = Number(req.query.familyId)
    if (!familyId) return res.fail('familyId 不能为空')

    const record = await pointsService.getPointsRecord(req.userId, familyId, recordId)
    if (!record) return res.fail('流水不存在', 404)
    res.success(record)
})

/**
 * POST /api/points/adjust
 * Body: { familyId, userId, points, type, description? }
 * - 管理员手动调整积分
 */
export const adjustPointsHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const { familyId, userId, points, type, description } = req.body || {}
    if (!familyId) return res.fail('familyId 不能为空')
    if (!userId) return res.fail('userId 不能为空')
    if (!points || Number(points) <= 0) return res.fail('points 必须大于 0')
    if (!['manual_add', 'manual_subtract'].includes(type)) return res.fail('type 非法')

    try {
        const result = await pointsService.adjustPoints(req.userId, Number(familyId), {
            userId: Number(userId),
            points: Number(points),
            type,
            description
        })
        res.success(result, '调整成功')
    } catch (err) {
        res.fail((err as Error).message)
    }
})
