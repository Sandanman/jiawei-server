import { Request, Response } from 'express'
import { asyncHandler } from '../utils/asyncHandler'
import * as familyService from '../services/familyService'

type AuthedRequest = Request & { userId?: number }

/**
 * GET /api/family
 * 当前用户的家庭列表
 */
export const listFamiliesHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const list = await familyService.listFamilies(req.userId)
    res.success(list)
})

/**
 * GET /api/family/:id
 * 家庭详情
 */
export const getFamilyHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const familyId = Number(req.params.id)
    if (!familyId) return res.fail('家庭 ID 无效')

    const detail = await familyService.getFamilyDetail(req.userId, familyId)
    if (!detail) return res.fail('家庭不存在或无权访问', 404)

    res.success(detail)
})

/**
 * POST /api/family
 * 创建家庭
 * Body: { familyName: string, description?: string }
 */
export const createFamilyHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const { familyName, description } = req.body || {}
    if (!familyName || !familyName.trim()) {
        return res.fail('家庭名称不能为空')
    }

    const result = await familyService.createFamily(req.userId, {
        familyName: familyName.trim(),
        description
    })
    res.success(result, '创建成功')
})

/**
 * PUT /api/family/:id
 * 更新家庭信息（owner/admin）
 */
export const updateFamilyHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const familyId = Number(req.params.id)
    const { familyName, description } = req.body || {}

    try {
        const ok = await familyService.updateFamily(req.userId, familyId, {
            familyName,
            description
        })
        if (!ok) return res.fail('没有需要更新的字段')
        res.success(null, '更新成功')
    } catch (err) {
        res.fail((err as Error).message)
    }
})

/**
 * GET /api/family/:id/members
 * 成员列表
 */
export const listMembersHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const familyId = Number(req.params.id)

    // 简单校验：调用者需是家庭成员
    const detail = await familyService.getFamilyDetail(req.userId, familyId)
    if (!detail) return res.fail('家庭不存在或无权访问', 404)

    const members = await familyService.listMembers(familyId)
    res.success(members)
})

/**
 * PATCH /api/family/:id/members/:userId
 * 修改成员角色/备注（owner）
 * Body: { role?: 'owner'|'admin'|'member', adminRemark?: string }
 */
export const updateMemberHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const familyId = Number(req.params.id)
    const targetUserId = Number(req.params.userId)
    const { role, adminRemark } = req.body || {}

    try {
        const ok = await familyService.updateMemberRole(req.userId, familyId, targetUserId, {
            role,
            adminRemark
        })
        if (!ok) return res.fail('没有需要更新的字段')
        res.success(null, '更新成功')
    } catch (err) {
        res.fail((err as Error).message)
    }
})

/**
 * DELETE /api/family/:id/members/:userId
 * 移除成员 / 退出家庭
 */
export const removeMemberHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const familyId = Number(req.params.id)
    const targetUserId = Number(req.params.userId)

    try {
        const ok = await familyService.removeMember(req.userId, familyId, targetUserId)
        if (!ok) return res.fail('移除失败')
        res.success(null, '已移除')
    } catch (err) {
        res.fail((err as Error).message)
    }
})

/**
 * POST /api/family/:id/invitation
 * 生成邀请码（owner/admin）
 * Body: { expiresHours?: number }
 */
export const createInvitationHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const familyId = Number(req.params.id)

    // 校验权限
    const detail = await familyService.getFamilyDetail(req.userId, familyId)
    if (!detail) return res.fail('家庭不存在或无权访问', 404)
    if (!detail.isAdmin) return res.fail('无权限生成邀请码', 403)

    const { expiresHours } = req.body || {}
    const result = await familyService.createInvitation(familyId, expiresHours || 24)
    res.success(result, '邀请码已生成')
})

/**
 * POST /api/family/join
 * 通过邀请码加入家庭
 * Body: { code: string, adminRemark?: string }
 */
export const joinFamilyHandler = asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.userId) return res.fail('未登录', 401)
    const { code, adminRemark } = req.body || {}
    if (!code) return res.fail('邀请码不能为空')

    try {
        const result = await familyService.joinByInvitation(req.userId, code, adminRemark)
        res.success(result, '加入成功')
    } catch (err) {
        res.fail((err as Error).message)
    }
})
