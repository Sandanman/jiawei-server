import { Request, Response } from 'express'
import { asyncHandler } from '../utils/asyncHandler'
import * as orderService from '../services/orderService'
import type { OrderStatus } from '../types/db'

type AuthedRequest = Request & { userId?: number }

const VALID_STATUS = ['pending', 'confirmed', 'completed', 'cancelled'] as const

/**
 * GET /api/order?familyId=1&status=pending&mine=1
 */
export const listOrdersHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const familyId = Number(req.query.familyId)
    if (!familyId) return res.fail('familyId 不能为空')

    const status = req.query.status as OrderStatus | undefined
    if (status && !VALID_STATUS.includes(status as any)) {
        return res.fail('status 参数无效')
    }

    const list = await orderService.listOrders(req.userId, familyId, {
        status,
        mine: req.query.mine === '1' || req.query.mine === 'true'
    })
    res.success(list)
})

/**
 * GET /api/order/:id?familyId=1
 */
export const getOrderHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const orderId = Number(req.params.id)
    const familyId = Number(req.query.familyId)
    if (!familyId) return res.fail('familyId 不能为空')

    const order = await orderService.getOrder(req.userId, familyId, orderId)
    if (!order) return res.fail('订单不存在', 404)
    res.success(order)
})

/**
 * POST /api/order
 * Body: { familyId, items: [{ dishId, quantity }], remark? }
 */
export const createOrderHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const { familyId, items, remark } = req.body || {}
    if (!familyId) return res.fail('familyId 不能为空')
    if (!Array.isArray(items) || items.length === 0) return res.fail('订单项不能为空')

    try {
        const result = await orderService.createOrder(req.userId, Number(familyId), {
            items: items.map((it: any) => ({
                dishId: Number(it.dishId),
                quantity: Number(it.quantity)
            })),
            remark
        })
        res.success(result, '下单成功')
    } catch (err) {
        res.fail((err as Error).message)
    }
})

/**
 * PATCH /api/order/:id/confirm
 * Body: { familyId }
 */
export const confirmOrderHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const orderId = Number(req.params.id)
    const { familyId } = req.body || {}
    if (!familyId) return res.fail('familyId 不能为空')

    try {
        const ok = await orderService.confirmOrder(req.userId, Number(familyId), orderId)
        if (!ok) return res.fail('订单状态变更失败')
        res.success(null, '已确认')
    } catch (err) {
        res.fail((err as Error).message)
    }
})

/**
 * PATCH /api/order/:id/complete
 * Body: { familyId }
 */
export const completeOrderHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const orderId = Number(req.params.id)
    const { familyId } = req.body || {}
    if (!familyId) return res.fail('familyId 不能为空')

    try {
        const ok = await orderService.completeOrder(req.userId, Number(familyId), orderId)
        if (!ok) return res.fail('订单状态变更失败')
        res.success(null, '已完成')
    } catch (err) {
        res.fail((err as Error).message)
    }
})

/**
 * PATCH /api/order/:id/cancel
 * Body: { familyId }
 */
export const cancelOrderHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const orderId = Number(req.params.id)
    const { familyId } = req.body || {}
    if (!familyId) return res.fail('familyId 不能为空')

    try {
        const ok = await orderService.cancelOrder(req.userId, Number(familyId), orderId)
        if (!ok) return res.fail('订单状态变更失败')
        res.success(null, '已取消')
    } catch (err) {
        res.fail((err as Error).message)
    }
})
