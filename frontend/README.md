# Frontend - STRM Generator Web UI

本目录为 STRM Generator 的前端界面，基于 React + TypeScript + Vite 构建。

## 启动（开发）

```bash
cd frontend
npm install
npm run dev
```

## Docker 构建

前端通过 `docker-compose` 在根目录统一构建，无需单独构建。

## 页面说明

- **Dashboard**：媒体库统计、最近任务状态
- **Configuration**：源目录、输出目录配置
- **Tasks**：扫描/生成/清理操作、进度展示
- **Logs**：操作日志，支持等级筛选
