/**
 * 积分商城 Reward Service
 * - 列表/详情：家庭成员可见（普通用户只看上架，管理员可看全部）
 * - 创建/更新/删除/上下架：管理员
 * - 兑换：家庭成员可兑换，扣家庭内积分（事务 + 并发锁），写 reward_deduct 流水，扣减库存
 * - 兑换记录：家庭成员可按本人/全部查看
 * - 状态流转：待领取（pending）可由本人撤销并退积分（cancelled）；管理员可确认已领取（received）
 */
import { pool, query, queryOne, insert, update } from '../db'
import type { RewardRow, RewardOrderRow, RewardCategory, RewardOrderStatus } from '../types/db'
import type { Reward, RewardOrder, RedeemRewardResult } from '../types/api'
import { requireMember, requireAdmin } from './permissionService'
import { recordPointsInternal } from './pointsService'

const VALID_CATEGORIES: RewardCategory[] = ['physical', 'gift', 'play', 'dish']
const VALID_ORDER_STATUS: RewardOrderStatus[] = ['pending', 'received', 'cancelled']

async function toReward(row: RewardRow & { dish_name?: string }): Promise<Reward> {
    let dishName = row.dish_name || ''
    // 非 dish 类型或未关联菜品时，冗余 dishName 为空
    return {
        id: row.id,
        familyId: row.family_id,
        name: row.name,
        description: row.description,
        category: row.category,
        points: row.points,
        imageUrl: row.image_url,
        stock: row.stock,
        dishId: row.dish_id ?? null,
        dishName,
        isPublished: row.is_published === 1,
        sortOrder: row.sort_order,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    }
}

async function toRewardOrder(row: RewardOrderRow & { nickname?: string; avatar_url?: string }): Promise<RewardOrder> {
    return {
        id: row.id,
        rewardId: row.reward_id,
        rewardName: row.reward_name,
        rewardImage: row.reward_image,
        rewardPoints: row.reward_points,
        category: row.category,
        familyId: row.family_id,
        userId: row.user_id,
        userNickname: row.nickname || '',
        userAvatar: row.avatar_url || '',
        remark: row.remark,
        status: row.status,
        receivedAt: row.received_at,
        receivedBy: row.received_by,
        createdAt: row.created_at
    }
}

function validateCategory(category: string): RewardCategory {
    if (!VALID_CATEGORIES.includes(category as RewardCategory)) {
        throw new Error('奖励类型非法')
    }
    return category as RewardCategory
}

/**
 * 校验 dish 类型奖励的关联菜品
 * - 返回值：dishName（用于模板展示）
 */
async function validateDishLink(familyId: number, category: RewardCategory, dishId: number | null): Promise<string> {
    if (category !== 'dish') return ''
    if (!dishId) throw new Error('菜品兑换奖励必须关联菜品')
    const dish = await queryOne<{ id: number; name: string; is_published: number }>(
        `SELECT id, name, is_published FROM dish WHERE id = ? AND family_id = ?`,
        [dishId, familyId]
    )
    if (!dish) throw new Error('关联的菜品不存在')
    return dish.name
}

/**
 * 奖励商品列表
 * - 普通用户：仅上架
 * - 管理员：includeUnpublished=true 时返回全部
 */
export async function listRewards(
    userId: number,
    familyId: number,
    options?: { category?: RewardCategory; includeUnpublished?: boolean }
): Promise<Reward[]> {
    await requireMember(userId, familyId)

    const conditions = ['r.family_id = ?']
    const params: any[] = [familyId]

    if (options?.category) {
        conditions.push('r.category = ?')
        params.push(validateCategory(options.category))
    }
    if (!options?.includeUnpublished) {
        conditions.push('r.is_published = 1')
    }

    const rows = await query<Array<RewardRow & { dish_name: string }>>(
        `SELECT r.*, d.name AS dish_name
         FROM reward r
         LEFT JOIN dish d ON r.dish_id = d.id
         WHERE ${conditions.join(' AND ')}
         ORDER BY r.sort_order ASC, r.id ASC`,
        params
    )
    return Promise.all(rows.map(toReward))
}

/**
 * 奖励商品详情
 */
export async function getReward(userId: number, familyId: number, rewardId: number): Promise<Reward | null> {
    await requireMember(userId, familyId)
    const row = await queryOne<RewardRow & { dish_name: string }>(
        `SELECT r.*, d.name AS dish_name
         FROM reward r
         LEFT JOIN dish d ON r.dish_id = d.id
         WHERE r.id = ? AND r.family_id = ?`,
        [rewardId, familyId]
    )
    return row ? toReward(row) : null
}

/**
 * 创建奖励（管理员）
 */
export async function createReward(
    userId: number,
    familyId: number,
    data: {
        name: string
        description?: string
        category: RewardCategory
        points: number
        imageUrl?: string
        stock?: number
        dishId?: number | null
        isPublished?: boolean
        sortOrder?: number
    }
): Promise<number> {
    await requireAdmin(userId, familyId)
    if (!data.name || !data.name.trim()) throw new Error('奖励名称不能为空')

    const category = validateCategory(data.category)
    if (!Number.isFinite(data.points) || data.points <= 0) throw new Error('所需积分必须大于 0')

    await validateDishLink(familyId, category, data.dishId ?? null)

    return insert(
        `INSERT INTO reward (family_id, name, description, category, points, image_url, stock, dish_id, is_published, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            familyId,
            data.name.trim(),
            data.description || '',
            category,
            data.points,
            data.imageUrl || '',
            data.stock === undefined ? -1 : Number(data.stock),
            data.dishId ?? null,
            data.isPublished ? 1 : 0,
            data.sortOrder || 0
        ]
    )
    // dishName 供模板展示使用；storage 阶段仅用于校验
}

/**
 * 更新奖励（管理员）
 */
export async function updateReward(
    userId: number,
    familyId: number,
    rewardId: number,
    data: {
        name?: string
        description?: string
        category?: RewardCategory
        points?: number
        imageUrl?: string
        stock?: number
        dishId?: number | null
        isPublished?: boolean
        sortOrder?: number
    }
): Promise<boolean> {
    await requireAdmin(userId, familyId)

    const existing = await queryOne<RewardRow>(
        `SELECT * FROM reward WHERE id = ? AND family_id = ?`,
        [rewardId, familyId]
    )
    if (!existing) throw new Error('奖励不存在')

    const category = data.category !== undefined ? validateCategory(data.category) : existing.category
    if (data.points !== undefined && (!Number.isFinite(data.points) || data.points <= 0)) {
        throw new Error('所需积分必须大于 0')
    }
    // 若类型变更或调整菜品关联，需重新校验菜品联动
    const dishId = data.dishId !== undefined ? (data.dishId ?? null) : existing.dish_id
    await validateDishLink(familyId, category, dishId)

    const sets: string[] = []
    const params: any[] = []

    if (data.name !== undefined) { sets.push('name = ?'); params.push(String(data.name).trim()) }
    if (data.description !== undefined) { sets.push('description = ?'); params.push(data.description) }
    if (data.category !== undefined) { sets.push('category = ?'); params.push(category) }
    if (data.points !== undefined) { sets.push('points = ?'); params.push(data.points) }
    if (data.imageUrl !== undefined) { sets.push('image_url = ?'); params.push(data.imageUrl) }
    if (data.stock !== undefined) { sets.push('stock = ?'); params.push(Number(data.stock)) }
    if (data.dishId !== undefined) { sets.push('dish_id = ?'); params.push(dishId) }
    if (data.isPublished !== undefined) { sets.push('is_published = ?'); params.push(data.isPublished ? 1 : 0) }
    if (data.sortOrder !== undefined) { sets.push('sort_order = ?'); params.push(data.sortOrder) }

    if (sets.length === 0) return false

    params.push(rewardId, familyId)
    const affected = await update(
        `UPDATE reward SET ${sets.join(', ')} WHERE id = ? AND family_id = ?`,
        params
    )
    return affected > 0
}

/**
 * 删除奖励（管理员）
 * - 若已有兑换记录，禁止删除（保留快照与流水）
 */
export async function deleteReward(userId: number, familyId: number, rewardId: number): Promise<boolean> {
    await requireAdmin(userId, familyId)

    const used = await queryOne<{ cnt: number }>(
        `SELECT COUNT(*) AS cnt FROM reward_order WHERE reward_id = ? AND family_id = ?`,
        [rewardId, familyId]
    )
    if (used && Number(used.cnt) > 0) throw new Error('该奖励已有兑换记录，无法删除')

    const affected = await update(
        `DELETE FROM reward WHERE id = ? AND family_id = ?`,
        [rewardId, familyId]
    )
    return affected > 0
}

/**
 * 上架/下架（管理员）
 */
export async function toggleRewardPublish(
    userId: number,
    familyId: number,
    rewardId: number,
    isPublished: boolean
): Promise<boolean> {
    await requireAdmin(userId, familyId)
    const affected = await update(
        `UPDATE reward SET is_published = ? WHERE id = ? AND family_id = ?`,
        [isPublished ? 1 : 0, rewardId, familyId]
    )
    return affected > 0
}

/**
 * 兑换奖励（事务）
 * - 校验奖励上架、库存、积分充足
 * - 行锁扣减用户家庭积分
 * - 扣减库存（stock != -1）
 * - 写入 reward_order 记录（status=pending）
 * - 写入 reward_deduct 积分流水
 */
export async function redeemReward(
    userId: number,
    familyId: number,
    data: {
        rewardId: number
        remark?: string
    }
): Promise<RedeemRewardResult> {
    await requireMember(userId, familyId)

    const reward = await queryOne<RewardRow>(
        `SELECT * FROM reward WHERE id = ? AND family_id = ?`,
        [data.rewardId, familyId]
    )
    if (!reward) throw new Error('奖励不存在')
    if (reward.is_published !== 1) throw new Error('该奖励未上架')
    if (reward.stock === 0) throw new Error('该奖励已售罄')

    const conn = await pool.getConnection()
    try {
        await conn.beginTransaction()

        // 锁定用户积分并校验
        const [uRow] = await conn.query(
            `SELECT points FROM family_member WHERE family_id = ? AND user_id = ? FOR UPDATE`,
            [familyId, userId]
        )
        const currentPoints = Number((uRow as any[])[0]?.points) || 0
        if (currentPoints < reward.points) {
            throw new Error(`积分不足，需要 ${reward.points}，当前余额 ${currentPoints}`)
        }
        const nextBalance = currentPoints - reward.points

        // 扣减库存（仅在有限量时）
        if (reward.stock > 0) {
            const [sRes] = await conn.query(
                `UPDATE reward SET stock = stock - 1 WHERE id = ? AND stock > 0`,
                [data.rewardId]
            )
            if ((sRes as any).affectedRows === 0) throw new Error('该奖励已售罄')
        }

        // 扣减用户家庭积分
        const [uRes] = await conn.query(
            `UPDATE family_member SET points = ? WHERE family_id = ? AND user_id = ?`,
            [nextBalance, familyId, userId]
        )
        if ((uRes as any).affectedRows === 0) throw new Error('积分扣减失败')

        // 写入兑换记录
        const [oRes] = await conn.query(
            `INSERT INTO reward_order (reward_id, reward_name, reward_image, reward_points, category, family_id, user_id, remark, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [
                reward.id,
                reward.name,
                reward.image_url,
                reward.points,
                reward.category,
                familyId,
                userId,
                data.remark || ''
            ]
        )
        const orderId = (oRes as any).insertId

        // 写入积分流水
        await recordPointsInternal(conn, {
            userId,
            familyId,
            change: -reward.points,
            balance: nextBalance,
            type: 'reward_deduct',
            referenceType: 'reward',
            referenceId: orderId,
            description: `兑换奖励：${reward.name}（-${reward.points} 积分）`
        })

        await conn.commit()
        return { orderId, balance: nextBalance }
    } catch (err) {
        await conn.rollback()
        throw err
    } finally {
        conn.release()
    }
}

/**
 * 兑换记录列表
 * - mine=true 仅本人；否则返回家庭全部
 * - 可按状态筛选
 */
export async function listRewardOrders(
    userId: number,
    familyId: number,
    options?: { userId?: number; status?: RewardOrderStatus; mine?: boolean }
): Promise<RewardOrder[]> {
    await requireMember(userId, familyId)

    const conditions = ['o.family_id = ?']
    const params: any[] = [familyId]

    if (options?.mine) {
        conditions.push('o.user_id = ?')
        params.push(userId)
    } else if (options?.userId) {
        conditions.push('o.user_id = ?')
        params.push(options.userId)
    }
    if (options?.status) {
        if (!VALID_ORDER_STATUS.includes(options.status)) throw new Error('status 参数无效')
        conditions.push('o.status = ?')
        params.push(options.status)
    }

    const rows = await query<Array<RewardOrderRow & { nickname: string; avatar_url: string }>>(
        `SELECT o.*, u.nickname, u.avatar_url
         FROM reward_order o
         INNER JOIN user u ON o.user_id = u.id
         WHERE ${conditions.join(' AND ')}
         ORDER BY o.created_at DESC, o.id DESC`,
        params
    )
    return Promise.all(rows.map(toRewardOrder))
}

/**
 * 确认已领取（管理员）
 * - 仅 pending → received 可流转
 */
export async function markRewardReceived(
    operatorId: number,
    familyId: number,
    orderId: number
): Promise<boolean> {
    await requireAdmin(operatorId, familyId)
    const affected = await update(
        `UPDATE reward_order SET status = 'received', received_at = NOW(), received_by = ?
         WHERE id = ? AND family_id = ? AND status = 'pending'`,
        [operatorId, orderId, familyId]
    )
    return affected > 0
}

/**
 * 撤销兑换（本人待领取状态）
 * - 事务：状态 pending → cancelled，退还积分，归还库存（剩余可撤），写积分流水（reward_deduct 退还）
 */
export async function cancelRewardOrder(
    userId: number,
    familyId: number,
    orderId: number
): Promise<boolean> {
    // 本人或管理员均可撤销待领取记录
    const order = await queryOne<RewardOrderRow>(
        `SELECT * FROM reward_order WHERE id = ? AND family_id = ?`,
        [orderId, familyId]
    )
    if (!order) throw new Error('兑换记录不存在')
    if (order.status !== 'pending') {
        throw new Error('仅待领取状态的兑换可撤销')
    }
    const role = await requireMember(userId, familyId)
    if (!role.isAdmin && order.user_id !== userId) {
        throw new Error('无权限撤销此兑换')
    }

    const conn = await pool.getConnection()
    try {
        await conn.beginTransaction()

        // 状态流转（并发保护）
        const [sRes] = await conn.query(
            `UPDATE reward_order SET status = 'cancelled' WHERE id = ? AND family_id = ? AND status = 'pending'`,
            [orderId, familyId]
        )
        if ((sRes as any).affectedRows === 0) throw new Error('兑换状态变更失败，可能已被处理')

        // 退还积分
        const [uRow] = await conn.query(
            `SELECT points FROM family_member WHERE family_id = ? AND user_id = ? FOR UPDATE`,
            [familyId, order.user_id]
        )
        const currentPoints = Number((uRow as any[])[0]?.points) || 0
        const nextBalance = currentPoints + order.reward_points
        await conn.query(
            `UPDATE family_member SET points = ? WHERE family_id = ? AND user_id = ?`,
            [nextBalance, familyId, order.user_id]
        )

        // 归还库存（若有限量）
        await conn.query(
            `UPDATE reward SET stock = stock + 1 WHERE id = ? AND stock >= 0`,
            [order.reward_id]
        )

        // 写积分流水
        await recordPointsInternal(conn, {
            userId: order.user_id,
            familyId,
            change: order.reward_points,
            balance: nextBalance,
            type: 'reward_deduct',
            referenceType: 'reward',
            referenceId: orderId,
            description: `撤销兑换退还积分：${order.reward_name}（+${order.reward_points} 积分）`
        })

        await conn.commit()
        return true
    } catch (err) {
        await conn.rollback()
        throw err
    } finally {
        conn.release()
    }
}
