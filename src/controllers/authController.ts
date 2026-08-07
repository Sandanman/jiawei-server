import { Request, Response, NextFunction } from 'express'
import { login, getProfile, register, resetPassword } from '../services/authService'
import { asyncHandler } from '../utils/asyncHandler'
import type { RegisterType } from '../types/api'

/**
 * POST /api/auth/login
 * Body: { username: string, password: string }
 */
export const loginHandler = asyncHandler(async (req: Request, res: Response) => {
    const { username, password } = req.body || {}

    if (!username || !password) {
        return res.fail('账号和密码不能为空')
    }

    const result = await login(username, password)
    if (!result) {
        return res.fail('账号或密码错误', 401)
    }

    res.success(result, '登录成功')
})

/**
 * GET /api/auth/profile
 * 需携带 JWT
 */
export const profileHandler = asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
        return res.fail('未登录', 401)
    }

    const profile = await getProfile(req.userId)
    if (!profile) {
        return res.fail('用户不存在', 404)
    }

    res.success(profile)
})

/**
 * POST /api/auth/logout
 * 无状态 JWT：客户端丢弃 token 即可，服务端仅返回提示
 */
export const logoutHandler = asyncHandler(async (_req: Request, res: Response) => {
    res.success(null, '已退出登录')
})

/**
 * POST /api/auth/register
 * Body: { type: 'phone' | 'username', username, password, nickname? }
 */
export const registerHandler = asyncHandler(async (req: Request, res: Response) => {
    const { type, username, password, nickname } = req.body || {}
    if (!type || !['phone', 'username'].includes(type)) {
        return res.fail('注册类型无效')
    }
    if (!username || !password) {
        return res.fail('账号和密码不能为空')
    }

    try {
        const result = await register({
            type: type as RegisterType,
            username,
            password,
            nickname
        })
        res.success(result, '注册成功')
    } catch (err) {
        res.fail((err as Error).message)
    }
})

/**
 * POST /api/auth/reset-password
 * Body: { username, newPassword }
 */
export const resetPasswordHandler = asyncHandler(async (req: Request, res: Response) => {
    const { username, newPassword } = req.body || {}
    if (!username || !newPassword) {
        return res.fail('账号和新密码不能为空')
    }

    try {
        await resetPassword(username, newPassword)
        res.success(null, '密码已重置')
    } catch (err) {
        res.fail((err as Error).message)
    }
})
