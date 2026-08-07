import dotenv from 'dotenv'
import type { PoolOptions } from 'mysql2/promise'

dotenv.config()

interface AppConfig {
    port: number
    nodeEnv: string
    isDev: boolean
    isProd: boolean
}

interface DbConfig {
    host: string
    port: number
    user: string
    password: string
    database: string
}

interface JwtConfig {
    secret: string
    expiresIn: string
}

interface Config {
    app: AppConfig
    db: DbConfig
    jwt: JwtConfig
    dbPool: PoolOptions
}

const env = process.env

export const config: Config = {
    app: {
        port: Number(env.PORT) || 3000,
        nodeEnv: env.NODE_ENV || 'development',
        isDev: env.NODE_ENV !== 'production',
        isProd: env.NODE_ENV === 'production'
    },
    db: {
        host: env.DB_HOST || 'localhost',
        port: Number(env.DB_PORT) || 3306,
        user: env.DB_USER || 'root',
        password: env.DB_PASSWORD || '',
        database: env.DB_NAME || 'jiawei'
    },
    jwt: {
        secret: env.JWT_SECRET || 'dev_secret_change_me',
        expiresIn: env.JWT_EXPIRES_IN || '7d'
    },
    dbPool: {
        host: env.DB_HOST || 'localhost',
        port: Number(env.DB_PORT) || 3306,
        user: env.DB_USER || 'root',
        password: env.DB_PASSWORD || '',
        database: env.DB_NAME || 'jiawei',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        charset: 'utf8mb4',
        timezone: '+08:00'
    }
}
