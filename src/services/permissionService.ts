/**
 * 权限校验辅助
 * 复用 family_member 表判断用户在指定家庭中的角色
 */
import { queryOne } from '../db'
import type { FamilyMemberRow, FamilyRole } from '../types/db'

export interface MemberRole {
    role: FamilyRole
    isAdmin: boolean
    isOwner: boolean
}

/**
 * 获取用户在家庭中的成员关系，不存在返回 null
 */
export async function getMemberRole(userId: number, familyId: number): Promise<MemberRole | null> {
    const member = await queryOne<FamilyMemberRow>(
        `SELECT * FROM family_member WHERE family_id = ? AND user_id = ?`,
        [familyId, userId]
    )
    if (!member) return null
    return {
        role: member.role,
        isAdmin: member.role === 'admin' || member.role === 'owner',
        isOwner: member.role === 'owner' || member.is_owner === 1
    }
}

/**
 * 校验是否为家庭成员，否则抛错
 */
export async function requireMember(userId: number, familyId: number): Promise<MemberRole> {
    const role = await getMemberRole(userId, familyId)
    if (!role) throw new Error('无权访问该家庭')
    return role
}

/**
 * 校验是否为管理员（owner/admin），否则抛错
 */
export async function requireAdmin(userId: number, familyId: number): Promise<MemberRole> {
    const role = await requireMember(userId, familyId)
    if (!role.isAdmin) throw new Error('需要管理员权限')
    return role
}
