# STRM Generator

一个用于将 rclone 挂载的 Google Drive 媒体目录生成 `.strm` 文件的工具，供 Emby/Jellyfin/Plex 等媒体服务器扫描刮削。

## 功能特性

- **媒体扫描**：自动识别电影和剧集，按目录结构提取元数据
- **STRM 生成**：按 Emby 期望的格式生成 `.strm` 引用文件
- **增量更新**：仅处理新增或变化的媒体，跳过未变化文件
- **孤立清理**：识别并清理源文件已删除的 orphaned STRM
- **Web UI**：深色主题管理界面，支持任务进度实时推送
- **Docker 部署**：一键启动，不依赖宿主机环境

## 目录结构

```
strm-project/
├── docker-compose.yml   # 一键部署配置
├── backend/             # FastAPI 后端
│   ├── app/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── README.md
├── frontend/           # React 前端
│   ├── src/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
```

## 快速开始

### 前置要求

- Docker & Docker Compose
- rclone 挂载的 Google Drive（或任何兼容的网盘挂载）
- 媒体目录结构参考：
  ```
  /data/clouddrive/gdrive/
  ├── 电影/
  │   └── Avatar (2009)/
  │       └── Avatar.mp4
  └── 电视剧/
      └── Breaking Bad (2008)/
          └── Season 1/
              └── Breaking Bad - S01E01 - Pilot.mp4
  ```

### 启动

```bash
git clone <your-repo-url>
cd strm-project

# 编辑 docker-compose.yml 中的宿主机路径映射
# - /data/clouddrive/gdrive  → 你的网盘挂载路径
# - strm-output              → STRM 文件输出目录

docker-compose up -d --build
```

访问 **http://你的IP:8888**

### 端口

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端 | 8888 | Web 管理界面 |
| 后端 | 3011 | REST API + WebSocket |

### 目录映射

| 宿主机路径 | 容器内路径 | 说明 |
|------------|-----------|------|
| `/data/clouddrive/gdrive` | `/data/clouddrive/gdrive` | 媒体源目录（只读） |
| `strm-output` volume | `/app/output` | STRM 文件输出目录 |
| `strm-data` volume | `/app/data` | 数据库和日志 |

## STRM 文件格式

**内容示例：**
```
/media/电视剧/国产剧/恶作剧之吻 (2005)/Season 2/恶作剧之吻 - S02E09 - 第 9 集.mp4
```

**生成的目录结构：**
```
strm-output/
├── 电影/
│   └── Avatar (2009).strm        → 内容指向源文件
└── 电视剧/
    └── 国产剧/
        └── 恶作剧之吻 (2005)/
            └── Season 2/
                └── 恶作剧之吻 - S02E09 - 第 9 集.strm
```

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/tasks/scan` | POST | 触发媒体扫描 |
| `/api/tasks/generate` | POST | 触发生成 STRM |
| `/api/tasks/cleanup/execute` | POST | 执行孤立清理 |
| `/api/tasks/cleanup/preview` | GET | 预览待清理文件 |
| `/api/tasks/status` | GET | 当前任务状态 |
| `/api/history` | GET | 任务历史 |
| `/api/logs` | GET | 操作日志 |
| `/api/config` | GET/POST | 配置读取/保存 |
| `/api/stats` | GET | 统计信息 |
| `/ws` | WebSocket | 实时进度推送 |

## 开发

### 手动启动后端

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 3011
```

### 手动启动前端

```bash
cd frontend
npm install
npm run dev
```

## 技术栈

- **后端**：Python 3.12 + FastAPI + SQLAlchemy + SQLite
- **前端**：React 18 + TypeScript + Vite + TailwindCSS + Zustand
- **部署**：Docker + Nginx

## License

MIT
