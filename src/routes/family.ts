import { Router } from 'express'
import { authRequired } from '../middlewares/auth'
import {
    listFamiliesHandler,
    getFamilyHandler,
    createFamilyHandler,
    updateFamilyHandler,
    listMembersHandler,
    updateMemberHandler,
    removeMemberHandler,
    createInvitationHandler,
    joinFamilyHandler
} from '../controllers/familyController'

const router: Router = Router()

// 所有 family 接口都需要登录
router.use(authRequired)

/**
 * 家庭模块路由
 */
router.get('/', listFamiliesHandler)                         // 我的家庭列表
router.post('/', createFamilyHandler)                        // 创建家庭
router.post('/join', joinFamilyHandler)                      // 通过邀请码加入

router.get('/:id', getFamilyHandler)                         // 家庭详情
router.put('/:id', updateFamilyHandler)                      // 更新家庭信息

router.get('/:id/members', listMembersHandler)               // 成员列表
router.patch('/:id/members/:userId', updateMemberHandler)    // 修改成员角色
router.delete('/:id/members/:userId', removeMemberHandler)   // 移除/退出

router.post('/:id/invitation', createInvitationHandler)      // 生成邀请码

export default router
