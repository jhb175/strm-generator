# STRM Generator

## 项目介绍
STRM Generator 是一个基于 FastAPI 和 React 开发的自动化工具，用于扫描云盘或本地存储的媒体文件，并生成对应的 `.strm` 存根文件，以便在 Emby、Jellyfin 或 Plex 等媒体服务器中进行流式播放，从而节省大量本地存储空间。

## 功能特性
- **自动化扫描**：支持深度遍历指定目录结构，自动发现媒体文件（如 mp4, mkv, avi 等）。
- **批量生成 STRM**：快速为海量媒体库生成结构一致的 `.strm` 文件。
- **直观的 Web UI**：提供现代化的响应式管理界面，随时监控生成进度和状态。
- **目录映射支持**：支持将云盘挂载路径灵活映射为外部可访问的直链或播放路径。
- **轻量级且易部署**：前后端分离架构，提供 Docker Compose 一键部署方案。

## 目录结构
```text
strm-project/
├── backend/            # FastAPI 后端服务
├── frontend/           # React + TypeScript 前端界面
├── docker-compose.yml  # Docker 容器编排文件
└── README.md           # 项目文档
```

## 快速开始

### 前置要求
- 已安装 Docker 和 Docker Compose

### 一键启动
```bash
git clone <repository_url>
cd strm-project
docker-compose up -d
```

### 访问地址
- 前端管理界面：`http://localhost:8888`
- 后端 API 接口：`http://localhost:3011`

## 目录映射说明

| 挂载类型 | 容器内路径 | 宿主机路径 | 说明 |
| --- | --- | --- | --- |
| 源文件目录 | `/data/clouddrive/gdrive` | 你的云盘挂载路径 | 存放实际媒体文件的位置 |
| 输出目录 | `/opt/strm_yesy/output` | 你期望生成 STRM 的路径 | 媒体服务器（如 Emby）读取的目录 |

## STRM 文件格式说明
`.strm` 文件本质上是一个纯文本文件，内部包含实际媒体文件的直接播放链接或挂载路径。

**示例：**
如果源文件路径为 `/data/clouddrive/gdrive/Movies/Avatar.mkv`，生成的 `Avatar.strm` 文件内容可能是：
```text
http://你的直链域名/Movies/Avatar.mkv
```
或直接指向本地挂载路径（取决于配置）。

## API 接口列表

| 接口路径 | 方法 | 描述 |
| --- | --- | --- |
| `/api/login` | POST | 用户登录，获取 Token |
| `/api/scan` | POST | 触发目录扫描和 STRM 生成任务 |
| `/api/status` | GET | 获取当前任务的进度和状态 |
| `/api/config` | GET | 获取系统当前映射配置 |
| `/api/config` | PUT | 更新系统映射配置 |

## 配置说明

### 环境变量
可以通过修改 `docker-compose.yml` 或 `.env` 文件来配置：
- `SOURCE_DIR`：媒体文件源目录（默认：`/data/clouddrive/gdrive`）
- `OUTPUT_DIR`：STRM 文件输出目录（默认：`/opt/strm_yesy/output`）

### 默认账号密码
系统首次启动后，使用以下默认凭据登录：
- **账号：** `admin`
- **密码：** `strm2026`
*(建议登录后尽快修改默认密码)*

## 常见问题

**Q: 生成的 STRM 文件媒体服务器无法识别怎么办？**
A: 请确保媒体服务器具有 `/opt/strm_yesy/output` 目录的读取权限，并且 STRM 文件内的链接可被媒体服务器访问。

**Q: 如何重新扫描已更新的目录？**
A: 在 Web UI 界面点击“重新扫描”按钮，或通过 API 发送 `POST /api/scan` 请求。

## License
MIT License.