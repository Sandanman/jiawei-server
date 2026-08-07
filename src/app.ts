import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'

import { config } from './config'
import { testConnection } from './db'
import { responseEnhance } from './middlewares/response'
import { errorHandler, notFound } from './middlewares/errorHandler'
import healthRouter from './routes/health'
import apiRouter from './routes'
import authRouter from './routes/auth'
import familyRouter from './routes/family'
import dishRouter from './routes/dish'
import orderRouter from './routes/order'
import pointsRouter from './routes/points'
import taskRouter from './routes/task'
import rewardRouter from './routes/reward'

const app = express()

// ===== 基础中间件 =====
app.use(helmet())
app.use(cors({
    origin: '*', // 开发阶段允许所有来源，生产环境需配置白名单
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(morgan(config.app.isDev ? 'dev' : 'combined'))
app.use(responseEnhance)

// ===== 路由 =====
app.use('/api/health', healthRouter)
app.use('/api', apiRouter)
app.use('/api/auth', authRouter)
app.use('/api/family', familyRouter)
app.use('/api/dish', dishRouter)
app.use('/api/order', orderRouter)
app.use('/api/points', pointsRouter)
app.use('/api/task', taskRouter)
app.use('/api/reward', rewardRouter)

// ===== 错误处理 =====
app.use(notFound)
app.use(errorHandler)

// ===== 启动 =====
async function bootstrap(): Promise<void> {
    try {
        await testConnection()

        app.listen(config.app.port, () => {
            console.log('========================================')
            console.log(`  jiawei-server 启动成功`)
            console.log(`  环境: ${config.app.nodeEnv}`)
            console.log(`  地址: http://localhost:${config.app.port}`)
            console.log(`  健康检查: http://localhost:${config.app.port}/api/health`)
            console.log('========================================')
        })
    } catch (err) {
        console.error('[BOOTSTRAP] 启动失败:', err)
        process.exit(1)
    }
}

bootstrap()

export default app
