# Chatnets

> 将 AI 对话转化为知识库的完整解决方案

Chatnets 是一个开源工具，帮助你采集 AI 对话记录（DeepSeek、ChatGPT）并将其转化为 Obsidian Zettelkasten 知识库。

## ✨ 核心特性

- **🌐 多平台采集** - 支持 DeepSeek 和 ChatGPT
- **🔄 自动同步** - 浏览器扩展 + 本地服务器，实时保存
- **🧠 费曼学习识别** - 智能识别"提问→回答→复述"的学习模式
- **📝 原子笔记生成** - 自动提取知识点，生成独立概念笔记
- **🔗 双向链接** - 概念↔对话、概念↔概念的完整链接体系
- **🗺️ MOC 自动生成** - 构建知识地图，导航学习路径
- **📦 增量处理** - 只处理新增内容，高效更新

## 📦 组件概览

Chatnets 由三个组件组成，协同工作：

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  Chrome 扩展     │ ──▶  │  本地文件服务     │ ──▶  │  Claude Skill  │
│  (数据采集)      │      │  (保存对话)       │      │  (构建知识库)    │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

---

## 1️⃣ Chrome 扩展

采集 AI 对话记录，实时同步到本地。

### 支持平台

- [DeepSeek](https://chat.deepseek.com)
- [ChatGPT](https://chatgpt.com)

### 安装步骤

1. 克隆项目：
   ```bash
   git clone https://github.com/fengjianhui/chatnets.git
   cd chatnets
   ```

2. 打开 Chrome 扩展管理页面：
   - 在地址栏输入 `chrome://extensions/`
   - 开启右上角的"开发者模式"

3. 加载扩展：
   - 点击"加载已解压的扩展程序"
   - 选择 `chatnets-extension` 目录

### 使用方式

- 访问 DeepSeek 或 ChatGPT 进行对话
- 扩展自动监听页面变化，提取对话消息
- 点击扩展图标查看统计信息

---

## 2️⃣ 本地文件服务

接收 Chrome 扩展数据，将对话保存为 Markdown 文件。

### 构建

```bash
cd chatnets-native
make deps        # 下载依赖
make build      # 构建二进制文件
```

### 运行

```bash
./chatnets-native
# 服务运行在 http://127.0.0.1:8766
```

### 配置文件

配置文件位于 `~/.chatnets/config.yaml`：

```yaml
# 对话保存目录
save_directory: "/Users/xxx/Chatnets/chatnets-vault/_chats"

# Obsidian vault 路径
obsidian_vault: "/Users/xxx/Chatnets/chatnets-vault"

# 启用的平台
platforms:
  deepseek:
    enabled: true
  chatgpt:
    enabled: true

# HTTP 服务配置
http_port: 8766
http_enabled: true
log_level: info
```

### 输出结构

对话文件按平台和日期组织：

```
{save_directory}/
├── deepseek/
│   └── 2026-02-19/
│       ├── Kubernetes存储.md
│       └── Go并发编程.md
└── chatgpt/
    └── 2026-02-19/
        └── React优化.md
```

### API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/ping` | GET | 健康检查 |
| `/api/config` | GET | 获取配置 |
| `/api/status` | GET | 服务状态 |
| `/api/write` | POST | 保存对话消息 |

---

## 3️⃣ Claude Code Skill

将对话转化为 Obsidian Zettelkasten 知识库。

### 安装 Skill

```bash
# 创建符号链接到 Claude Code skills 目录
ln -s /path/to/chatnets/chatnets-obsidian ~/.claude/skills/chatnets-obsidian
```

### 使用方式

在 Claude Code 对话中输入：

```
/chatnets-obsidian
```

Skill 会自动执行：

1. 读取配置文件 `~/.chatnets/config.yaml`
2. 读取状态文件 `{vault}/_meta/obsidian-state.yaml`
3. 扫描对话目录，检测增量内容
4. 使用 AI 分析对话，识别费曼学习模式
5. 生成/更新原子概念笔记
6. 建立 Obsidian 双向链接
7. 更新 MOC（概念地图）

### 费曼学习模式

Skill 只对**完整的费曼学习片段**提取概念：

```
用户提问 → AI 回答 → 用户复述理解
```

- ✅ 提取概念：用户主动询问的名词、术语
- ❌ 不提取：AI 回复中的额外概念（用户未必阅读）

### 输出结构

```
{obsidian_vault}/
├── _chats/           # 原始对话（带锚点）
│   ├── deepseek/
│   └── chatgpt/
├── _concepts/        # 原子概念笔记
│   ├── emptyDir.md
│   └── PV持久化.md
├── _mocs/            # 概念地图
│   └── Kubernetes存储.md
└── _meta/            # 元数据和状态
    └── obsidian-state.yaml
```

### 概念笔记示例

```markdown
---
type: concept
created: 2026-02-19T10:00:00Z
aliases: ["临时存储"]
tags: [kubernetes, storage]
source_session: "xxx"
source_platform: "deepseek"
---

# emptyDir

## 定义

emptyDir 是 Kubernetes 中一种 Pod 级别的临时存储卷...

## 学习来源

### 原始对话
- **Obsidian**: [[Kubernetes存储#^message-5]]
- **网页**: https://chat.deepseek.com/a/chat/s/xxx

### 费曼学习路径
1. [[Kubernetes存储#^message-5]]: 用户首次提问
2. [[Kubernetes存储#^message-7]]: 用户复述理解

## 相关概念

- [[PV持久化]]
- [[容器可写层]]
```

---

## 🚀 快速开始

### 1. 安装 Chrome 扩展

```bash
git clone https://github.com/fengjianhui/chatnets.git
# 在 chrome://extensions/ 加载 chatnets-extension 目录
```

### 2. 运行本地服务

```bash
cd chatnets-native
make build
./chatnets-native
```

### 3. 使用 Claude Code Skill

```
/chatnets-obsidian
```

### 4. 用 Obsidian 打开 Vault

将 `obsidian_vault` 目录（默认 `~/Chatnets/chatnets-vault`）在 Obsidian 中打开。

---

## 📁 项目结构

```
chatnets/
├── chatnets-extension/    # Chrome 扩展
│   ├── manifest.json
│   ├── background.js
│   ├── content-script.js
│   └── popup.html
├── chatnets-native/       # Go 后端服务
│   ├── main.go
│   ├── config.go
│   ├── handler.go
│   ├── writer.go
│   └── Makefile
├── chatnets-obsidian/     # Claude Code Skill
│   └── skill.md
└── example/               # 示例对话文件
```

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可证

MIT License
