import mysql from 'mysql2/promise'
import { config } from '../config'

export const pool = mysql.createPool(config.dbPool)

/**
 * 执行 SQL 查询，返回带类型的行
 * 用法：const rows = await query<UserRow[]>('SELECT * FROM users WHERE id = ?', [id])
 */
export async function query<T = any>(sql: string, params: any[] = []): Promise<T> {
    const [rows] = await pool.query(sql, params)
    return rows as T
}

/**
 * 执行单行查询，返回第一行或 null
 */
export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const rows = await query<T[]>(sql, params)
    return (rows && rows.length > 0) ? rows[0] : null
}

/**
 * 插入数据，返回插入 ID
 */
export async function insert(sql: string, params: any[] = []): Promise<number> {
    const [result] = await pool.query(sql, params)
    return (result as any).insertId
}

/**
 * 更新/删除，返回影响行数
 */
export async function update(sql: string, params: any[] = []): Promise<number> {
    const [result] = await pool.query(sql, params)
    return (result as any).affectedRows
}

/**
 * 测试数据库连接
 */
export async function testConnection(): Promise<void> {
    try {
        const conn = await pool.getConnection()
        await conn.ping()
        conn.release()
        console.log(`[DB] 数据库连接成功: ${config.db.database}@${config.db.host}:${config.db.port}`)
    } catch (err) {
        console.error('[DB] 数据库连接失败:', err)
        throw err
    }
}
