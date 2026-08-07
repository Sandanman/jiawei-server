import { pool, queryOne, query } from '../db'
import type { UserRow, FamilyMemberRow, FamilyRow, AccountRow } from '../types/db'
import type { LoginResult, FamilyBrief, RegisterPayload, RegisterResult } from '../types/api'
import { signToken } from '../utils/jwt'
import { verifyPassword, hashPassword } from '../utils/password'

/**
 * 获取用户已加入的家庭列表（含角色/积分）
 */
export async function getUserFamilies(userId: number): Promise<FamilyBrief[]> {
    const rows = await query<Array<FamilyMemberRow & FamilyRow>>(`
        SELECT fm.*, f.family_code, f.family_name, f.description, f.owner_id, f.status
        FROM family_member fm
        INNER JOIN family f ON fm.family_id = f.id
        WHERE fm.user_id = ? AND f.status = 1
        ORDER BY fm.joined_at ASC
    `, [userId])

    return rows.map(r => ({
        familyId: r.family_id,
        familyName: r.family_name,
        familyCode: r.family_code,
        role: r.role,
        isAdmin: r.role === 'admin' || r.role === 'owner',
        isOwner: r.role === 'owner' || r.is_owner === 1,
        points: Number(r.points) || 0, // 用户在家庭内的积分（family_member.points，按家庭隔离）
        adminRemark: r.admin_remark
    }))
}

/**
 * 账号密码登录
 * 查 account 表 → 校验密码 → 返回用户及家庭列表
 */
export async function login(username: string, password: string): Promise<LoginResult | null> {
    const account = await queryOne<AccountRow>(
        `SELECT * FROM account WHERE username = ? AND status = 1 LIMIT 1`,
        [username]
    )
    if (!account) return null

    if (!verifyPassword(password, account.password_hash)) return null

    const user = await queryOne<UserRow>(
        `SELECT * FROM user WHERE id = ? AND status = 1`,
        [account.user_id]
    )
    if (!user) return null

    // 更新最近登录时间
    await pool.query(`UPDATE account SET last_login_at = NOW() WHERE id = ?`, [account.id])

    const families = await getUserFamilies(user.id)
    const totalPoints = (await getTotalFamilyPoints(user.id)) ?? 0
    const token = signToken({ userId: user.id, nickname: user.nickname })

    return {
        token,
        user: {
            id: user.id,
            nickname: user.nickname,
            avatar: user.avatar_url,
            phone: user.phone,
            points: totalPoints
        },
        families
    }
}

/**
 * 获取当前登录用户信息
 */
export async function getProfile(userId: number): Promise<{
    id: number
    nickname: string
    avatar: string
    phone: string
    points: number
    inviteCode: string
    families: FamilyBrief[]
} | null> {
    const user = await queryOne<UserRow>(
        `SELECT * FROM user WHERE id = ? AND status = 1`,
        [userId]
    )
    if (!user) return null

    const families = await getUserFamilies(user.id)
    const totalPoints = (await getTotalFamilyPoints(user.id)) ?? 0

    return {
        id: user.id,
        nickname: user.nickname,
        avatar: user.avatar_url,
        phone: user.phone,
        points: totalPoints,
        inviteCode: user.invite_code,
        families
    }
}

/** 用户在所有家庭的积分总和（全局汇总，家庭内看 family_member.points） */
async function getTotalFamilyPoints(userId: number): Promise<number | null> {
    const row = await queryOne<{ total: number }>(
        `SELECT IFNULL(SUM(points), 0) AS total FROM family_member WHERE user_id = ?`,
        [userId]
    )
    return row ? Number(row.total) || 0 : 0
}

/**
 * 创建新用户（用于"加入家庭"等场景）
 * 返回新用户 ID
 */
export async function createUser(data: {
    nickname: string
    avatarUrl?: string
    phone?: string
}): Promise<number> {
    const inviteCode = `U${Date.now().toString(36).toUpperCase()}`
    const result = await pool.query(
        `INSERT INTO user (nickname, avatar_url, phone, invite_code, points, status)
         VALUES (?, ?, ?, ?, 0, 1)`,
        [data.nickname, data.avatarUrl || '', data.phone || '', inviteCode]
    )
    return (result[0] as any).insertId
}

// ===== 注册 / 重置密码 =====

/** 校验账号格式：手机号（11 位数字）或自定义账号（3-32 位字母数字下划线） */
function validateUsername(username: string, type: 'phone' | 'username'): string | null {
    if (!username) return '账号不能为空'
    if (type === 'phone') {
        if (!/^1[3-9]\d{9}$/.test(username)) return '手机号格式不正确'
    } else {
        if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) return '账号需为 3-32 位字母、数字或下划线'
    }
    return null
}

/** 校验密码强度：6-32 位 */
function validatePassword(password: string): string | null {
    if (!password) return '密码不能为空'
    if (password.length < 6 || password.length > 32) return '密码长度需为 6-32 位'
    return null
}

/**
 * 注册新用户
 * - type='phone'：username 为手机号，user.phone 同时写入
 * - type='username'：username 为自定义账号，user.phone 留空
 * 注册成功后，user 与 account 表均已创建（account.login_type='password'）
 */
export async function register(payload: RegisterPayload): Promise<RegisterResult> {
    const { type, username, password, nickname } = payload

    const usernameErr = validateUsername(username, type)
    if (usernameErr) throw new Error(usernameErr)
    const passwordErr = validatePassword(password)
    if (passwordErr) throw new Error(passwordErr)

    // 账号唯一性校验
    const existed = await queryOne<AccountRow>(
        `SELECT id FROM account WHERE username = ? LIMIT 1`,
        [username]
    )
    if (existed) throw new Error('该账号已被注册')

    // 手机号注册时校验手机号唯一性
    if (type === 'phone') {
        const phoneUsed = await queryOne<UserRow>(
            `SELECT id FROM user WHERE phone = ? AND status = 1 LIMIT 1`,
            [username]
        )
        if (phoneUsed) throw new Error('该手机号已被注册')
    }

    const conn = await pool.getConnection()
    try {
        await conn.beginTransaction()

        const inviteCode = `U${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1000).toString(36)}`
        const finalNickname = nickname?.trim() || (type === 'phone' ? `用户${username.slice(-4)}` : username)

        // 创建 user
        const [userResult] = await conn.query(
            `INSERT INTO user (openid, nickname, avatar_url, phone, invite_code, points, status)
             VALUES (?, ?, ?, ?, ?, 0, 1)`,
            ['', finalNickname, type === 'phone' ? username : '', inviteCode]
        )
        const userId = (userResult as any).insertId

        // 创建 account
        const passwordHash = hashPassword(password)
        await conn.query(
            `INSERT INTO account (user_id, username, password_hash, login_type, status)
             VALUES (?, ?, ?, 'password', 1)`,
            [userId, username, passwordHash]
        )

        await conn.commit()

        return {
            userId,
            username,
            nickname: finalNickname
        }
    } catch (err) {
        await conn.rollback()
        throw err
    } finally {
        conn.release()
    }
}

/**
 * 重置密码
 * 通过手机号（账号）+ 新密码直接重置（暂不校验短信验证码）
 */
export async function resetPassword(username: string, newPassword: string): Promise<void> {
    const err = validatePassword(newPassword)
    if (err) throw new Error(err)

    const account = await queryOne<AccountRow>(
        `SELECT * FROM account WHERE username = ? AND status = 1 LIMIT 1`,
        [username]
    )
    if (!account) throw new Error('账号不存在')

    const passwordHash = hashPassword(newPassword)
    await pool.query(
        `UPDATE account SET password_hash = ?, updated_at = NOW() WHERE id = ?`,
        [passwordHash, account.id]
    )
}
