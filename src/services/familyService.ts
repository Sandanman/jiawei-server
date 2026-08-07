import { pool, query, queryOne, update } from '../db'
import type { FamilyRow, FamilyMemberRow, FamilyInvitationRow, FamilyRole } from '../types/db'
import type { FamilyBrief } from '../types/api'
import { getUserFamilies } from './authService'

/**
 * 家庭详情（含成员数）
 */
export interface FamilyDetail extends FamilyBrief {
    description: string
    ownerId: number
    memberCount: number
    createdAt: string
}

/**
 * 将 FamilyRow + member 关系转换为 FamilyBrief
 */
function toBrief(family: FamilyRow, member: FamilyMemberRow): FamilyBrief {
    return {
        familyId: family.id,
        familyName: family.family_name,
        familyCode: family.family_code,
        role: member.role,
        isAdmin: member.role === 'admin' || member.role === 'owner',
        isOwner: member.role === 'owner' || member.is_owner === 1,
        points: Number(member.points) || 0,
        adminRemark: member.admin_remark
    }
}

/**
 * 获取当前用户的所有家庭
 */
export async function listFamilies(userId: number): Promise<FamilyBrief[]> {
    return getUserFamilies(userId)
}

/**
 * 获取家庭详情（需校验调用者是否为家庭成员）
 */
export async function getFamilyDetail(userId: number, familyId: number): Promise<FamilyDetail | null> {
    const family = await queryOne<FamilyRow>(
        `SELECT * FROM family WHERE id = ? AND status = 1`,
        [familyId]
    )
    if (!family) return null

    const member = await queryOne<FamilyMemberRow>(
        `SELECT * FROM family_member WHERE family_id = ? AND user_id = ?`,
        [familyId, userId]
    )
    if (!member) return null

    const countRow = await queryOne<{ cnt: number }>(
        `SELECT COUNT(*) AS cnt FROM family_member WHERE family_id = ?`,
        [familyId]
    )

    return {
        ...toBrief(family, member),
        description: family.description,
        ownerId: family.owner_id,
        memberCount: countRow?.cnt || 0,
        createdAt: family.created_at
    }
}

/**
 * 创建家庭（创建者自动成为 owner）
 * 事务：插入 family + 插入 family_member(owner)
 */
export async function createFamily(
    userId: number,
    data: { familyName: string; description?: string }
): Promise<{ familyId: number; familyCode: string }> {
    const familyCode = `FAML${Date.now().toString().slice(-8)}`

    const conn = await pool.getConnection()
    try {
        await conn.beginTransaction()

        const [famResult] = await conn.query(
            `INSERT INTO family (family_code, family_name, description, owner_id, status)
             VALUES (?, ?, ?, ?, 1)`,
            [familyCode, data.familyName, data.description || '', userId]
        )
        const familyId = (famResult as any).insertId

        await conn.query(
            `INSERT INTO family_member (family_id, user_id, role, admin_remark, is_owner)
             VALUES (?, ?, 'owner', '', 1)`,
            [familyId, userId]
        )

        await conn.commit()
        return { familyId, familyCode }
    } catch (err) {
        await conn.rollback()
        throw err
    } finally {
        conn.release()
    }
}

/**
 * 更新家庭信息（仅 owner/admin 可操作）
 */
export async function updateFamily(
    userId: number,
    familyId: number,
    data: { familyName?: string; description?: string }
): Promise<boolean> {
    const member = await queryOne<FamilyMemberRow>(
        `SELECT * FROM family_member WHERE family_id = ? AND user_id = ?`,
        [familyId, userId]
    )
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
        throw new Error('无权限操作')
    }

    const sets: string[] = []
    const params: any[] = []

    if (data.familyName !== undefined) {
        sets.push('family_name = ?')
        params.push(data.familyName)
    }
    if (data.description !== undefined) {
        sets.push('description = ?')
        params.push(data.description)
    }

    if (sets.length === 0) return false

    params.push(familyId)
    const affected = await update(
        `UPDATE family SET ${sets.join(', ')} WHERE id = ?`,
        params
    )
    return affected > 0
}

/**
 * 获取家庭成员列表
 */
export async function listMembers(familyId: number): Promise<Array<{
    id: number
    userId: number
    nickname: string
    avatar: string
    role: FamilyRole
    adminRemark: string
    isOwner: boolean
    joinedAt: string
}>> {
    const rows = await query<Array<FamilyMemberRow & { nickname: string; avatar_url: string }>>(`
        SELECT fm.*, u.nickname, u.avatar_url
        FROM family_member fm
        INNER JOIN user u ON fm.user_id = u.id
        WHERE fm.family_id = ?
        ORDER BY fm.is_owner DESC, fm.joined_at ASC
    `, [familyId])

    return rows.map(r => ({
        id: r.id,
        userId: r.user_id,
        nickname: r.nickname,
        avatar: r.avatar_url,
        role: r.role,
        adminRemark: r.admin_remark,
        isOwner: r.role === 'owner' || r.is_owner === 1,
        joinedAt: r.joined_at
    }))
}

/**
 * 修改成员角色/备注（仅 owner 可操作）
 */
export async function updateMemberRole(
    operatorId: number,
    familyId: number,
    targetUserId: number,
    data: { role?: FamilyRole; adminRemark?: string }
): Promise<boolean> {
    const operator = await queryOne<FamilyMemberRow>(
        `SELECT * FROM family_member WHERE family_id = ? AND user_id = ?`,
        [familyId, operatorId]
    )
    if (!operator || operator.role !== 'owner') {
        throw new Error('仅房主可修改成员角色')
    }

    const sets: string[] = []
    const params: any[] = []

    if (data.role !== undefined) {
        sets.push('role = ?')
        params.push(data.role)
    }
    if (data.adminRemark !== undefined) {
        sets.push('admin_remark = ?')
        params.push(data.adminRemark)
    }

    if (sets.length === 0) return false

    params.push(familyId, targetUserId)
    const affected = await update(
        `UPDATE family_member SET ${sets.join(', ')} WHERE family_id = ? AND user_id = ?`,
        params
    )
    return affected > 0
}

/**
 * 生成家庭邀请码
 */
export async function createInvitation(
    familyId: number,
    expiresHours = 24
): Promise<{ code: string; expiresAt: string }> {
    const code = `INV${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`

    await pool.query(
        `INSERT INTO family_invitation (family_id, code, type, is_used, expires_at)
         VALUES (?, ?, 'code', 0, NOW() + INTERVAL ? HOUR)`,
        [familyId, code, expiresHours]
    )

    const row = await queryOne<{ expires_at: string }>(
        `SELECT expires_at FROM family_invitation WHERE id = LAST_INSERT_ID()`,
        []
    )

    return { code, expiresAt: row?.expires_at || '' }
}

/**
 * 通过邀请码加入家庭
 * - 校验邀请码有效性
 * - 校验是否已是成员
 * - 插入 family_member(member)
 * - 标记邀请码已使用
 */
export async function joinByInvitation(
    userId: number,
    code: string,
    adminRemark = ''
): Promise<{ familyId: number; familyName: string }> {
    const invitation = await queryOne<FamilyInvitationRow>(
        `SELECT * FROM family_invitation WHERE code = ? AND is_used = 0`,
        [code]
    )

    if (!invitation) {
        throw new Error('邀请码无效或已被使用')
    }
    if (invitation.expires_at) {
        const expiresAt = new Date(invitation.expires_at)
        if (expiresAt.getTime() < Date.now()) {
            throw new Error('邀请码已过期')
        }
    }

    const family = await queryOne<FamilyRow>(
        `SELECT * FROM family WHERE id = ? AND status = 1`,
        [invitation.family_id]
    )
    if (!family) throw new Error('家庭不存在或已注销')

    // 是否已是成员
    const existMember = await queryOne<FamilyMemberRow>(
        `SELECT id FROM family_member WHERE family_id = ? AND user_id = ?`,
        [family.id, userId]
    )
    if (existMember) {
        throw new Error('你已经是该家庭成员')
    }

    const conn = await pool.getConnection()
    try {
        await conn.beginTransaction()
        await conn.query(
            `INSERT INTO family_member (family_id, user_id, role, admin_remark, is_owner)
             VALUES (?, ?, 'member', ?, 0)`,
            [family.id, userId, adminRemark]
        )
        await conn.query(
            `UPDATE family_invitation SET is_used = 1, used_by_user_id = ?, used_at = NOW() WHERE id = ?`,
            [userId, invitation.id]
        )
        await conn.commit()
    } catch (err) {
        await conn.rollback()
        throw err
    } finally {
        conn.release()
    }

    return { familyId: family.id, familyName: family.family_name }
}

/**
 * 移除成员
 * - owner 可移除 admin / member（不能移除 owner）
 * - admin 可移除 member（不能移除其他 admin 或 owner）
 * - 成员可退出（移除自己）
 */
export async function removeMember(
    operatorId: number,
    familyId: number,
    targetUserId: number
): Promise<boolean> {
    const target = await queryOne<FamilyMemberRow>(
        `SELECT * FROM family_member WHERE family_id = ? AND user_id = ?`,
        [familyId, targetUserId]
    )
    if (!target) throw new Error('该用户不是家庭成员')
    if (target.role === 'owner') throw new Error('不能移除房主')

    if (operatorId !== targetUserId) {
        const operator = await queryOne<FamilyMemberRow>(
            `SELECT * FROM family_member WHERE family_id = ? AND user_id = ?`,
            [familyId, operatorId]
        )
        if (!operator) throw new Error('无权操作')

        if (operator.role === 'owner') {
            // owner 可移除 admin / member，已通过上方 owner 保护
        } else if (operator.role === 'admin') {
            // admin 仅可移除 member，不可移除其他 admin
            if (target.role === 'admin') {
                throw new Error('管理员不可移除其他管理员')
            }
        } else {
            throw new Error('仅房主或管理员可移除其他成员')
        }
    }

    const affected = await update(
        `DELETE FROM family_member WHERE family_id = ? AND user_id = ?`,
        [familyId, targetUserId]
    )
    return affected > 0
}
