-- ============================================
-- jiawei 数据库结构导出
-- 导出时间: 2026-09-18 10:39:07
-- 数据库: jiawei (MySQL 8.0)
-- 说明: 本文件由 mysqldump 从本地开发库导出，仅含表结构，不含数据
-- ============================================

CREATE DATABASE IF NOT EXISTS jiawei DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE jiawei;

--

--
-- Table structure for table `account`
--

CREATE TABLE `account` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '账号ID',
  `user_id` bigint unsigned NOT NULL COMMENT '关联用户ID',
  `username` varchar(32) NOT NULL COMMENT '登录账号',
  `password_hash` varchar(255) NOT NULL COMMENT '密码哈希（salt:hash）',
  `login_type` varchar(16) NOT NULL DEFAULT 'password' COMMENT '登录方式：password/phone/wechat',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态：1=正常 0=禁用',
  `last_login_at` datetime DEFAULT NULL COMMENT '最近登录时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='账号表（H5 登录）';

--
-- Table structure for table `dish`
--

CREATE TABLE `dish` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '菜品ID',
  `family_id` bigint unsigned NOT NULL COMMENT '家庭ID',
  `name` varchar(64) NOT NULL COMMENT '菜品名称',
  `description` varchar(512) DEFAULT '' COMMENT '菜品描述',
  `price` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT '价格（元）',
  `points` int unsigned DEFAULT '0' COMMENT '所需积分（0=仅消费现金）',
  `category` varchar(32) DEFAULT '' COMMENT '分类：主食/炒菜/汤品/凉菜/饮品/小吃',
  `image_url` varchar(512) DEFAULT '' COMMENT '菜品图片URL',
  `stock` int unsigned DEFAULT '0' COMMENT '库存',
  `is_published` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否已上架：1=上架 0=下架',
  `sort_order` int unsigned DEFAULT '0' COMMENT '排序',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_family_published` (`family_id`,`is_published`),
  KEY `idx_category` (`category`),
  KEY `idx_family_category` (`family_id`,`category`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='菜品（菜单）表';

--
-- Table structure for table `family`
--

CREATE TABLE `family` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '家庭ID',
  `family_code` varchar(32) NOT NULL COMMENT '家庭邀请码',
  `family_name` varchar(64) NOT NULL COMMENT '家庭名称',
  `description` varchar(255) DEFAULT '' COMMENT '家庭描述',
  `owner_id` bigint unsigned NOT NULL COMMENT '房主ID',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态：1=正常 0=已注销',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `family_code` (`family_code`),
  KEY `idx_owner_id` (`owner_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='家庭表';

--
-- Table structure for table `family_invitation`
--

CREATE TABLE `family_invitation` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `family_id` bigint unsigned NOT NULL COMMENT '家庭ID',
  `code` varchar(32) NOT NULL COMMENT '邀请码',
  `type` enum('code','mobile') NOT NULL DEFAULT 'code' COMMENT '邀请方式：code=邀请码 mobile=手机号',
  `is_used` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否已使用',
  `used_by_user_id` bigint unsigned DEFAULT NULL COMMENT '使用者ID',
  `expires_at` datetime DEFAULT NULL COMMENT '过期时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `used_at` datetime DEFAULT NULL COMMENT '使用时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `idx_family_id` (`family_id`),
  KEY `idx_code` (`code`),
  KEY `idx_used` (`is_used`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='家庭邀请码表';

--
-- Table structure for table `family_member`
--

CREATE TABLE `family_member` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `family_id` bigint unsigned NOT NULL COMMENT '家庭ID',
  `user_id` bigint unsigned NOT NULL COMMENT '用户ID',
  `role` enum('owner','admin','member') NOT NULL DEFAULT 'member' COMMENT '家庭内角色',
  `admin_remark` varchar(32) DEFAULT '' COMMENT '管理员备注（如：爸爸/妈妈）',
  `is_owner` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否房主（冗余，防owner_id被删）',
  `points` int unsigned DEFAULT '0' COMMENT '用户在该家庭的积分',
  `joined_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '加入时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_family_user` (`family_id`,`user_id`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='家庭成员关系表';

--
-- Table structure for table `order`
--

CREATE TABLE `order` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '订单ID',
  `order_no` varchar(32) NOT NULL COMMENT '订单号：ORD+日期+序列',
  `family_id` bigint unsigned NOT NULL COMMENT '家庭ID',
  `user_id` bigint unsigned NOT NULL COMMENT '下单用户ID',
  `total_amount` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT '总金额（元）',
  `total_points` int unsigned DEFAULT '0' COMMENT '总积分消耗',
  `status` enum('pending','confirmed','completed','cancelled') NOT NULL DEFAULT 'pending' COMMENT '订单状态',
  `remark` varchar(255) DEFAULT '' COMMENT '订单备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `order_no` (`order_no`),
  KEY `idx_family_status` (`family_id`,`status`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_user_family_time` (`user_id`,`family_id`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='订单表';

--
-- Table structure for table `order_item`
--

CREATE TABLE `order_item` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `order_id` bigint unsigned NOT NULL COMMENT '订单ID',
  `dish_id` bigint unsigned NOT NULL COMMENT '菜品ID（快照）',
  `dish_name` varchar(64) NOT NULL COMMENT '菜品名称快照',
  `dish_image_url` varchar(512) DEFAULT '' COMMENT '菜品图片快照',
  `price` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT '单价快照',
  `points` int unsigned DEFAULT '0' COMMENT '积分快照',
  `quantity` int unsigned NOT NULL DEFAULT '1' COMMENT '数量',
  `subtotal` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT '小计',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_dish_id` (`dish_id`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='订单明细表';

--
-- Table structure for table `points_record`
--

CREATE TABLE `points_record` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id` bigint unsigned NOT NULL COMMENT '用户ID',
  `family_id` bigint unsigned NOT NULL COMMENT '家庭ID',
  `points_change` int NOT NULL COMMENT '积分变动（正=收入，负=支出）',
  `points_balance` int unsigned NOT NULL COMMENT '变动后余额（不可为负）',
  `type` varchar(32) NOT NULL COMMENT '类型：order_deduct/task_reward/dish_reward/manual_add/manual_subtract',
  `reference_type` varchar(32) DEFAULT '' COMMENT '关联类型：order/task/dish',
  `reference_id` bigint unsigned DEFAULT '0' COMMENT '关联记录ID',
  `description` varchar(255) DEFAULT '' COMMENT '变动说明',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_family_id` (`family_id`),
  KEY `idx_type` (`type`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='积分流水表';

--
-- Table structure for table `reward`
--

CREATE TABLE `reward` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '奖励ID',
  `family_id` bigint unsigned NOT NULL COMMENT '家庭ID（积分按家庭隔离）',
  `name` varchar(64) NOT NULL COMMENT '奖励名称',
  `description` varchar(512) DEFAULT '' COMMENT '奖励描述',
  `category` enum('physical','gift','play','dish') NOT NULL DEFAULT 'gift' COMMENT '类型：physical=实物商品 gift=礼物 play=游玩 dish=菜品兑换',
  `points` int unsigned NOT NULL COMMENT '所需积分',
  `image_url` varchar(512) DEFAULT '' COMMENT '奖励图片URL',
  `stock` int NOT NULL DEFAULT '-1' COMMENT '库存：-1=不限量 0=已售罄 >0=剩余数量',
  `dish_id` bigint unsigned DEFAULT NULL COMMENT '关联菜品ID（category=dish 时）',
  `is_published` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否上架：1=上架 0=下架',
  `sort_order` int unsigned DEFAULT '0' COMMENT '排序（小在前）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_family_published` (`family_id`,`is_published`),
  KEY `idx_category` (`category`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='积分商城-奖励商品表';

--
-- Table structure for table `reward_order`
--

CREATE TABLE `reward_order` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '兑换记录ID',
  `reward_id` bigint unsigned NOT NULL COMMENT '奖励ID（快照参考）',
  `reward_name` varchar(64) NOT NULL COMMENT '奖励名称快照',
  `reward_image` varchar(512) DEFAULT '' COMMENT '奖励图片快照',
  `reward_points` int unsigned NOT NULL COMMENT '兑换消耗积分快照',
  `category` enum('physical','gift','play','dish') NOT NULL DEFAULT 'gift' COMMENT '奖励类型快照',
  `family_id` bigint unsigned NOT NULL COMMENT '家庭ID',
  `user_id` bigint unsigned NOT NULL COMMENT '兑换用户ID',
  `remark` varchar(255) DEFAULT '' COMMENT '兑换备注（可选）',
  `status` enum('pending','received','cancelled') NOT NULL DEFAULT 'pending' COMMENT '状态：pending=待领取 received=已领取 cancelled=已撤销',
  `received_at` datetime DEFAULT NULL COMMENT '领取时间',
  `received_by` bigint unsigned DEFAULT NULL COMMENT '确认领取的操作人ID（多为管理员）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '兑换时间',
  PRIMARY KEY (`id`),
  KEY `idx_family_status` (`family_id`,`status`),
  KEY `idx_reward_id` (`reward_id`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='积分商城-兑换记录表';

--
-- Table structure for table `task`
--

CREATE TABLE `task` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '任务ID',
  `family_id` bigint unsigned NOT NULL COMMENT '家庭ID',
  `creator_id` bigint unsigned NOT NULL COMMENT '创建者ID',
  `title` varchar(128) NOT NULL COMMENT '任务标题',
  `description` varchar(512) DEFAULT '' COMMENT '任务描述',
  `category` varchar(32) NOT NULL DEFAULT 'other' COMMENT '分类：cooking/shopping/cleaning/washing/other',
  `category_name` varchar(32) NOT NULL DEFAULT '' COMMENT '分类名称（冗余，方便展示）',
  `points` int unsigned DEFAULT '0' COMMENT '积分奖励',
  `deadline` date NOT NULL COMMENT '截止日期',
  `status` enum('draft','published','paused','completed') NOT NULL DEFAULT 'draft' COMMENT '任务状态',
  `extra_info` json DEFAULT NULL COMMENT '扩展信息（可选）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_family_status` (`family_id`,`status`),
  KEY `idx_creator_id` (`creator_id`),
  KEY `idx_deadline` (`deadline`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='任务表';

--
-- Table structure for table `task_assignee`
--

CREATE TABLE `task_assignee` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `task_id` bigint unsigned NOT NULL COMMENT '任务ID',
  `user_id` bigint unsigned NOT NULL COMMENT '受让人ID',
  `is_taken` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否已接单',
  `assigned_at` datetime DEFAULT NULL COMMENT '指派时间',
  `taken_at` datetime DEFAULT NULL COMMENT '接单时间',
  `completed_at` datetime DEFAULT NULL COMMENT '完成时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_task_user` (`task_id`,`user_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_user_status` (`user_id`,`is_taken`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='任务指派关系表';

--
-- Table structure for table `user`
--

CREATE TABLE `user` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `openid` varchar(64) DEFAULT '' COMMENT '微信openid（小程序端）',
  `nickname` varchar(64) DEFAULT '' COMMENT '昵称',
  `avatar_url` varchar(512) DEFAULT '' COMMENT '头像URL',
  `phone` varchar(20) DEFAULT '' COMMENT '手机号',
  `invite_code` varchar(32) DEFAULT '' COMMENT '个人邀请码',
  `points` int unsigned DEFAULT '0' COMMENT '个人总积分',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态：1=正常 0=禁用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `invite_code` (`invite_code`),
  KEY `idx_openid` (`openid`),
  KEY `idx_phone` (`phone`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户表';

--
-- Dumping routines for database 'jiawei'
--


-- Dump completed on 2026-09-18 10:39:07
