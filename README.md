# Chatnets

> 将 AI 对话转化为 Obsidian Zettelkasten 知识库

Chatnets 是一个开源工具，采集 AI 对话记录（DeepSeek、ChatGPT），通过识别费曼学习模式，自动转化为结构化的 Obsidian 知识库。

## 核心理念

**费曼学习法** = 提问 → 回答 → 复述理解

Chatnets 只提取用户主动确认理解的知识点，确保每个概念都是真正"学会"的内容。

## 特性

- **多平台采集** - 支持 DeepSeek 和 ChatGPT
- **实时同步** - 浏览器扩展自动保存对话为 Markdown
- **费曼模式识别** - 智能识别"提问→回答→复述"的学习三元组
- **原子笔记** - 每个概念一个文件，支持双向链接
- **MOC 地图** - 自动构建知识导航

## 架构

```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│ Chrome 扩展  │ ──▶  │ 本地服务      │ ──▶  │ Claude Skill │
│ 采集对话     │      │ 保存 Markdown │      │ 构建知识库     │
└─────────────┘      └──────────────┘      └──────────────┘
```

## 快速开始

### 1. 安装 Chrome 扩展

```bash
git clone https://github.com/fengcone/chatnets.git
```

在 Chrome 打开 `chrome://extensions/`，开启"开发者模式"，加载 `chatnets-extension` 目录。

### 2. 运行本地服务

```bash
cd chatnets-native
make build
./chatnets-native
```

### 3. 使用 Claude Code Skill

```bash
ln -s /path/to/chatnets/chatnets-obsidian ~/.claude/skills/chatnets-obsidian
```

在 Claude Code 中输入：

```
/chatnets-obsidian
```

### 4. 用 Obsidian 打开 Vault

配置 `~/.chatnets/config.yaml` 中的 `obsidian_vault` 路径，在 Obsidian 中打开该目录。

## 输出示例

### 原始对话

```markdown
## [10:30:15] User ^message-1

runc 和 containerd 的关系是什么？

## [10:30:16] Assistant ^message-2

containerd 创建 shim 进程来管理 runc...

## [10:30:20] User ^message-3

我理解一下，所以 containerd 创建 shim 进程来管理 runc 的生命周期...
```

### 生成的概念笔记

```markdown
---
type: concept
tags: [kubernetes, container]
source_session: "xxx"
---

# containerd

## 定义

containerd 是一个容器运行时，通过 shim 进程管理 runc...

## 学习来源

- [[容器架构#^message-2]]: AI 解释
- [[容器架构#^message-3]]: 我的理解

## 相关概念

- [[runc]]
- [[shim]]
```

## 配置

`~/.chatnets/config.yaml`:

```yaml
save_directory: "~/Chatnets/chatnets-vault/chats"
obsidian_vault: "~/Chatnets/chatnets-vault"

platforms:
  deepseek:
    enabled: true
  chatgpt:
    enabled: true

http_port: 8766
```

## 组件

| 组件 | 功能 | 技术 |
|------|------|------|
| Chrome 扩展 | 监听页面、提取对话 | JavaScript, MutationObserver |
| 本地服务 | 保存 Markdown 文件 | Go, HTTP API |
| Claude Skill | 构建知识库 | Claude Code, YAML |

## 许可证

[MIT](LICENSE)
