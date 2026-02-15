# Chatnets 重构设计文档

**日期**: 2026-02-15
**目标**: 将 Chatnets 从本地存储方案改造为本地文件系统 Markdown 导出方案

## 概述

Chatnets 是一个 Chrome 扩展，用于采集 DeepSeek 和 ChatGPT 的聊天记录并导出到本地文件系统，以 Markdown 格式持久化存储，每个 session 对应一个文件，支持增量追加。

## 整体架构

系统分为两个主要部分：

### 1. Chrome 扩展端 (chatnets-extension/)
- 负责监听 DeepSeek/ChatGPT 页面的聊天记录
- 提取 session 数据（消息、标题、时间戳、平台）
- 通过 Native Messaging API 发送给本地 Go 程序
- 提供 popup 设置界面配置保存目录

### 2. Native Messaging 主机 (chatnets-native/)
- 与 Chrome 扩展建立 stdio 通信管道
- 接收聊天消息数据
- 处理文件写入逻辑：创建目录、追加内容、处理重名
- 提供 HTTP 管理接口（可选，用于配置和状态查询）

### 通信流向
```
AI 聊天页面 → Content Script → Background.js → Native Messaging → Go 主机 → 文件系统
```

## Chrome 扩展端设计

### Content Script 层
- 监听目标平台（DeepSeek/ChatGPT）的 DOM 变化
- 识别新消息并提取：内容、角色、时间戳、session 标题
- 将数据发送给 background.js

### Background Service
- 维护 session 状态映射（session_id → 标题、平台、首次消息时间）
- 收集 content script 发送的消息
- 组装 Native Messaging 消息格式
- 处理发送失败重试（队列机制）

### Popup 设置界面
- 显示当前保存根目录状态
- 修改目录按钮（触发 Native 程序的目录选择或 HTTP 接口）
- 同步状态指示器（连接状态、最近写入时间）
- 测试写入按钮（验证路径权限）

### Manifest 配置
```json
{
  "permissions": ["nativeMessaging", "storage"],
  "background": {
    "service_worker": "background.js"
  }
}
```

## Native Messaging 主机设计

### 程序结构
```
chatnets-native/
├── main.go           # 入口，处理 Native Messaging stdio
├── handler.go        # 消息处理器
├── writer.go         # 文件写入逻辑
├── config.go         # 配置管理
├── http_server.go    # 可选的管理接口
└── config.yaml       # 用户配置文件
```

### 核心功能模块

1. **Messaging Handler**
   - 从 stdin 读取 Chrome 扩展发送的 JSON 消息
   - 解析消息类型：`init`、`write_message`、`set_directory`、`ping`
   - 将响应写入 stdout

2. **File Writer**
   - 按规则创建目录：`{根目录}/{平台}/{日期}/`
   - 文件命名：`{标题}.md`，重名加 `_1`, `_2` 后缀
   - 追加逻辑：读取文件末尾，判断是否需要追加
   - 文件索引（内存缓存）：加速文件查找

3. **Config Manager**
   - 配置文件位置：`~/.chatnets/config.yaml`
   - 存储根目录、平台配置等
   - 支持热重载

4. **HTTP Server**（可选，默认 8766 端口）
   - `/api/config` - 配置管理
   - `/api/status` - 运行状态
   - `/api/test` - 测试写入

### 消息协议
```json
// 扩展 → 主机
{
  "type": "write_message",
  "data": {
    "platform": "deepseek",
    "session_id": "xxx",
    "title": "如何学习 Go",
    "timestamp": "2026-02-15T14:30:05+08:00",
    "role": "user",
    "content": "从哪里开始？"
  }
}

// 主机 → 扩展（响应）
{
  "type": "response",
  "status": "success",
  "message": "Message written to /path/to/file.md"
}
```

## Markdown 格式与文件写入

### 目录结构
```
{根目录}/
├── deepseek/
│   └── 2026-02-15/
│       ├── 如何学习 Go.md
│       └── Python 异常处理_1.md
└── chatgpt/
    └── 2026-02-15/
        └── React Hooks 详解.md
```

### Markdown 格式（Obsidian 兼容）
```markdown
# 如何学习 Go

Platform: DeepSeek
Date: 2026-02-15
Created: 14:30:05

---

## [14:30:05] User

从哪里开始？

## [14:30:08] Assistant

建议先学基础语法，然后做些小项目。

---

## [14:35:12] User

有什么推荐的项目吗？

## [14:35:15] Assistant

可以试试做一个 CLI 工具...
```

### 追加逻辑
- 新消息到来时，读取文件末尾判断是否已存在
- 按时间戳去重，避免重复写入
- 直接 append 到文件末尾

## 配置管理

### 配置文件 `~/.chatnets/config.yaml`
```yaml
# 用户设置
save_directory: "/Users/xxx/Documents/Chatnets"

# 平台配置
platforms:
  deepseek:
    enabled: true
  chatgpt:
    enabled: true

# HTTP 服务
http_port: 8766
http_enabled: true

# 日志
log_level: info
```

## 安装流程

1. **编译 Go 程序**
   - `go build -o chatnets-native`
   - 支持 macOS/Linux/Windows

2. **注册 Native Messaging**
   - 在 `~/.config/Google/Chrome/NativeMessagingHosts/com.chatnets.host.json` 写入：
   ```json
   {
     "name": "com.chatnets.host",
     "description": "Chatnets Native Host",
     "path": "/path/to/chatnets-native",
     "type": "stdio",
     "allowed_origins": ["chrome-extension://YOUR_EXTENSION_ID/"]
   }
   ```

3. **首次运行向导**
   - 扩展检测到未配置，弹窗引导
   - 用户点击"开始使用"，触发 Go 程序的目录选择
   - 写入配置，测试写入权限

### 分发方式
- 提供安装脚本自动注册 Native Messaging
- 扩展打包到 Chrome Web Store
- Go 程序提供 GitHub Releases 下载

## 错误处理

### 通信层
- Go 程序崩溃 → 扩展显示通知，建议重启
- 消息发送失败 → 本地队列缓存，最多 100 条

### 文件系统层
- 目录无权限 → 提示用户修改路径
- 磁盘空间不足 → 通知用户清理
- 文件被占用 → 短暂重试后放弃并记录

### 数据层
- Session 标题为空 → 使用 "Untitled-{日期时间}" 作为后备
- 消息内容解析失败 → 跳过该条，记录日志

## 实现阶段规划

| 阶段 | 内容 | 优先级 |
|------|------|--------|
| 1 | Go 程序基础框架 + Native Messaging 通信 | P0 |
| 2 | 文件写入逻辑 + Markdown 格式化 | P0 |
| 3 | 扩展端集成 Native Messaging | P0 |
| 4 | 配置管理 + 安装脚本 | P1 |
| 5 | Popup 设置界面 | P1 |
| 6 | HTTP 管理接口 | P2 |
