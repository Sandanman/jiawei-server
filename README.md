# jiawei-server

家味小札后端服务（Express + TypeScript + MySQL）

## 技术栈

- **运行时**：Node.js + Express 4
- **语言**：TypeScript 5 (strict)
- **数据库**：MySQL（mysql2/promise 连接池）
- **开发工具**：ts-node-dev 热重载

## 目录结构

```
jiawei-server/
├── src/
│   ├── app.ts                 # 应用入口
│   ├── config/
│   │   └── index.ts           # 配置（端口/DB/JWT）
│   ├── db/
│   │   └── index.ts           # MySQL 连接池 + 工具方法
│   ├── middlewares/
│   │   ├── auth.ts            # 鉴权中间件占位
│   │   ├── errorHandler.ts    # 统一错误处理
│   │   └── response.ts        # 响应封装 res.success/res.fail
│   ├── routes/
│   │   ├── index.ts           # API 路由汇总
│   │   └── health.ts          # 健康检查
│   ├── controllers/           # 控制器（待添加）
│   ├── services/              # 业务服务（待添加）
│   ├── utils/
│   │   └── asyncHandler.ts    # 异步错误捕获
│   └── types/                 # 类型定义（待添加）
├── .env.example               # 环境变量模板
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填写本地 MySQL 连接信息：

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=你的密码
DB_NAME=jiawei
```

### 3. 开发运行

```bash
npm run dev
```

启动后访问：
- 健康检查：http://localhost:3000/api/health
- API 根路径：http://localhost:3000/api

### 4. 构建

```bash
npm run build
npm start
```

## API 约定

### 统一响应格式

```json
{
    "code": 0,
    "message": "success",
    "data": {}
}
```

- `code: 0` 表示成功，非 0 表示失败
- `message` 描述信息
- `data` 业务数据

### 规划中的接口模块

| 模块 | 路径 | 说明 |
|------|------|------|
| 鉴权 | `/api/auth` | 登录、JWT |
| 家庭 | `/api/family` | 家庭管理 |
| 成员 | `/api/members` | 成员管理 |
| 菜单 | `/api/menu` | 菜单管理 |
| 订单 | `/api/orders` | 点餐订单 |
| 任务 | `/api/tasks` | 任务管理 |
| 积分 | `/api/points` | 积分管理 |

## 数据库

- 本地 MySQL 库名：`jiawei`
- 表结构已存在，含部分 mock 数据
- 后续规划上云（建议保持连接配置外置）

## 后续规划

- [ ] JWT 鉴权
- [ ] 各业务模块路由/控制器/服务
- [ ] 请求参数校验（joi / zod）
- [ ] 日志落盘（winston）
- [ ] 迁移到 NestJS
