# 映链 / STRM Media Bridge

## 项目介绍
映链（STRM Media Bridge）是一个基于 **FastAPI + React + TypeScript** 的 STRM 生成与管理工具，用于扫描媒体源目录、生成 `.strm` 文件，并接入 Emby / Jellyfin / Plex 等媒体服务器。

当前项目已完成：
- 前后端一体化 Docker Compose 部署
- 中文化管理界面
- HTTP Basic Auth 保护
- Emby 统计展示
- 任务中心与定时任务配置
- STRM 输出到标准媒体库目录

## 功能特性
- **自动扫描媒体库**：递归扫描电影 / 电视剧目录
- **批量生成 STRM**：生成标准化 `.strm` 文件结构
- **中文管理界面**：适合日常维护与状态查看
- **任务中心**：支持手动执行、日志查看、执行反馈
- **定时任务设置**：支持按 Cron 表达式定时执行
- **Emby 统计**：展示电影、剧集、总量、最近新增
- **Basic Auth 保护**：无需额外用户系统，直接保护后台与 API

## 技术栈
- Backend: FastAPI
- Frontend: React + TypeScript + Vite
- Deploy: Docker Compose
- Auth: HTTP Basic Auth

## 快速开始

### 前置要求
- Docker
- Docker Compose
- 已有媒体源目录

### 一键启动
```bash
git clone https://github.com/jhb175/strm-generator.git
cd strm-generator
docker compose up -d --build
```

### 默认访问地址
- 前端：`http://localhost:8888`
- 后端：`http://localhost:3011`

## 当前推荐目录映射

| 用途 | 宿主机路径 | 容器内路径 |
| --- | --- | --- |
| 媒体源目录 | `/data/clouddrive/gdrive` | `/data/clouddrive/gdrive` |
| STRM 输出目录 | `/opt/strm` | `/app/output` |
| Emby 媒体源挂载 | `/data/clouddrive/gdrive` | `/media` |
| Emby STRM 库挂载 | `/opt/strm` | `/strm` |

## STRM 内容格式
当前 `.strm` 文件内容为容器内可访问的绝对路径，例如：

```text
/media/电影/外语电影/彗星来的那一夜 (2014)/彗星来的那一夜 (2014) - 1080p.mkv
```

这要求你的媒体服务器（如 Emby）必须同时挂载：
- `/strm`：用于读取 `.strm` 文件
- `/media`：用于访问真实媒体文件

## API 概览

| 路径 | 方法 | 说明 |
| --- | --- | --- |
| `/health` | GET | 健康检查（公开） |
| `/api/tasks/scan` | POST | 扫描并生成 STRM |
| `/api/tasks/generate` | POST | 仅执行生成任务 |
| `/api/tasks/status` | GET | 查看任务状态 |
| `/api/history` | GET | 查看历史任务 |
| `/api/logs` | GET | 查看日志 |
| `/api/config` | GET/POST | 获取/保存配置 |
| `/api/scheduler` | GET/POST | 获取/保存定时任务配置 |
| `/api/emby/stats` | GET | 查看 Emby 统计 |

## 定时任务
当前项目支持保存 Cron 表达式。

示例：
- `0 * * * *` → 每小时整点执行一次
- `0 3 * * *` → 每天凌晨 3 点执行一次

## 安全说明
为了避免把这个项目直接暴露成“裸服务”，建议至少做到以下几点：

### 1. 修改默认认证信息
请不要继续使用仓库中的示例凭据。通过环境变量覆盖：

```bash
STRS_AUTH_USER=your_user
STRS_AUTH_PASS=your_strong_password
```

### 2. 不要把后端直接暴露到公网
建议：
- 仅内网访问
- 或放在反向代理后面
- 或限制来源 IP
- 或至少叠加 HTTPS

### 3. Emby / 媒体服务器挂载必须最小化
只挂载必要目录：
- `/strm`
- `/media`

避免直接把更多宿主机目录暴露给容器。

### 4. GitHub 仓库不要提交真实密钥和真实密码
请确认以下敏感信息不要进入公开仓库：
- Emby API Key
- 真实账号密码
- 私有域名 / 私有路径
- 服务器 SSH 信息

### 5. 建议配合防火墙
至少限制：
- `8888`
- `3011`
- `8096`

只允许你自己的可信来源访问。

## 常见问题

### Q1：Emby 无法识别 STRM 怎么办？
请检查两件事：
1. Emby 是否挂载了 `/strm`
2. Emby 是否挂载了 `/media`

并确认 `.strm` 文件内部路径和 Emby 容器内真实路径一致。

### Q2：为什么生成成功但媒体库没更新？
通常不是生成问题，而是 Emby 尚未刷新媒体库。请手动刷新，或通过项目的定时任务持续更新。

### Q3：为什么有些高集数剧集之前没生成？
旧版本对 4 位 episode 编号支持不足。当前版本已修复，例如：
- `S01E1046`
- `S01E1323`

## 仓库地址
- GitHub: https://github.com/jhb175/strm-generator

## License
MIT
