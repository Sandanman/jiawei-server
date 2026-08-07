/**
 * API 响应/业务类型
 */
import type { FamilyRole } from './db'

export interface ApiResponse<T = any> {
    code: number
    message: string
    data: T
}

/** JWT 载荷 */
export interface JwtPayload {
    userId: number
    nickname: string
    iat?: number
    exp?: number
}

/** 登录响应 */
export interface LoginResult {
    token: string
    user: {
        id: number
        nickname: string
        avatar: string
        phone: string
        points: number
    }
    families: FamilyBrief[]
}

/** 家庭简介（登录/列表返回） */
export interface FamilyBrief {
    familyId: number
    familyName: string
    familyCode: string
    role: FamilyRole
    isAdmin: boolean
    isOwner: boolean
    points: number
    adminRemark: string
}

/** 菜品 */
export interface Dish {
    id: number
    familyId: number
    name: string
    description: string
    price: number
    points: number
    category: string
    imageUrl: string
    stock: number
    isPublished: boolean
    sortOrder: number
    createdAt: string
    updatedAt: string
}

/** 订单明细 */
export interface OrderItem {
    id: number
    orderId: number
    dishId: number
    dishName: string
    dishImageUrl: string
    price: number
    points: number
    quantity: number
    subtotal: number
}

/** 订单 */
export interface Order {
    id: number
    orderNo: string
    familyId: number
    userId: number
    userNickname: string
    items: OrderItem[]
    totalAmount: number
    totalPoints: number
    status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
    remark: string
    createdAt: string
    updatedAt: string
}

/** 积分流水 */
export interface PointsRecord {
    id: number
    familyId: number
    userId: number
    userNickname: string
    pointsChange: number
    pointsBalance: number
    type: import('./db').PointsRecordType
    referenceType: import('./db').PointsReferenceType
    referenceId: number
    description: string
    createdAt: string
}

/** 积分汇总项：某成员当前积分 */
export interface PointsSummary {
    userId: number
    nickname: string
    avatar: string
    role: import('./db').FamilyRole
    adminRemark: string
    isOwner: boolean
    points: number
    joinedAt: string
}

/** 任务指派项 */
export interface TaskAssignee {
    id: number
    taskId: number
    userId: number
    nickname: string
    avatar: string
    isTaken: boolean
    assignedAt: string
    takenAt: string
    completedAt: string
}

/** 任务 */
export interface Task {
    id: number
    familyId: number
    creatorId: number
    creatorName: string
    title: string
    description: string
    category: string
    categoryName: string
    points: number
    deadline: string
    status: import('./db').TaskStatus
    assignees: TaskAssignee[]
    createdAt: string
    updatedAt: string
}

export interface CreateTaskPayload {
    familyId: number
    title: string
    description?: string
    category?: string
    categoryName?: string
    points?: number
    deadline: string
    assigneeIds?: number[]
    status?: import('./db').TaskStatus
}

export interface UpdateTaskPayload {
    familyId: number
    title?: string
    description?: string
    category?: string
    categoryName?: string
    points?: number
    deadline?: string
    assigneeIds?: number[]
}

export interface TakeTaskResult {
    taskId: number
    userId: number
    takenAt: string
}

export interface CompleteTaskResult {
    taskId: number
    userId: number
    points: number
    balance: number
    completedAt: string
}

// ===== 注册 / 重置密码 =====
export type RegisterType = 'phone' | 'username'

export interface RegisterPayload {
    /** 注册方式：phone=手机号密码注册（username 即手机号），username=自定义账号密码注册 */
    type: RegisterType
    /** 账号（手机号或自定义用户名） */
    username: string
    password: string
    nickname?: string
}

export interface RegisterResult {
    userId: number
    username: string
    nickname: string
}

export interface ResetPasswordPayload {
    /** 手机号（账号） */
    username: string
    newPassword: string
}
