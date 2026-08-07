/**
 * 积分 Service
 * - 列表/详情：家庭成员可见（默认看全家流水，mine=true 仅看自己）
 * - 汇总：家庭成员可查看全家成员积分汇总
 * - 手动调整：管理员可加减积分（manual_add / manual_subtract）
 *
 * 数据库约束：points_balance 不可为负（INT UNSIGNED）
 */
import { pool, query, queryOne, insert, update } from '../db'
import type { PointsRecordRow, PointsRecordType, PointsReferenceType, FamilyMemberRow, UserRow } from '../types/db'
import type { PointsRecord, PointsSummary } from '../types/api'
import { requireMember, requireAdmin, getMemberRole } from './permissionService'

function toPointsRecord(row: PointsRecordRow & { nickname?: string }): PointsRecord {
    return {
        id: row.id,
        familyId: row.family_id,
        userId: row.user_id,
        userNickname: row.nickname || '',
        pointsChange: row.points_change,
        pointsBalance: row.points_balance,
        type: row.type,
        referenceType: row.reference_type,
        referenceId: row.reference_id,
        description: row.description,
        createdAt: row.created_at
    }
}

/**
 * 积分流水列表
 * - 默认返回家庭全部流水；mine=true 仅返回当前用户
 * - 可按 type 筛选
 * - 可按 userId 筛选（查看指定成员的流水）
 */
export async function listPointsRecords(
    userId: number,
    familyId: number,
    options?: { mine?: boolean; userId?: number; type?: PointsRecordType }
): Promise<PointsRecord[]> {
    await requireMember(userId, familyId)

    const conditions = ['p.family_id = ?']
    const params: any[] = [familyId]

    if (options?.mine) {
        conditions.push('p.user_id = ?')
        params.push(userId)
    } else if (options?.userId) {
        conditions.push('p.user_id = ?')
        params.push(options.userId)
    }
    if (options?.type) {
        conditions.push('p.type = ?')
        params.push(options.type)
    }

    const rows = await query<Array<PointsRecordRow & { nickname: string }>>(
        `SELECT p.*, u.nickname
         FROM points_record p
         INNER JOIN user u ON p.user_id = u.id
         WHERE ${conditions.join(' AND ')}
         ORDER BY p.created_at DESC, p.id DESC`,
        params
    )

    return rows.map(toPointsRecord)
}

/**
 * 积分流水详情
 */
export async function getPointsRecord(
    userId: number,
    familyId: number,
    recordId: number
): Promise<PointsRecord | null> {
    await requireMember(userId, familyId)
    const row = await queryOne<PointsRecordRow & { nickname: string }>(
        `SELECT p.*, u.nickname FROM points_record p
         INNER JOIN user u ON p.user_id = u.id
         WHERE p.id = ? AND p.family_id = ?`,
        [recordId, familyId]
    )
    if (!row) return null
    return toPointsRecord(row)
}

/**
 * 家庭成员积分汇总（按 family_member.points 字段）
 * - 家庭成员均可查看
 */
export async function listPointsSummaries(
    userId: number,
    familyId: number
): Promise<PointsSummary[]> {
    await requireMember(userId, familyId)

    const rows = await query<Array<FamilyMemberRow & { nickname: string; avatar_url: string }>>(
        `SELECT fm.*, u.nickname, u.avatar_url
         FROM family_member fm
         INNER JOIN user u ON fm.user_id = u.id
         WHERE fm.family_id = ?
         ORDER BY fm.is_owner DESC, FIELD(fm.role, 'owner', 'admin', 'member'), fm.joined_at ASC`,
        [familyId]
    )

    return rows.map(r => ({
        userId: r.user_id,
        nickname: r.nickname,
        avatar: r.avatar_url,
        role: r.role,
        adminRemark: r.admin_remark,
        isOwner: r.is_owner === 1,
        points: Number(r.points) || 0,
        joinedAt: r.joined_at
    }))
}

/**
 * 手动调整积分（管理员）
 * - type: manual_add / manual_subtract
 * - 同步更新 user.points 与 family_member.points
 * - 写入 points_record 流水
 * - 事务保证一致性
 */
export async function adjustPoints(
    operatorId: number,
    familyId: number,
    data: {
        userId: number
        points: number          // 正数；manual_add 加、manual_subtract 减
        type: 'manual_add' | 'manual_subtract'
        description?: string
    }
): Promise<{ recordId: number; balance: number }> {
    await requireAdmin(operatorId, familyId)

    if (!data.userId) throw new Error('用户不能为空')
    if (!Number.isFinite(data.points) || data.points <= 0) throw new Error('积分数额必须大于 0')
    if (!['manual_add', 'manual_subtract'].includes(data.type)) {
        throw new Error('积分类型非法')
    }

    // 校验目标用户属于该家庭
    const member = await queryOne<FamilyMemberRow>(
        `SELECT * FROM family_member WHERE family_id = ? AND user_id = ?`,
        [familyId, data.userId]
    )
    if (!member) throw new Error('目标用户不属于该家庭')

    // 当前余额（按家庭隔离）
    const currentPoints = Number(member.points) || 0

    const change = data.type === 'manual_add' ? data.points : -data.points
    const nextBalance = currentPoints + change
    if (nextBalance < 0) throw new Error('用户积分余额不足')

    const conn = await pool.getConnection()
    try {
        await conn.beginTransaction()

        // 更新该成员在该家庭的积分
        const [uRes] = await conn.query(
            `UPDATE family_member SET points = ? WHERE family_id = ? AND user_id = ?`,
            [nextBalance, familyId, data.userId]
        )
        if ((uRes as any).affectedRows === 0) throw new Error('用户积分更新失败')

        // 写入流水
        const [rRes] = await conn.query(
            `INSERT INTO points_record (user_id, family_id, points_change, points_balance, type, reference_type, reference_id, description)
             VALUES (?, ?, ?, ?, ?, '', 0, ?)`,
            [data.userId, familyId, change, nextBalance, data.type, data.description || '']
        )
        const recordId = (rRes as any).insertId

        await conn.commit()
        return { recordId, balance: nextBalance }
    } catch (err) {
        await conn.rollback()
        throw err
    } finally {
        conn.release()
    }
}

/**
 * 内部写入积分流水（供 orderService / taskService 调用）
 * - 仅写流水，不动 user.points（由调用方在事务内自行更新）
 * - 需要在外部事务内调用
 */
export async function recordPointsInternal(
    conn: any,
    params: {
        userId: number
        familyId: number
        change: number
        balance: number
        type: PointsRecordType
        referenceType?: PointsReferenceType
        referenceId?: number
        description?: string
    }
): Promise<number> {
    const [r] = await conn.query(
        `INSERT INTO points_record (user_id, family_id, points_change, points_balance, type, reference_type, reference_id, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            params.userId,
            params.familyId,
            params.change,
            params.balance,
            params.type,
            params.referenceType || '',
            params.referenceId || 0,
            params.description || ''
        ]
    )
    return (r as any).insertId
}
