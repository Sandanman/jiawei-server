import { Router } from 'express'
import { authRequired } from '../middlewares/auth'
import {
    loginHandler,
    profileHandler,
    logoutHandler,
    registerHandler,
    resetPasswordHandler
} from '../controllers/authController'

const router: Router = Router()

/**
 * 鉴权模块路由
 */
router.post('/login', loginHandler)
router.post('/register', registerHandler)
router.post('/reset-password', resetPasswordHandler)
router.get('/profile', authRequired, profileHandler)
router.post('/logout', authRequired, logoutHandler)

export default router
