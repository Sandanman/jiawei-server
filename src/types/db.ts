/**
 * 数据库行类型（对应 jiawei_db.sql 的表结构）
 */

export interface UserRow {
    id: number
    openid: string
    nickname: string
    avatar_url: string
    phone: string
    invite_code: string
    points: number
    status: number
    created_at: string
    updated_at: string
}

export interface FamilyRow {
    id: number
    family_code: string
    family_name: string
    description: string
    owner_id: number
    status: number
    created_at: string
    updated_at: string
}

export type FamilyRole = 'owner' | 'admin' | 'member'

export interface FamilyMemberRow {
    id: number
    family_id: number
    user_id: number
    role: FamilyRole
    admin_remark: string
    is_owner: number
    points: number
    joined_at: string
    updated_at: string
}

export interface FamilyInvitationRow {
    id: number
    family_id: number
    code: string
    type: 'code' | 'mobile'
    is_used: number
    used_by_user_id: number | null
    expires_at: string | null
    created_at: string
    used_at: string | null
}

export interface AccountRow {
    id: number
    user_id: number
    username: string
    password_hash: string
    login_type: string
    status: number
    last_login_at: string | null
    created_at: string
    updated_at: string
}

export interface DishRow {
    id: number
    family_id: number
    name: string
    description: string
    price: string
    points: number
    category: string
    image_url: string
    stock: number
    is_published: number
    sort_order: number
    created_at: string
    updated_at: string
}

export type OrderStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'

export interface OrderRow {
    id: number
    order_no: string
    family_id: number
    user_id: number
    total_amount: string
    total_points: number
    status: OrderStatus
    remark: string
    created_at: string
    updated_at: string
}

export interface OrderItemRow {
    id: number
    order_id: number
    dish_id: number
    dish_name: string
    dish_image_url: string
    price: string
    points: number
    quantity: number
    subtotal: string
    created_at: string
}

/** 积分变动类型 */
export type PointsRecordType =
    | 'order_deduct'
    | 'task_reward'
    | 'dish_reward'
    | 'manual_add'
    | 'manual_subtract'

/** 关联类型 */
export type PointsReferenceType = '' | 'order' | 'task' | 'dish'

export interface PointsRecordRow {
    id: number
    user_id: number
    family_id: number
    points_change: number
    points_balance: number
    type: PointsRecordType
    reference_type: PointsReferenceType
    reference_id: number
    description: string
    created_at: string
}

/** 任务状态 */
export type TaskStatus = 'draft' | 'published' | 'paused' | 'completed'

/** 任务分类 */
export type TaskCategory = 'cooking' | 'shopping' | 'cleaning' | 'washing' | 'other'

export interface TaskRow {
    id: number
    family_id: number
    creator_id: number
    title: string
    description: string
    category: string
    category_name: string
    points: number
    deadline: string
    status: TaskStatus
    extra_info: string | null
    created_at: string
    updated_at: string
}

export interface TaskAssigneeRow {
    id: number
    task_id: number
    user_id: number
    is_taken: number
    assigned_at: string | null
    taken_at: string | null
    completed_at: string | null
    created_at: string
    updated_at: string
}
