import { Request, Response } from 'express'
import { asyncHandler } from '../utils/asyncHandler'
import * as dishService from '../services/dishService'

type AuthedRequest = Request & { userId?: number }

function getFamilyId(req: AuthedRequest): number {
    const familyId = Number(req.query.familyId || req.body?.familyId)
    return familyId
}

/**
 * GET /api/dish?familyId=1&category=炒菜&includeUnpublished=1
 */
export const listDishesHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const familyId = Number(req.query.familyId)
    if (!familyId) return res.fail('familyId 不能为空')

    const list = await dishService.listDishes(req.userId, familyId, {
        category: req.query.category as string | undefined,
        includeUnpublished: req.query.includeUnpublished === '1' || req.query.includeUnpublished === 'true'
    })
    res.success(list)
})

/**
 * GET /api/dish/:id?familyId=1
 */
export const getDishHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const dishId = Number(req.params.id)
    const familyId = getFamilyId(req)
    if (!familyId) return res.fail('familyId 不能为空')

    const dish = await dishService.getDish(req.userId, familyId, dishId)
    if (!dish) return res.fail('菜品不存在', 404)
    res.success(dish)
})

/**
 * POST /api/dish
 * Body: { familyId, name, description?, price, points?, category, imageUrl?, stock?, isPublished?, sortOrder? }
 */
export const createDishHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const { familyId, name, description, price, points, category, imageUrl, stock, isPublished, sortOrder } = req.body || {}
    if (!familyId) return res.fail('familyId 不能为空')
    if (!name || !name.trim()) return res.fail('菜品名称不能为空')
    if (price === undefined || price === null) return res.fail('价格不能为空')
    if (!category) return res.fail('分类不能为空')

    try {
        const id = await dishService.createDish(req.userId, Number(familyId), {
            name: name.trim(),
            description,
            price: Number(price),
            points: points ? Number(points) : 0,
            category,
            imageUrl,
            stock: stock !== undefined ? Number(stock) : 0,
            isPublished,
            sortOrder: sortOrder ? Number(sortOrder) : 0
        })
        res.success({ id }, '创建成功')
    } catch (err) {
        res.fail((err as Error).message)
    }
})

/**
 * PUT /api/dish/:id
 * Body: { familyId, name?, description?, price?, ... }
 */
export const updateDishHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const dishId = Number(req.params.id)
    const { familyId, name, description, price, points, category, imageUrl, stock, isPublished, sortOrder } = req.body || {}
    if (!familyId) return res.fail('familyId 不能为空')

    try {
        const ok = await dishService.updateDish(req.userId, Number(familyId), dishId, {
            name: name !== undefined ? String(name).trim() : undefined,
            description,
            price: price !== undefined ? Number(price) : undefined,
            points: points !== undefined ? Number(points) : undefined,
            category,
            imageUrl,
            stock: stock !== undefined ? Number(stock) : undefined,
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
 * DELETE /api/dish/:id?familyId=1
 */
export const deleteDishHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const dishId = Number(req.params.id)
    const familyId = getFamilyId(req)
    if (!familyId) return res.fail('familyId 不能为空')

    try {
        const ok = await dishService.deleteDish(req.userId, familyId, dishId)
        if (!ok) return res.fail('菜品不存在')
        res.success(null, '删除成功')
    } catch (err) {
        res.fail((err as Error).message)
    }
})

/**
 * PATCH /api/dish/:id/publish
 * Body: { familyId, isPublished }
 */
export const togglePublishHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const dishId = Number(req.params.id)
    const { familyId, isPublished } = req.body || {}
    if (!familyId) return res.fail('familyId 不能为空')
    if (isPublished === undefined) return res.fail('isPublished 不能为空')

    try {
        const ok = await dishService.togglePublish(req.userId, Number(familyId), dishId, !!isPublished)
        if (!ok) return res.fail('菜品不存在')
        res.success(null, isPublished ? '已上架' : '已下架')
    } catch (err) {
        res.fail((err as Error).message)
    }
})
