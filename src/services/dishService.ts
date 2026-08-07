/**
 * 菜品 Service
 * - 所有操作需校验家庭成员身份
 * - 创建/更新/删除/上下架需管理员权限
 */
import { pool, query, queryOne, insert, update } from '../db'
import type { DishRow } from '../types/db'
import type { Dish } from '../types/api'
import { requireMember, requireAdmin } from './permissionService'

function toDish(row: DishRow): Dish {
    return {
        id: row.id,
        familyId: row.family_id,
        name: row.name,
        description: row.description,
        price: Number(row.price),
        points: row.points,
        category: row.category,
        imageUrl: row.image_url,
        stock: row.stock,
        isPublished: row.is_published === 1,
        sortOrder: row.sort_order,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    }
}

/**
 * 菜品列表（默认只返回上架菜品，includeUnpublished=true 返回全部）
 */
export async function listDishes(
    userId: number,
    familyId: number,
    options?: { category?: string; includeUnpublished?: boolean }
): Promise<Dish[]> {
    await requireMember(userId, familyId)

    const conditions = ['family_id = ?']
    const params: any[] = [familyId]

    if (options?.category) {
        conditions.push('category = ?')
        params.push(options.category)
    }
    if (!options?.includeUnpublished) {
        conditions.push('is_published = 1')
    }

    const rows = await query<DishRow[]>(
        `SELECT * FROM dish WHERE ${conditions.join(' AND ')} ORDER BY sort_order ASC, id ASC`,
        params
    )
    return rows.map(toDish)
}

/**
 * 菜品详情
 */
export async function getDish(userId: number, familyId: number, dishId: number): Promise<Dish | null> {
    await requireMember(userId, familyId)
    const row = await queryOne<DishRow>(
        `SELECT * FROM dish WHERE id = ? AND family_id = ?`,
        [dishId, familyId]
    )
    return row ? toDish(row) : null
}

/**
 * 创建菜品（管理员）
 */
export async function createDish(
    userId: number,
    familyId: number,
    data: {
        name: string
        description?: string
        price: number
        points?: number
        category: string
        imageUrl?: string
        stock?: number
        isPublished?: boolean
        sortOrder?: number
    }
): Promise<number> {
    await requireAdmin(userId, familyId)

    return insert(
        `INSERT INTO dish (family_id, name, description, price, points, category, image_url, stock, is_published, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            familyId,
            data.name,
            data.description || '',
            data.price,
            data.points || 0,
            data.category,
            data.imageUrl || '',
            data.stock || 0,
            data.isPublished ? 1 : 0,
            data.sortOrder || 0
        ]
    )
}

/**
 * 更新菜品（管理员）
 */
export async function updateDish(
    userId: number,
    familyId: number,
    dishId: number,
    data: {
        name?: string
        description?: string
        price?: number
        points?: number
        category?: string
        imageUrl?: string
        stock?: number
        isPublished?: boolean
        sortOrder?: number
    }
): Promise<boolean> {
    await requireAdmin(userId, familyId)

    const sets: string[] = []
    const params: any[] = []

    if (data.name !== undefined) { sets.push('name = ?'); params.push(data.name) }
    if (data.description !== undefined) { sets.push('description = ?'); params.push(data.description) }
    if (data.price !== undefined) { sets.push('price = ?'); params.push(data.price) }
    if (data.points !== undefined) { sets.push('points = ?'); params.push(data.points) }
    if (data.category !== undefined) { sets.push('category = ?'); params.push(data.category) }
    if (data.imageUrl !== undefined) { sets.push('image_url = ?'); params.push(data.imageUrl) }
    if (data.stock !== undefined) { sets.push('stock = ?'); params.push(data.stock) }
    if (data.isPublished !== undefined) { sets.push('is_published = ?'); params.push(data.isPublished ? 1 : 0) }
    if (data.sortOrder !== undefined) { sets.push('sort_order = ?'); params.push(data.sortOrder) }

    if (sets.length === 0) return false

    params.push(dishId, familyId)
    const affected = await update(
        `UPDATE dish SET ${sets.join(', ')} WHERE id = ? AND family_id = ?`,
        params
    )
    return affected > 0
}

/**
 * 删除菜品（管理员）
 */
export async function deleteDish(userId: number, familyId: number, dishId: number): Promise<boolean> {
    await requireAdmin(userId, familyId)
    const affected = await update(
        `DELETE FROM dish WHERE id = ? AND family_id = ?`,
        [dishId, familyId]
    )
    return affected > 0
}

/**
 * 上下架切换（管理员）
 */
export async function togglePublish(
    userId: number,
    familyId: number,
    dishId: number,
    isPublished: boolean
): Promise<boolean> {
    await requireAdmin(userId, familyId)
    const affected = await update(
        `UPDATE dish SET is_published = ? WHERE id = ? AND family_id = ?`,
        [isPublished ? 1 : 0, dishId, familyId]
    )
    return affected > 0
}
