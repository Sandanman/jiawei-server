/**
 * 订单 Service
 * - 列表/详情：家庭成员可见
 * - 创建：家庭成员均可下单
 * - 状态流转：管理员可确认/完成/取消；下单者可取消自己的待确认订单
 */
import { pool, query, queryOne, insert, update } from '../db'
import type { OrderRow, OrderItemRow, OrderStatus } from '../types/db'
import type { Order, OrderItem } from '../types/api'
import { requireMember, requireAdmin, getMemberRole } from './permissionService'
import { recordPointsInternal } from './pointsService'

function toOrderItem(row: OrderItemRow): OrderItem {
    return {
        id: row.id,
        orderId: row.order_id,
        dishId: row.dish_id,
        dishName: row.dish_name,
        dishImageUrl: row.dish_image_url,
        price: Number(row.price),
        points: row.points,
        quantity: row.quantity,
        subtotal: Number(row.subtotal)
    }
}

async function loadOrderItems(orderId: number): Promise<OrderItem[]> {
    const rows = await query<OrderItemRow[]>(
        `SELECT * FROM order_item WHERE order_id = ? ORDER BY id ASC`,
        [orderId]
    )
    return rows.map(toOrderItem)
}

async function toOrder(row: OrderRow & { nickname?: string }): Promise<Order> {
    const items = await loadOrderItems(row.id)
    return {
        id: row.id,
        orderNo: row.order_no,
        familyId: row.family_id,
        userId: row.user_id,
        userNickname: row.nickname || '',
        items,
        totalAmount: Number(row.total_amount),
        totalPoints: row.total_points,
        status: row.status,
        remark: row.remark,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    }
}

/**
 * 订单列表（按家庭，可按状态筛选）
 */
export async function listOrders(
    userId: number,
    familyId: number,
    options?: { status?: OrderStatus; mine?: boolean }
): Promise<Order[]> {
    await requireMember(userId, familyId)

    const conditions = ['o.family_id = ?']
    const params: any[] = [familyId]

    if (options?.status) {
        conditions.push('o.status = ?')
        params.push(options.status)
    }
    if (options?.mine) {
        conditions.push('o.user_id = ?')
        params.push(userId)
    }

    const rows = await query<Array<OrderRow & { nickname: string }>>(
        `SELECT o.*, u.nickname
         FROM \`order\` o
         INNER JOIN user u ON o.user_id = u.id
         WHERE ${conditions.join(' AND ')}
         ORDER BY o.created_at DESC`,
        params
    )

    return Promise.all(rows.map(toOrder))
}

/**
 * 订单详情
 */
export async function getOrder(userId: number, familyId: number, orderId: number): Promise<Order | null> {
    await requireMember(userId, familyId)
    const row = await queryOne<OrderRow & { nickname: string }>(
        `SELECT o.*, u.nickname FROM \`order\` o
         INNER JOIN user u ON o.user_id = u.id
         WHERE o.id = ? AND o.family_id = ?`,
        [orderId, familyId]
    )
    if (!row) return null
    return toOrder(row)
}

/**
 * 下单（事务）
 * - 校验菜品属于该家庭且已上架
 * - 扣库存
 * - 创建订单 + 订单明细
 * - 扣减下单者积分（若 totalPoints > 0），写入 order_deduct 流水
 */
export async function createOrder(
    userId: number,
    familyId: number,
    data: {
        items: Array<{ dishId: number; quantity: number }>
        remark?: string
    }
): Promise<{ orderId: number; orderNo: string; totalAmount: number; totalPoints: number }> {
    await requireMember(userId, familyId)

    if (!data.items || data.items.length === 0) {
        throw new Error('订单不能为空')
    }

    // 拉取菜品快照
    const dishIds = data.items.map(it => it.dishId)
    const placeholders = dishIds.map(() => '?').join(',')
    const dishes = await query<Array<{ id: number; name: string; price: string; points: number; image_url: string; stock: number; is_published: number }>>(
        `SELECT id, name, price, points, image_url, stock, is_published FROM dish WHERE id IN (${placeholders}) AND family_id = ?`,
        [...dishIds, familyId]
    )

    if (dishes.length !== dishIds.length) {
        throw new Error('部分菜品不存在')
    }

    // 校验上架与库存
    let totalAmount = 0
    let totalPoints = 0
    const itemRows: Array<{
        dishId: number
        name: string
        imageUrl: string
        price: number
        points: number
        quantity: number
        subtotal: number
    }> = []

    for (const it of data.items) {
        if (it.quantity <= 0) throw new Error('数量必须大于 0')
        const dish = dishes.find(d => d.id === it.dishId)!
        if (dish.is_published !== 1) throw new Error(`菜品「${dish.name}」已下架`)
        if (dish.stock < it.quantity) throw new Error(`菜品「${dish.name}」库存不足`)

        const price = Number(dish.price)
        const subtotal = price * it.quantity
        totalAmount += subtotal
        totalPoints += dish.points * it.quantity

        itemRows.push({
            dishId: dish.id,
            name: dish.name,
            imageUrl: dish.image_url,
            price,
            points: dish.points,
            quantity: it.quantity,
            subtotal
        })
    }

    // 预检积分余额（事务内还会再校验一次），按家庭隔离
    if (totalPoints > 0) {
        const memberRow = await queryOne<{ points: number }>(
            `SELECT points FROM family_member WHERE family_id = ? AND user_id = ?`,
            [familyId, userId]
        )
        if (!memberRow) throw new Error('用户不属于该家庭')
        const currentPoints = Number(memberRow.points) || 0
        if (currentPoints < totalPoints) {
            throw new Error(`积分不足，需要 ${totalPoints}，当前余额 ${currentPoints}`)
        }
    }

    const orderNo = `ORD${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`

    const conn = await pool.getConnection()
    try {
        await conn.beginTransaction()

        // 扣库存
        for (const it of itemRows) {
            const [r] = await conn.query(
                `UPDATE dish SET stock = stock - ? WHERE id = ? AND stock >= ?`,
                [it.quantity, it.dishId, it.quantity]
            )
            if ((r as any).affectedRows === 0) {
                throw new Error(`菜品「${it.name}」库存不足`)
            }
        }

        // 创建订单
        const [orderRes] = await conn.query(
            `INSERT INTO \`order\` (order_no, family_id, user_id, total_amount, total_points, status, remark)
             VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
            [orderNo, familyId, userId, totalAmount.toFixed(2), totalPoints, data.remark || '']
        )
        const orderId = (orderRes as any).insertId

        // 创建订单明细
        for (const it of itemRows) {
            await conn.query(
                `INSERT INTO order_item (order_id, dish_id, dish_name, dish_image_url, price, points, quantity, subtotal)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [orderId, it.dishId, it.name, it.imageUrl, it.price.toFixed(2), it.points, it.quantity, it.subtotal.toFixed(2)]
            )
        }

        // 扣减下单者积分并写入流水（按家庭隔离）
        if (totalPoints > 0) {
            const [uRow] = await conn.query(
                `SELECT points FROM family_member WHERE family_id = ? AND user_id = ? FOR UPDATE`,
                [familyId, userId]
            )
            const currentPoints = Number((uRow as any[])[0]?.points) || 0
            if (currentPoints < totalPoints) {
                throw new Error(`积分不足，需要 ${totalPoints}，当前余额 ${currentPoints}`)
            }
            const nextBalance = currentPoints - totalPoints
            const [uRes] = await conn.query(
                `UPDATE family_member SET points = ? WHERE family_id = ? AND user_id = ?`,
                [nextBalance, familyId, userId]
            )
            if ((uRes as any).affectedRows === 0) throw new Error('积分扣减失败')

            await recordPointsInternal(conn, {
                userId,
                familyId,
                change: -totalPoints,
                balance: nextBalance,
                type: 'order_deduct',
                referenceType: 'order',
                referenceId: orderId,
                description: `下单消耗 ${totalPoints} 积分（订单 ${orderNo}）`
            })
        }

        await conn.commit()
        return { orderId, orderNo, totalAmount, totalPoints }
    } catch (err) {
        await conn.rollback()
        throw err
    } finally {
        conn.release()
    }
}

/**
 * 状态流转
 */
async function changeStatus(
    userId: number,
    familyId: number,
    orderId: number,
    next: OrderStatus,
    allowedFrom: OrderStatus[]
): Promise<boolean> {
    const order = await queryOne<OrderRow>(
        `SELECT * FROM \`order\` WHERE id = ? AND family_id = ?`,
        [orderId, familyId]
    )
    if (!order) throw new Error('订单不存在')
    if (!allowedFrom.includes(order.status)) {
        throw new Error(`订单状态不允许变更为 ${next}`)
    }

    const affected = await update(
        `UPDATE \`order\` SET status = ? WHERE id = ? AND family_id = ? AND status IN (?)`,
        [next, orderId, familyId, allowedFrom]
    )
    return affected > 0
}

/**
 * 确认订单（管理员）
 */
export async function confirmOrder(userId: number, familyId: number, orderId: number): Promise<boolean> {
    await requireAdmin(userId, familyId)
    return changeStatus(userId, familyId, orderId, 'confirmed', ['pending'])
}

/**
 * 完成订单（管理员，事务）
 * - 状态流转：confirmed → completed
 * - 发放下单者积分奖励（dish_reward）：按订单金额每元 1 积分（向下取整）
 * - 写入积分流水
 */
export async function completeOrder(userId: number, familyId: number, orderId: number): Promise<boolean> {
    await requireAdmin(userId, familyId)

    const order = await queryOne<OrderRow>(
        `SELECT * FROM \`order\` WHERE id = ? AND family_id = ?`,
        [orderId, familyId]
    )
    if (!order) throw new Error('订单不存在')
    if (order.status !== 'confirmed') {
        throw new Error(`订单状态不允许变更为 completed`)
    }

    // 计算奖励积分：每消费 1 元奖励 1 积分（向下取整）
    const reward = Math.floor(Number(order.total_amount) || 0)

    const conn = await pool.getConnection()
    try {
        await conn.beginTransaction()

        // 状态流转
        const [updRes] = await conn.query(
            `UPDATE \`order\` SET status = 'completed' WHERE id = ? AND family_id = ? AND status = 'confirmed'`,
            [orderId, familyId]
        )
        if ((updRes as any).affectedRows === 0) {
            throw new Error('订单状态变更失败，可能已被其他操作修改')
        }

        // 发放积分奖励（按家庭隔离，发放给下单者）
        if (reward > 0) {
            const [uRow] = await conn.query(
                `SELECT points FROM family_member WHERE family_id = ? AND user_id = ? FOR UPDATE`,
                [familyId, order.user_id]
            )
            const currentPoints = Number((uRow as any[])[0]?.points) || 0
            const nextBalance = currentPoints + reward
            const [uRes] = await conn.query(
                `UPDATE family_member SET points = ? WHERE family_id = ? AND user_id = ?`,
                [nextBalance, familyId, order.user_id]
            )
            if ((uRes as any).affectedRows === 0) throw new Error('用户积分更新失败')

            await recordPointsInternal(conn, {
                userId: order.user_id,
                familyId,
                change: reward,
                balance: nextBalance,
                type: 'dish_reward',
                referenceType: 'order',
                referenceId: orderId,
                description: `订单完成奖励 ${reward} 积分（订单 ${order.order_no}）`
            })
        }

        await conn.commit()
        return true
    } catch (err) {
        await conn.rollback()
        throw err
    } finally {
        conn.release()
    }
}

/**
 * 取消订单（事务）
 * - 管理员：可取消 pending/confirmed
 * - 下单者：可取消自己的 pending
 * - 归还库存
 * - 退还下单者已扣积分（若订单消耗过积分），写入 order_deduct 退还流水
 */
export async function cancelOrder(userId: number, familyId: number, orderId: number): Promise<boolean> {
    const role = await getMemberRole(userId, familyId)
    if (!role) throw new Error('无权访问该家庭')

    const order = await queryOne<OrderRow>(
        `SELECT * FROM \`order\` WHERE id = ? AND family_id = ?`,
        [orderId, familyId]
    )
    if (!order) throw new Error('订单不存在')

    if (role.isAdmin) {
        // 管理员可取消 pending / confirmed
        if (!['pending', 'confirmed'].includes(order.status)) {
            throw new Error('当前状态不可取消')
        }
    } else if (order.user_id === userId) {
        // 下单者仅可取消待确认
        if (order.status !== 'pending') {
            throw new Error('仅待确认订单可取消')
        }
    } else {
        throw new Error('无权限取消此订单')
    }

    const items = await query<OrderItemRow[]>(
        `SELECT * FROM order_item WHERE order_id = ?`,
        [orderId]
    )

    const conn = await pool.getConnection()
    try {
        await conn.beginTransaction()

        // 变更订单状态为 cancelled
        const [updRes] = await conn.query(
            `UPDATE \`order\` SET status = 'cancelled' WHERE id = ? AND family_id = ? AND status IN ('pending','confirmed')`,
            [orderId, familyId]
        )
        if ((updRes as any).affectedRows === 0) {
            throw new Error('订单状态变更失败，可能已被其他操作修改')
        }

        // 归还库存
        for (const it of items) {
            await conn.query(
                `UPDATE dish SET stock = stock + ? WHERE id = ?`,
                [it.quantity, it.dish_id]
            )
        }

        // 退还下单者已扣积分（仅当订单有积分消耗且尚未完成发放时），按家庭隔离
        const totalPoints = Number(order.total_points) || 0
        if (totalPoints > 0 && order.status !== 'completed') {
            const [uRow] = await conn.query(
                `SELECT points FROM family_member WHERE family_id = ? AND user_id = ? FOR UPDATE`,
                [familyId, order.user_id]
            )
            const currentPoints = Number((uRow as any[])[0]?.points) || 0
            const nextBalance = currentPoints + totalPoints
            await conn.query(
                `UPDATE family_member SET points = ? WHERE family_id = ? AND user_id = ?`,
                [nextBalance, familyId, order.user_id]
            )

            await recordPointsInternal(conn, {
                userId: order.user_id,
                familyId,
                change: totalPoints,
                balance: nextBalance,
                type: 'order_deduct',
                referenceType: 'order',
                referenceId: orderId,
                description: `取消订单退还 ${totalPoints} 积分（订单 ${order.order_no}）`
            })
        }

        await conn.commit()
        return true
    } catch (err) {
        await conn.rollback()
        throw err
    } finally {
        conn.release()
    }
}
