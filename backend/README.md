# Backend - STRM Generator API

本目录为 STRM Generator 的后端服务，基于 FastAPI 构建。

## 启动（开发）

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 3011
```

## Docker 构建

```bash
docker build -t strm-generator-backend ./backend
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `STRM_SOURCE_DIR` | `/data/clouddrive/gdrive` | 媒体源目录 |
| `STRM_OUTPUT_DIR` | `/app/output` | STRM 输出目录 |
| `STRM_BASE_DIR` | `/app/data` | 数据库和日志目录 |

## 数据模型

- **TaskRun**：每次任务执行记录
- **StrmFile**：已生成的 STRM 文件索引
- **OpLog**：操作日志
- **Config**：键值配置
