# STRM Generator Backend

本地工具，为 rclone 挂载的 Google Drive 媒体目录生成 .strm 文件，供 Emby 扫描刮削。

## 🔐 认证

管理界面受 HTTP Basic Auth 保护。

**默认账号：**
- 用户名：`admin`
- 密码：`strm2026`

**通过环境变量修改：**
```bash
STRS_AUTH_USER=your_user
STRS_AUTH_PASS=your_password
```

浏览器会自动弹出认证框，输入账号密码即可访问。

---

## 项目结构

```
/opt/strm_yesy/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI 入口，/api/ws WebSocket 端点
│   ├── config.py        # 配置（路径、环境变量）
│   ├── db.py            # SQLAlchemy 数据库连接
│   ├── models.py        # 数据模型：TaskRun, StrmFile, OpLog, Config
│   ├── routes/
│   │   ├── __init__.py
│   │   └── api.py       # REST API 路由
│   └── services/
│       ├── __init__.py
│       ├── websocket.py # WebSocket 连接管理 + 广播
│       ├── state.py     # 任务状态管理（内存 + DB 持久化）
│       ├── scanner.py   # 媒体扫描（识别电影/剧集）
│       └── generator.py # STRM 生成、增量更新、孤立清理
├── requirements.txt
└── Dockerfile
```

## API 接口契约

### 触发类

#### `POST /api/tasks/scan`
触发媒体扫描。
- Query: `source_dir` (可选), `incremental` (默认 true)
- Response:
  ```json
  {"ok": true, "task_id": "abc12345", "message": "Scan started (task abc12345)"}
  ```

#### `POST /api/tasks/generate`
触发 STRM 生成。
- Query: `source_dir` (可选), `output_dir` (可选), `incremental` (默认 true)
- Response: 同上

#### `POST /api/tasks/cleanup/execute`
触发孤立 STRM 清理。
- Query: `output_dir` (可选), `dry_run` (默认 true)
- Response: 同上

#### `GET /api/tasks/cleanup/preview`
预览待清理的孤立 STRM 文件列表（只读）。
- Response:
  ```json
  ["/opt/strm_yesy/output/电影/死种 (2020).strm", "...]
  ```

### 查询类

#### `GET /api/tasks/status`
获取当前任务状态。
- Response:
  ```json
  {
    "current_task": {
      "task_id": "abc12345",
      "task_type": "generate",
      "status": "running",
      "total": 120,
      "processed": 45,
      "created_files": 40,
      "deleted_files": 0,
      "message": "Generated 40, skipped 5..."
    },
    "all_tasks": {}
  }
  ```

#### `GET /api/history?limit=20&offset=0`
任务历史记录。
- Response:
  ```json
  {
    "runs": [
      {
        "id": 5,
        "task_type": "generate",
        "status": "success",
        "started_at": "2026-04-11T09:00:00",
        "finished_at": "2026-04-11T09:05:30",
        "total_items": 120,
        "processed_items": 120,
        "created_files": 115,
        "deleted_files": 0,
        "error_message": null,
        "detail": "{\"created\": 115, \"skipped\": 5, \"errors\": 0}"
      }
    ]
  }
  ```

#### `GET /api/logs?limit=100&offset=0&level=info&action=generate`
操作日志。
- Response:
  ```json
  {
    "logs": [
      {
        "id": 1,
        "created_at": "2026-04-11T09:00:00",
        "level": "info",
        "action": "generate",
        "message": "Generated 115 STRM files, skipped 5",
        "detail": "{\"created\": 115, \"skipped\": 5}"
      }
    ]
  }
  ```

#### `GET /api/config`
获取配置（key-value）。
- Response: `{"STRM_SOURCE_DIR": "/data/clouddrive/gdrive", ...}`

#### `POST /api/config`
设置配置。
- Body: `{"key": "STRM_SOURCE_DIR", "value": "/new/path"}`
- Response: `{"ok": true, "key": "STRM_SOURCE_DIR", "value": "/new/path"}`

#### `GET /api/stats`
统计信息。
- Response:
  ```json
  {
    "total_strms": 350,
    "movie_strms": 120,
    "episode_strms": 230,
    "source_dir": "/data/clouddrive/gdrive",
    "output_dir": "/opt/strm_yesy/output"
  }
  ```

### WebSocket

#### `WS /api/ws`
实时进度推送。

客户端连接后，服务器会推送如下消息：

```json
{
  "type": "progress",
  "task_id": "abc12345",
  "task_type": "generate",
  "status": "running",
  "processed": 45,
  "total": 120,
  "created_files": 40,
  "skipped_files": 5,
  "message": "Generated 40, skipped 5..."
}
```

任务完成时：
```json
{
  "type": "progress",
  "task_id": "abc12345",
  "task_type": "generate",
  "status": "success",
  "processed": 120,
  "total": 120,
  "created_files": 115,
  "message": "Done! Created 115, skipped 5"
}
```

客户端可发送 `ping` 进行心跳保活，服务器返回 `pong`。

## STRM 内容格式

STRM 文件内容为绝对路径，格式参考 Emby 期望的媒体路径：

**电影：**
```
/media/电影/[标题] ([年份])/[文件名].mp4
```

**剧集：**
```
/media/电视剧/[类型]/[标题] ([年份])/Season X/[标题] - SXXEXX - [集名].mp4
```

生成的 STRM 文件路径：

**电影：** `输出/电影/[标题] ([年份]).strm`
**剧集：** `输出/电视剧/[类型]/[标题] ([年])/Season X/[标题] - SXXEXX - [集名].strm`

## 媒体识别规则

### 电影
源路径：`/data/clouddrive/gdrive/电影/[标题] ([年份])/[文件名].mp4`
匹配：`Title (2020).mp4` → 识别为 `Title`，年份 `2020`

### 剧集
源路径：`/data/clouddrive/gdrive/电视剧/[类型]/[标题] ([年份])/Season X/[标题] - SXXEXX - [集名].mp4`
匹配：`恶作剧之吻 - S02E09 - 第 9 集.mp4` → 识别为 `恶作剧之吻`，S02E09

支持的文件名格式：
- `Title - S01E01 - Episode Title.mp4`
- `Title - 1x01 - Episode Title.mp4`
- `Title S01E01.mp4`

## Docker 部署

### 构建
```bash
cd /opt/strm_yesy
docker build -t strm-generator .
```

### 运行
```bash
docker run -d \
  --name strm-generator \
  -p 3011:3011 \
  -v /data/clouddrive/gdrive:/data/clouddrive/gdrive:ro \
  -v /opt/strm_yesy/output:/app/output \
  -v /opt/strm_yesy/data:/app/data \
  -e STRM_SOURCE_DIR=/data/clouddrive/gdrive \
  -e STRM_OUTPUT_DIR=/app/output \
  -e STRS_AUTH_USER=admin \
  -e STRS_AUTH_PASS=strm2026 \
  strm-generator
```

### docker-compose 片段
```yaml
services:
  strm-generator:
    build: ./strm_yesy
    ports:
      - "3011:3011"
    volumes:
      - /data/clouddrive/gdrive:/data/clouddrive/gdrive:ro
      - strm-output:/app/output
      - strm-data:/app/data
    environment:
      - STRM_SOURCE_DIR=/data/clouddrive/gdrive
      - STRM_OUTPUT_DIR=/app/output
      - STRS_AUTH_USER=admin
      - STRS_AUTH_PASS=strm2026

volumes:
  strm-output:
  strm-data:
```

## 前端需要配合的事项

### 1. WebSocket 连接
- 连接到 `ws://<host>:3011/ws`
- 连接时需要在 HTTP Header 中携带 Basic Auth 凭据：
  `Authorization: Basic base64(username:password)`
- 连接后等待 `type: "progress"` 消息
- 可发送 `ping` 保活

### 2. 轮询 /api/status（降级方案）
- 如果 WebSocket 不可用，轮询 `/api/status?task_id=xxx`
- 建议轮询间隔 2-3 秒

### 3. 任务触发时序
```
用户点击"扫描" → POST /api/scan → 返回 task_id
  → 建立 WebSocket 连接 → 等待 progress 消息
  → 收到 status=success → 刷新 /api/history 和 /api/stats
```

### 4. 关键字段说明
- `task_type`: `scan` | `generate` | `cleanup`
- `status`: `running` | `success` | `failed`
- `incremental`: 增量模式，只处理新增/变化的文件，跳过未变化的
- `dry_run` (cleanup): true=只报告不删除，false=实际删除

### 5. 错误处理
- `status=failed` 时，`error_message` 字段包含错误详情
- WebSocket 断开时前端应自动重连

## 开发

```bash
cd /opt/strm_yesy
pip install -r requirements.txt
uvicorn app.main:app --reload --port 3011
```
