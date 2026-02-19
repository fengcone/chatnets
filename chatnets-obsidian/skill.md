---
name: chatnets-obsidian
description: 将 Chatnets 采集的 AI 对话记录整理为 Obsidian Zettelkasten 知识库。支持增量处理、费曼学习模式识别、原子笔记生成、双向链接和 MOC。
author: fengcone
version: 1.0.0
---

# Chatnets Obsidian Skill

将 Chatnets 采集的 AI 对话记录整理为 Obsidian Zettelkasten 知识库。

## 功能

1. **增量处理**：只处理新增的对话和消息
2. **费曼模式识别**：识别用户询问→AI解释→用户复述的学习模式
3. **原子笔记生成**：提取对话中的知识点，生成独立的原子笔记
4. **双向链接**：笔记↔对话、笔记↔笔记的关联
5. **MOC 生成**：自动构建概念地图

## 使用方式

```
/chatnets-obsidian
```

Skill 会：
1. 读取配置文件 `~/.chatnets/config.yaml`
2. 读取状态文件 `{obsidian_vault}/_meta/obsidian-state.yaml`
3. 扫描对话目录 `{save_directory}`（默认 `{obsidian_vault}/_chats`）
4. 检测增量对话（新文件或有新消息的文件）
5. 使用 AI 分析对话，识别费曼模式和知识点
6. 生成/更新 Obsidian 笔记
7. 更新状态文件

## 配置

在 `~/.chatnets/config.yaml` 中配置：

```yaml
# 对话保存目录（Chatnets Native 写入位置）
save_directory: "/Users/xxx/Chatnets/chatnets-vault/_chats"

# Obsidian vault 路径（状态文件和笔记输出位置）
obsidian_vault: "/Users/xxx/Chatnets/chatnets-vault"
```

**状态文件位置**：`{obsidian_vault}/_meta/obsidian-state.yaml`

## Obsidian 文件结构

```
Vault/
├── _chats/           # 原始对话副本（带锚点）
├── _concepts/        # 原子概念笔记
├── _mocs/            # 概念地图
└── _meta/            # 元数据
```

## 实现步骤

1. **检查配置**：读取 Chatnets 配置和 Obsidian vault 路径
2. **加载状态**：读取 `obsidian-state.yaml`
3. **扫描增量**：
   - 遍历 `{save_dir}/{platform}/{date}/`
   - 对比 `last_processed_date`
   - 检查文件的 `chatnets-meta` 元数据
4. **解析对话**：解析 Markdown 文件，提取消息列表
5. **AI 分析**：
   - 识别费曼模式片段
   - 提取知识点和概念
   - 生成笔记内容
6. **生成笔记**：
   - 创建/更新原子笔记
   - 创建/更新对话索引
   - 更新 MOC
7. **保存状态**：更新 `obsidian-state.yaml`

## ⚠️ 重要约束

### 原始对话文件保护

**绝对禁止修改原始对话文件的内容**：
- ❌ 不能修改对话内容
- ❌ 不能添加、删除或修改任何消息
- ❌ 不能改变文件格式或结构
- ✅ **只能在文件末尾追加 HTML 注释形式的元数据**

**允许的元数据格式**（由 chatnets-native 自动添加）：
```html
<!-- chatnets-meta: {"session_id":"xxx","message_count":8,"last_updated":"2026-02-19T12:35:24Z"} -->
```

此元数据用于增量检测，判断文件是否有新消息。Skill 读取但不写入原始对话文件。

### 双向链接验证

**生成后必须验证所有链接有效**：
- 概念笔记中链接其他概念时，必须使用**完整的概念名**（包括括号等）
- 文件名和链接名必须完全一致
- 使用 `aliases` 字段支持简短链接别名

**示例**：
```yaml
---
# 概念笔记
aliases: ["OCI", "Open Container Initiative"]  # 支持简短别名
---

# 链接时使用完整名称
- [[OCI（开放容器倡议）]]  # ✅ 正确
- [[OCI]]                   # ❌ 链接不到（除非在 aliases 中）
```

**验证规则**：
1. 所有 `[[概念]]` 链接必须能匹配到实际文件名
2. 文件名包含特殊字符（括号、空格等）时，链接必须完整包含这些字符
3. 使用 aliases 提供简短链接选项

## AI 分析提示词

对于每个对话文件，AI 需要：

1. **识别费曼片段**（⚠️ 核心条件）：
   - 找出 **用户提问 → AI 回答 → 用户复述理解** 的三元组
   - **只有完整的费曼模式才能产生原子概念笔记**
   - 单纯的用户提问或单纯的 AI 回复不足以形成概念
   - 用户必须通过自己的话语表达理解，确认学习发生

2. **提取概念**（⚠️ 严格原则）：
   - **只从费曼模式中用户的消息提取概念**
   - AI 回复的内容不应作为新概念的来源
   - 原因：AI 回复往往冗长、用户未必完整阅读、不是用户主动想学的知识点
   - 概念应该是：用户主动询问的名词、术语、技术名称
   - 每个概念必须在用户提问或复述中**首次出现**

3. **可追溯性**（⚠️ 必需）：
   - 每个概念笔记必须能链接回原始对话
   - 包含两种链接：
     - **Obsidian 内部链接**：`[[对话文件名#^message-N]]`
     - **原始网页链接**：根据平台生成
       - DeepSeek: `https://chat.deepseek.com/a/chat/s/{session_id}`
       - ChatGPT: `https://chatgpt.com/c/{session_id}`

4. **生成摘要**：简洁的定义和关键点

5. **建立关联**：与已有概念的关系

## 输出模板

### 原子概念笔记 (_concepts/概念名.md)

```markdown
---
type: concept
created: 2026-02-19T10:00:00Z
aliases: ["简短别名", "英文名"]  # ⚠️ 重要：支持简短链接
tags: [kubernetes, storage]
related: [PV持久化, 容器可写层]
source_chat: "对话名"
source_platform: "deepseek"
source_session: "xxx"
---

# 概念名

## 定义

简洁的定义说明...

## 关键要点

- 要点1
- 要点2

## 学习来源

### 原始对话
- **Obsidian**: [[对话名#^message-N]]
- **网页**: https://chat.deepseek.com/a/chat/s/xxx

### 费曼学习路径
1. [[对话名#^message-N]]: 用户首次提问
2. [[对话名#^message-M]]: 用户复述理解（确认学习发生）

## 相关概念

- [[完整概念名1]]  # ⚠️ 必须使用完整名称（包括括号等）
- [[完整概念名2]]
```

### 对话文件 (_chats/平台/日期/对话名.md)

```markdown
---
type: chat
platform: deepseek
date: 2026-02-19
session_id: "xxx"
web_url: "https://chat.deepseek.com/a/chat/s/xxx"
concepts: [概念1, 概念2]
---

# 对话标题

[🌐 在网页中打开此对话](https://chat.deepseek.com/a/chat/s/xxx)

## ^message-1 [08:31:38] User

内容...

## ^message-2 [08:31:38] Assistant

内容...

<!-- chatnets-meta: {"session_id": "xxx", "message_count": 12, "last_updated": "2026-02-19T08:31:38Z"} -->
```

### MOC 文件 (_mocs/主题.md)

```markdown
---
type: moc
created: 2026-02-19T10:00:00Z
---

# 主题名

## 核心概念

- [[概念1]]
- [[概念2]]

## 学习路径

1. [[概念1]]
2. [[概念2]]

## 相关对话

- [[对话1]]
- [[对话2]]
```

## 状态文件格式 (_meta/obsidian-state.yaml)

```yaml
obsidian_vault: "/path/to/vault"

progress:
  last_scan_time: "2026-02-19T10:30:00Z"
  last_processed_date: "2026-02-19"

conversations:
  - file_path: "deepseek/2026-02-19/对话.md"
    session_id: "xxx"
    web_url: "https://chat.deepseek.com/a/chat/s/xxx"
    title: "对话"
    platform: "deepseek"
    message_count: 12
    last_processed_timestamp: "2026-02-19T08:31:38Z"
    file_mtime: 1234567890
    concepts_extracted:
      - 概念1
      - 概念2

concepts:
  - id: "emptyDir"
    file: "_concepts/emptyDir.md"
    source_session: "xxx"
    related_chats: 3
    created_at: "2026-02-19T09:00:00Z"

mocs:
  - id: "kubernetes-storage"
    file: "_mocs/Kubernetes存储.md"
    concepts: [emptyDir, PV持久化]
```

## 平台链接格式

| 平台 | 网页链接格式 |
|------|-------------|
| DeepSeek | `https://chat.deepseek.com/a/chat/s/{session_id}` |
| ChatGPT | `https://chatgpt.com/c/{session_id}` |
