/**
 * 任务 Service
 * - 列表/详情：家庭成员可见
 * - 创建/更新/删除/发布/暂停：管理员
 * - 接单：家庭成员可接指派给自己的已发布任务
 * - 完成：接单成员完成并获取积分奖励（task_reward）
 *
 * 数据表：task（主表） + task_assignee（指派关系，1:N）
 */
import { pool, query, queryOne, insert, update } from '../db'
import type { TaskRow, TaskAssigneeRow, TaskStatus, TaskCategory } from '../types/db'
import type { Task, TaskAssignee, CreateTaskPayload, UpdateTaskPayload, TakeTaskResult, CompleteTaskResult } from '../types/api'
import { requireMember, requireAdmin, getMemberRole } from './permissionService'
import { recordPointsInternal } from './pointsService'

/** 合法任务状态 */
const VALID_STATUS: TaskStatus[] = ['draft', 'published', 'paused', 'completed']

/** 合法任务分类 */
const VALID_CATEGORY: TaskCategory[] = ['cooking', 'shopping', 'cleaning', 'washing', 'other']

/** 分类中文名 */
const CATEGORY_NAME: Record<TaskCategory, string> = {
    cooking: '做饭',
    shopping: '购物',
    cleaning: '打扫',
    washing: '洗碗',
    other: '其他'
}

/** 行映射：task_assignee + user → TaskAssignee */
function toTaskAssignee(row: TaskAssigneeRow & { nickname?: string; avatar_url?: string }): TaskAssignee {
    return {
        id: row.id,
        taskId: row.task_id,
        userId: row.user_id,
        nickname: row.nickname || '',
        avatar: row.avatar_url || '',
        isTaken: row.is_taken === 1,
        assignedAt: row.assigned_at || '',
        takenAt: row.taken_at || '',
        completedAt: row.completed_at || ''
    }
}

/** 加载任务的指派列表 */
async function loadAssignees(taskId: number): Promise<TaskAssignee[]> {
    const rows = await query<Array<TaskAssigneeRow & { nickname: string; avatar_url: string }>>(
        `SELECT ta.*, u.nickname, u.avatar_url
         FROM task_assignee ta
         INNER JOIN user u ON ta.user_id = u.id
         WHERE ta.task_id = ?
         ORDER BY ta.id ASC`,
        [taskId]
    )
    return rows.map(toTaskAssignee)
}

/** 行映射：task + creator → Task */
async function toTask(row: TaskRow & { creator_nickname?: string }): Promise<Task> {
    const assignees = await loadAssignees(row.id)
    return {
        id: row.id,
        familyId: row.family_id,
        creatorId: row.creator_id,
        creatorName: row.creator_nickname || '',
        title: row.title,
        description: row.description,
        category: row.category,
        categoryName: row.category_name,
        points: row.points,
        deadline: row.deadline,
        status: row.status,
        assignees,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    }
}

/**
 * 任务列表（按家庭，可按状态筛选）
 */
export async function listTasks(
    userId: number,
    familyId: number,
    options?: { status?: TaskStatus; mine?: boolean }
): Promise<Task[]> {
    await requireMember(userId, familyId)

    const conditions = ['t.family_id = ?']
    const params: any[] = [familyId]

    if (options?.status) {
        conditions.push('t.status = ?')
        params.push(options.status)
    }
    if (options?.mine) {
        conditions.push('EXISTS (SELECT 1 FROM task_assignee ta WHERE ta.task_id = t.id AND ta.user_id = ?)')
        params.push(userId)
    }

    const rows = await query<Array<TaskRow & { creator_nickname: string }>>(
        `SELECT t.*, u.nickname AS creator_nickname
         FROM task t
         INNER JOIN user u ON t.creator_id = u.id
         WHERE ${conditions.join(' AND ')}
         ORDER BY t.deadline ASC, t.id DESC`,
        params
    )

    return Promise.all(rows.map(toTask))
}

/**
 * 任务详情
 */
export async function getTask(
    userId: number,
    familyId: number,
    taskId: number
): Promise<Task | null> {
    await requireMember(userId, familyId)
    const row = await queryOne<TaskRow & { creator_nickname: string }>(
        `SELECT t.*, u.nickname AS creator_nickname
         FROM task t
         INNER JOIN user u ON t.creator_id = u.id
         WHERE t.id = ? AND t.family_id = ?`,
        [taskId, familyId]
    )
    if (!row) return null
    return toTask(row)
}

/**
 * 创建任务（管理员，事务）
 * - 写入 task 主表
 * - 写入 task_assignee 指派关系（可多人）
 */
export async function createTask(
    creatorId: number,
    familyId: number,
    data: CreateTaskPayload
): Promise<{ taskId: number }> {
    await requireAdmin(creatorId, familyId)

    if (!data.title || !data.title.trim()) throw new Error('任务标题不能为空')
    if (!data.deadline) throw new Error('截止日期不能为空')
    if (!Number.isFinite(data.points ?? 0) || (data.points ?? 0) < 0) {
        throw new Error('积分奖励必须 >= 0')
    }

    const category = (data.category || 'other') as TaskCategory
    if (!VALID_CATEGORY.includes(category)) throw new Error('任务分类非法')

    const categoryName = data.categoryName || CATEGORY_NAME[category]
    const points = Math.floor(data.points ?? 0)
    const status: TaskStatus = data.status && VALID_STATUS.includes(data.status) ? data.status : 'draft'
    const assigneeIds = Array.from(new Set((data.assigneeIds || []).map(Number).filter(id => id > 0)))

    // 校验指派对象均属于该家庭
    if (assigneeIds.length > 0) {
        const placeholders = assigneeIds.map(() => '?').join(',')
        const rows = await query<Array<{ user_id: number }>>(
            `SELECT user_id FROM family_member WHERE family_id = ? AND user_id IN (${placeholders})`,
            [familyId, ...assigneeIds]
        )
        if (rows.length !== assigneeIds.length) {
            throw new Error('部分指派对象不属于该家庭')
        }
    }

    const conn = await pool.getConnection()
    try {
        await conn.beginTransaction()

        const [tRes] = await conn.query(
            `INSERT INTO task (family_id, creator_id, title, description, category, category_name, points, deadline, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [familyId, creatorId, data.title.trim(), data.description || '', category, categoryName, points, data.deadline, status]
        )
        const taskId = (tRes as any).insertId

        for (const uid of assigneeIds) {
            await conn.query(
                `INSERT INTO task_assignee (task_id, user_id, is_taken, assigned_at)
                 VALUES (?, ?, 0, NOW())`,
                [taskId, uid]
            )
        }

        await conn.commit()
        return { taskId }
    } catch (err) {
        await conn.rollback()
        throw err
    } finally {
        conn.release()
    }
}

/**
 * 更新任务（管理员）
 * - 可更新基础字段
 * - 若提供 assigneeIds 则全量替换指派关系（仅对未接单的记录替换）
 */
export async function updateTask(
    operatorId: number,
    familyId: number,
    taskId: number,
    data: UpdateTaskPayload
): Promise<boolean> {
    await requireAdmin(operatorId, familyId)

    const task = await queryOne<TaskRow>(
        `SELECT * FROM task WHERE id = ? AND family_id = ?`,
        [taskId, familyId]
    )
    if (!task) throw new Error('任务不存在')

    const fields: string[] = []
    const params: any[] = []

    if (data.title !== undefined) {
        if (!data.title.trim()) throw new Error('任务标题不能为空')
        fields.push('title = ?')
        params.push(data.title.trim())
    }
    if (data.description !== undefined) {
        fields.push('description = ?')
        params.push(data.description)
    }
    if (data.category !== undefined) {
        const category = data.category as TaskCategory
        if (!VALID_CATEGORY.includes(category)) throw new Error('任务分类非法')
        fields.push('category = ?')
        params.push(category)
        if (data.categoryName !== undefined) {
            fields.push('category_name = ?')
            params.push(data.categoryName)
        } else {
            fields.push('category_name = ?')
            params.push(CATEGORY_NAME[category])
        }
    } else if (data.categoryName !== undefined) {
        fields.push('category_name = ?')
        params.push(data.categoryName)
    }
    if (data.points !== undefined) {
        if (!Number.isFinite(data.points) || data.points < 0) throw new Error('积分奖励必须 >= 0')
        fields.push('points = ?')
        params.push(Math.floor(data.points))
    }
    if (data.deadline !== undefined) {
        if (!data.deadline) throw new Error('截止日期不能为空')
        fields.push('deadline = ?')
        params.push(data.deadline)
    }

    const conn = await pool.getConnection()
    try {
        await conn.beginTransaction()

        if (fields.length > 0) {
            await conn.query(
                `UPDATE task SET ${fields.join(', ')} WHERE id = ? AND family_id = ?`,
                [...params, taskId, familyId]
            )
        }

        if (data.assigneeIds !== undefined) {
            const assigneeIds = Array.from(new Set(data.assigneeIds.map(Number).filter(id => id > 0)))

            // 校验指派对象均属于该家庭
            if (assigneeIds.length > 0) {
                const placeholders = assigneeIds.map(() => '?').join(',')
                const [chkRows] = await conn.query(
                    `SELECT user_id FROM family_member WHERE family_id = ? AND user_id IN (${placeholders})`,
                    [familyId, ...assigneeIds]
                )
                if ((chkRows as any[]).length !== assigneeIds.length) {
                    throw new Error('部分指派对象不属于该家庭')
                }
            }

            // 删除未接单的指派记录，保留已接单/已完成的
            await conn.query(
                `DELETE FROM task_assignee WHERE task_id = ? AND is_taken = 0`,
                [taskId]
            )

            // 重新插入（跳过已存在的）
            for (const uid of assigneeIds) {
                await conn.query(
                    `INSERT IGNORE INTO task_assignee (task_id, user_id, is_taken, assigned_at)
                     VALUES (?, ?, 0, NOW())`,
                    [taskId, uid]
                )
            }
        }

        await conn.commit()
        return true
    } catch (err) {
        await conn.rollback()
        throw err
    } finally {
        conn.release()
    }
}

/**
 * 删除任务（管理员）
 */
export async function deleteTask(
    operatorId: number,
    familyId: number,
    taskId: number
): Promise<boolean> {
    await requireAdmin(operatorId, familyId)

    const conn = await pool.getConnection()
    try {
        await conn.beginTransaction()

        const [r] = await conn.query(
            `DELETE FROM task WHERE id = ? AND family_id = ?`,
            [taskId, familyId]
        )
        if ((r as any).affectedRows === 0) {
            throw new Error('任务不存在')
        }
        await conn.query(`DELETE FROM task_assignee WHERE task_id = ?`, [taskId])

        await conn.commit()
        return true
    } catch (err) {
        await conn.rollback()
        throw err
    } finally {
        conn.release()
    }
}

/**
 * 修改任务状态（管理员）
 */
async function changeStatus(
    operatorId: number,
    familyId: number,
    taskId: number,
    next: TaskStatus,
    allowedFrom: TaskStatus[]
): Promise<boolean> {
    await requireAdmin(operatorId, familyId)

    const task = await queryOne<TaskRow>(
        `SELECT * FROM task WHERE id = ? AND family_id = ?`,
        [taskId, familyId]
    )
    if (!task) throw new Error('任务不存在')
    if (!allowedFrom.includes(task.status)) {
        throw new Error(`当前状态「${task.status}」不允许变更为「${next}」`)
    }

    const affected = await update(
        `UPDATE task SET status = ? WHERE id = ? AND family_id = ? AND status IN (?)`,
        [next, taskId, familyId, allowedFrom]
    )
    return affected > 0
}

/** 发布任务（draft → published） */
export async function publishTask(operatorId: number, familyId: number, taskId: number): Promise<boolean> {
    return changeStatus(operatorId, familyId, taskId, 'published', ['draft', 'paused'])
}

/** 暂停任务（published → paused） */
export async function pauseTask(operatorId: number, familyId: number, taskId: number): Promise<boolean> {
    return changeStatus(operatorId, familyId, taskId, 'paused', ['published'])
}

/**
 * 接单（家庭成员）
 * - 任务必须为 published
 * - 必须在指派列表中
 * - 同一任务同一用户只能接一次
 */
export async function takeTask(
    userId: number,
    familyId: number,
    taskId: number
): Promise<TakeTaskResult> {
    await requireMember(userId, familyId)

    const task = await queryOne<TaskRow>(
        `SELECT * FROM task WHERE id = ? AND family_id = ?`,
        [taskId, familyId]
    )
    if (!task) throw new Error('任务不存在')
    if (task.status !== 'published') throw new Error('任务当前状态不可接单')

    const assignee = await queryOne<TaskAssigneeRow>(
        `SELECT * FROM task_assignee WHERE task_id = ? AND user_id = ?`,
        [taskId, userId]
    )
    if (!assignee) throw new Error('该任务未指派给您')
    if (assignee.is_taken === 1) throw new Error('您已接单')

    const now = new Date()
    await update(
        `UPDATE task_assignee SET is_taken = 1, taken_at = NOW() WHERE id = ?`,
        [assignee.id]
    )

    return {
        taskId,
        userId,
        takenAt: now.toISOString().replace('T', ' ').slice(0, 19)
    }
}

/**
 * 完成任务（接单成员）
 * - 任务必须为 published
 * - 当前用户必须已接单
 * - 事务：更新 task_assignee.completed_at、task.status、写积分流水、更新 user.points
 */
export async function completeTask(
    userId: number,
    familyId: number,
    taskId: number
): Promise<CompleteTaskResult> {
    await requireMember(userId, familyId)

    const task = await queryOne<TaskRow>(
        `SELECT * FROM task WHERE id = ? AND family_id = ?`,
        [taskId, familyId]
    )
    if (!task) throw new Error('任务不存在')
    if (task.status !== 'published') throw new Error('任务当前状态不可完成')

    const assignee = await queryOne<TaskAssigneeRow>(
        `SELECT * FROM task_assignee WHERE task_id = ? AND user_id = ?`,
        [taskId, userId]
    )
    if (!assignee) throw new Error('该任务未指派给您')
    if (assignee.is_taken !== 1) throw new Error('请先接单')
    if (assignee.completed_at) throw new Error('任务已完成')

    // 当前用户在该家庭的积分余额
    const memberRow = await queryOne<{ points: number }>(
        `SELECT points FROM family_member WHERE family_id = ? AND user_id = ?`,
        [familyId, userId]
    )
    if (!memberRow) throw new Error('用户不属于该家庭')
    const currentPoints = Number(memberRow.points) || 0
    const reward = Number(task.points) || 0
    const nextBalance = currentPoints + reward

    const now = new Date()
    const completedAt = now.toISOString().replace('T', ' ').slice(0, 19)

    const conn = await pool.getConnection()
    try {
        await conn.beginTransaction()

        // 更新指派记录
        const [aRes] = await conn.query(
            `UPDATE task_assignee SET completed_at = NOW() WHERE id = ? AND completed_at IS NULL`,
            [assignee.id]
        )
        if ((aRes as any).affectedRows === 0) throw new Error('任务已完成')

        // 更新任务状态为已完成
        const [tRes] = await conn.query(
            `UPDATE task SET status = 'completed' WHERE id = ? AND family_id = ? AND status = 'published'`,
            [taskId, familyId]
        )
        if ((tRes as any).affectedRows === 0) throw new Error('任务状态变更失败')

        // 更新该成员在该家庭的积分
        const [uRes] = await conn.query(
            `UPDATE family_member SET points = ? WHERE family_id = ? AND user_id = ?`,
            [nextBalance, familyId, userId]
        )
        if ((uRes as any).affectedRows === 0) throw new Error('用户积分更新失败')

        // 写入积分流水
        await recordPointsInternal(conn, {
            userId,
            familyId,
            change: reward,
            balance: nextBalance,
            type: 'task_reward',
            referenceType: 'task',
            referenceId: taskId,
            description: `完成任务：${task.title}`
        })

        await conn.commit()
        return {
            taskId,
            userId,
            points: reward,
            balance: nextBalance,
            completedAt
        }
    } catch (err) {
        await conn.rollback()
        throw err
    } finally {
        conn.release()
    }
}
