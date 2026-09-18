# 数据库结构说明（jiawei）

> 本文档配合 `docs/jiawei_db_schema.sql`（mysqldump 导出的真实建库脚本）使用。
> 换电脑后，把这两个文件一起丢给 AI 或直接执行 SQL，即可在新机器上还原数据库。

## 1. 环境信息

- 数据库：MySQL 8.0
- 数据库名：`jiawei`
- 字符集：`utf8mb4` / `utf8mb4_0900_ai_ci`
- 连接方式：`mysql2/promise` 连接池，见 `src/db/index.ts` + `src/config/index.ts`
- 环境变量（`.env`，参考 `.env.example`）：

| 变量 | 说明 | 默认值 |
|---|---|---|
| DB_HOST | 数据库主机 | localhost |
| DB_PORT | 端口 | 3306 |
| DB_USER | 用户名 | root |
| DB_PASSWORD | 密码 | （空）|
| DB_NAME | 库名 | jiawei |

## 2. 新机器重建数据库步骤

1. 安装 MySQL 8.0，启动服务
2. 执行建库脚本：
   ```bash
   mysql -uroot -p < docs/jiawei_db_schema.sql
   ```
   脚本内已包含 `CREATE DATABASE IF NOT EXISTS jiawei` + `USE jiawei` + 全部 10 张表的 `CREATE TABLE`
3. 复制 `.env.example` 为 `.env`，按实际情况填写 `DB_PASSWORD` 等
4. `npm install && npm run dev` 验证连接（`testConnection()` 会打印连接成功日志）

> 该项目没有使用迁移工具（如 Knex/Prisma/TypeORM），纯 `mysql2` 手写 SQL，因此**建库脚本是唯一的 schema 来源**，务必和代码一起保存/提交到仓库。

## 3. 表清单与用途

| 表名 | 用途 | 核心状态/枚举字段 |
|---|---|---|
| `user` | 用户表（小程序 openid / 手机号登录） | status: 1正常/0禁用 |
| `account` | H5 账号表（用户名密码登录，与 user 一对一/一对多） | login_type: password/phone/wechat |
| `family` | 家庭（一个“家”） | status: 1正常/0已注销 |
| `family_member` | 家庭成员关系（用户在家庭中的角色、积分） | role: owner/admin/member |
| `family_invitation` | 家庭邀请码/邀请记录 | type: code/mobile |
| `dish` | 菜品（菜单） | is_published |
| `order` | 点餐订单 | status: pending/confirmed/completed/cancelled |
| `order_item` | 订单明细（菜品快照） | — |
| `task` | 家务任务 | status: draft/published/paused/completed |
| `task_assignee` | 任务指派/接单关系 | is_taken |
| `points_record` | 积分流水 | type: order_deduct/task_reward/dish_reward/manual_add/manual_subtract/reward_deduct |
| `reward` | 积分商城奖励商品 | category: physical/gift/play/dish |
| `reward_order` | 奖励兑换记录 | status: pending/received/cancelled |

## 4. 表关联关系（逻辑外键，未在 DB 层建约束，仅靠代码保证一致性）

```
user (1) ──< account            账号表，一个用户可有一个H5账号
user (1) ──< family.owner_id    用户创建的家庭（房主）
family (1) ──< family_member >── user   多对多关系表（家庭 ⇄ 用户）
family (1) ──< family_invitation        家庭的邀请码列表
family (1) ──< dish                     家庭下的菜品
family (1) ──< order                    家庭下的订单
user   (1) ──< order                    用户下的订单
order  (1) ──< order_item               订单明细（dish 快照，非强关联）
order_item.dish_id -> dish.id           冗余快照关联，不强制外键
family (1) ──< task                     家庭下的任务
task   (1) ──< task_assignee >── user   任务 ⇄ 受让人（多对多）
user/family ──< points_record           积分流水，按用户+家庭记录
points_record.reference_id              弱关联 order/task/dish/reward（由 reference_type 区分，无外键约束）
family (1) ──< reward                   家庭下的奖励商品
reward.dish_id -> dish.id               当 reward.category='dish' 时关联菜品
reward (1) ──< reward_order             奖励兑换记录（reward 快照）
family/user ──< reward_order            兑换记录归属
```

要点：

- **全部为逻辑外键**，数据库层没有 `FOREIGN KEY` 约束（mysqldump 结果中无 `CONSTRAINT`），一致性完全由 service 层代码保证。
- `order_item`、`reward_order` 大量使用**快照字段**（如 `dish_name`、`reward_points`），避免主表数据变更影响历史记录，查询时不依赖 JOIN。
- `points_record.reference_type/reference_id` 是弱关联的多态外键，无枚举约束在 DB 层，仅在 `src/types/db.ts` 的 TS 类型中约束。

## 5. 建议交给 AI 建库时的提示词

把 `docs/jiawei_db_schema.sql` 整个文件贴给 AI，并说明：

> 这是 MySQL 8.0 的建库脚本（mysqldump 导出，无数据），请帮我在本地新建这个数据库并执行建表。数据库名 jiawei，字符集 utf8mb4。

或者直接本地执行：

```bash
mysql -uroot -p < docs/jiawei_db_schema.sql
```
