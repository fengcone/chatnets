---
name: chatnets-obsidian
description: 将 Chatnets 采集的 AI 对话记录整理为 Obsidian Zettelkasten 知识库。基于行号增量检测，识别费曼学习模式，生成原子概念笔记。
author: fengcone
version: 2.0.0
---

# Chatnets Obsidian Skill

将 Chatnets 采集的 AI 对话记录整理为 Obsidian Zettelkasten 知识库。

## 核心特性

- **增量检测**：基于状态文件记录的行号，只处理新消息
- **费曼模式识别**：只提取用户主动确认理解的知识点
- **Token 优化**：先过滤用户消息，再 AI 分析
- **原子笔记**：每个概念一个文件，支持双向链接
- **MOC 地图**：自动构建概念关联图
- **概念合并**：智能判断概念区分度，避免过度拆分

---

## 快速开始

```
/chatnets-obsidian
```

---

## 文件结构

```
Vault/                          # Obsidian vault
├── chats/                      # 原始对话
│   ├── deepseek/
│   │   └── 对话名.md
│   └── chatgpt/
│       └── 对话名.md
├── concepts/                   # 原子概念笔记（由 Skill 生成）
│   └── 概念名.md
├── mocs/                       # 概念地图（由 Skill 生成）
│   └── 主题.md
└── meta/
    ├── obsidian-state.yaml     # 状态文件
```

---

## 配置

在 `~/.chatnets/config.yaml` 中配置：

```yaml
save_directory: "/Users/xxx/Chatnets/chatnets-vault/chats"
obsidian_vault: "/Users/xxx/Chatnets/chatnets-vault"
```

---

## 执行流程

### 1. 加载状态

读取 `meta/obsidian-state.yaml`，获取上次处理进度。

### 2. 检测增量

```
对于每个对话文件：

┌─────────────────────────────────────────────────────────┐
│ 2.1 检查是否有新消息                                      │
│     对比文件行数 vs 状态文件的 last_processed_line         │
├─────────────────────────────────────────────────────────┤
│ 2.2 提取用户消息（增量）                                  │
│     awk 'NR>上次处理的行号' 对话.md | grep 'User'         │
│     只读取用户消息，大幅减少 token                         │
├─────────────────────────────────────────────────────────┤
│ 2.3 AI 判断费曼回复                                       │
│     输入：增量中的所有用户消息                              │
│     输出：哪些是"费曼回复"（用户复述理解）                    │
├─────────────────────────────────────────────────────────┤
│ 2.4 提取完整三元组                                        │
│     对每个费曼回复：                                      │
│     - 用户提问 → AI 回答 → 用户费曼回复                     │
│     - 只读取这 3 条消息的完整内容                           │
├─────────────────────────────────────────────────────────┤
│ 2.5 提取概念并生成笔记                                     │
│     基于三元组内容提取概念                                  │
├─────────────────────────────────────────────────────────┤
│ 2.6 更新状态文件                                          │
│     更新 last_message_anchor 和 last_processed_line      │
└─────────────────────────────────────────────────────────┘
```

---

## 增量检测实现

### 检测新消息

```bash
# 对比行数
wc -l 对话.md
# 如果当前行数 > last_processed_line，说明有新内容
```

### 提取增量用户消息

```bash
# 从上次处理的行号之后，提取用户消息
# 关键优化：只读用户消息，不读 AI 长篇回复，节省 80%+ token

awk 'NR>680' 对话.md | grep -A5 '## \[[0-9:]+\] User \^message-'
```

### 计算结束行号

```bash
# 获取第 N 条消息的结束行号（下一条消息的起始行 - 1）
grep -n '^## \[[0-9:]\+' 对话.md | awk -F: 'NR==26 {print $1-1}'
# 输出：680（第 26 条在 681 行，所以第 25 条结束于 680）
```

### 提取消息锚点号

```bash
# 获取最后一条消息的锚点号
grep '## \[[0-9:]\+' 对话.md | tail -1 | grep -oE '\^message-[0-9]+' | grep -oE '[0-9]+'
```

---

## 费曼模式识别

### 什么是费曼回复

**费曼回复** = 用户用自己的话复述对 AI 回答的理解，确认学习发生。

**特征**：
- 以"我理解"、"所以"、"我的理解是"开头
- 总结 AI 刚才讲的内容
- 用自己的话重新表述

**示例**：
```
用户: runc 和 containerd 的关系是什么？
AI: [详细解释...]
用户: 我理解一下，所以 containerd 创建 shim 进程来管理 runc...  ← 费曼回复
```

### 识别流程

**第一步：提取用户消息**

```bash
grep -A5 '## \[[0-9:]+\] User \^message-' 对话.md
```

**第二步：AI 判断哪些是费曼回复**

输入（用户消息列表）：
```json
[
  { "message_id": 1, "anchor": "^message-1", "content": "什么是 k8s？" },
  { "message_id": 3, "anchor": "^message-3", "content": "我理解一下，所以 containerd 创建 shim..." },
  { "message_id": 5, "anchor": "^message-5", "content": "那 Kata Containers 呢？" }
]
```

输出（费曼回复）：
```json
[
  { "message_id": 3, "is_feynman_reply": true, "reason": "用户复述理解" }
]
```

**第三步：提取完整三元组**

```
费曼回复 ^message-3
    ├── 前一条用户消息 ^message-1 (提问)
    └── 中间 AI 消息 ^message-2 (回答)

三元组 = [^message-1, ^message-2, ^message-3]
```

### 提取概念

**基于三元组内容提取概念**：

```
用户提问: runc 和 containerd 的关系？
AI 回答: [AI 的详细解释...]
用户复述: 我理解一下，所以 containerd 创建 shim 进程...
```

**规则**：
- ✅ 只从用户提问和复述中提取概念
- ❌ 不从 AI 回复中提取
- 概念必须是用户主动询问的名词/术语

**不生成笔记的情况**：
- ❌ 单纯提问（无复述）
- ❌ 只说"谢谢"、"好的"
- ❌ 切换到新话题

---

## 概念独立性约束

### 核心原则

**概念必须是独立的、通用的原子概念，不能是组合短语。**

### 判断标准

一个有效的概念应该满足：

| 标准 | 说明 |
|------|------|
| 单一性 | 只描述一个事物/概念 |
| 通用性 | 在领域内被广泛认知和使用 |
| 独立性 | 可以独立存在和讨论 |

### 概念类型对照表

| 类型 | ✅ 有效概念 | ❌ 无效概念 |
|------|------------|------------|
| 系统组件 | cgroup, namespace, mount | kubelet cgroup 驱动 |
| 容器术语 | 镜像, 容器, 卷 | 容器镜像存储方案 |
| K8s 资源 | Pod, Service, Deployment | Kubernetes 应用部署 |
| 协议/格式 | JSON, YAML, HTTP | RESTful API 设计原则 |
| 技术概念 | 并发, 锁, 死锁 | Go 并发编程最佳实践 |

### 拒绝模式

**组合短语（拒绝）**：
- ❌ "云原生应用网络设计原则" → 拆分为：云原生、网络
- ❌ "kubelet cgroup 驱动" → 拆分为：kubelet、cgroup
- ❌ "容器镜像分层存储" → 拆分为：容器镜像、分层存储
- ❌ "Kubernetes 高可用集群" → 拆分为：Kubernetes、高可用

**设计原则/方法论（拒绝）**：
- ❌ "XX 设计原则"
- ❌ "XX 最佳实践"
- ❌ "XX 编程范式"

**描述性短语（拒绝）**：
- ❌ "容器与虚拟机对比"
- ❌ "微服务架构选型"

### 可接受模式

**单个技术名词（接受）**：
- ✅ cgroup
- ✅ namespace
- ✅ mount
- ✅ Pod
- ✅ Service
- ✅ Deployment
- ✅ 镜像
- ✅ 容器

**带限定的独立概念（接受）**：
- ✅ "Kubernetes Namespace"（Namespace 是概念，Kubernetes 是限定域）
- ✅ "Linux cgroup"（cgroup 是概念，Linux 是限定域）

**判断技巧**：去掉限定词后，概念是否仍然独立存在？
- "Kubernetes Namespace" → "Namespace" ✅
- "kubelet cgroup 驱动" → "cgroup 驱动" ❌（驱动是修饰）

---

## AI 分析规则总结

### 输入格式

**阶段 1 判断输入**（用户消息列表）：
```json
[
  { "message_id": 1, "anchor": "^message-1", "content": "用户消息内容" }
]
```

**阶段 2 提取输入**（完整三元组）：
```
用户提问 → AI 回答 → 用户复述
```

### 输出格式

**阶段 1 输出**（费曼回复列表）：
```json
[
  { "message_id": 3, "is_feynman_reply": true }
]
```

**阶段 2 输出**（概念笔记）：
- 概念名称
- 定义
- 关键要点
- 学习来源（含锚点链接）
- 相关概念

---

## 对话文件格式

原始对话文件由 **chatnets-native** 写入，Skill 只读取不修改：

```markdown
# 对话标题

## [08:31:38] User ^message-1

用户问的问题...

## [08:31:38] Assistant ^message-2

AI 的回答...

## [08:31:39] User ^message-3

我理解一下，所以...

<!-- chatnets-meta: {"session_id":"xxx","message_count":3,"last_updated":"2026-02-21T12:35:24Z"} -->
```

**格式说明**：
- `^message-N` 是 Obsidian 块锚点，位于标题末尾（符合 Obsidian 规范）
- 链接格式：`[[对话名#^message-N]]` 可精确跳转到对应消息
- `chatnets-meta` 包含 session_id 和消息统计， session_id 需要用于下述相关文档

**session_id**
- 位于对话文件**末尾**的 HTML 注释中：
```markdown
<!-- chatnets-meta: {"session_id":"xxx","message_count":3,"last_updated":"2026-02-21T12:35:24Z"} -->
```

---

## 输出模板

### 概念笔记 (concepts/概念名.md)

```markdown
---
type: concept
created: 2026-02-21T10:00:00Z
aliases: ["简短别名", "英文名"]
tags: [kubernetes, storage]
source_chat: ["对话名1","对话名2"]
source_url: ["[对话名1](https://chat.deepseek.com/a/chat/s/{session_id})", "[对话名2](https://chatgpt.com/c/{session_id})", "[对话名3](https://deepwiki.com/search/_{session_id})"]
---

# 概念名

## 定义

简洁的定义...

## 关键要点

- 要点1
- 要点2

## 学习来源

- [[对话名#^message-N]]: 用户提问
- [[对话名#^message-M]]: 用户复述理解

## 相关概念

- [[完整概念名1]]
- [[完整概念名2]]
```

### MOC 文件 (mocs/主题.md)

```markdown
---
type: moc
created: 2026-02-21T10:00:00Z
---

# 主题名

## 核心概念

- [[概念1]]
- [[概念2]]

## 学习路径

1. [[概念1]]
2. [[概念2]]

## 相关对话

- [[对话名]] - [在线查看](https://chat.deepseek.com/a/chat/s/{session_id})
- [[对话2]] - [在线查看](https://chatgpt.com/c/{session_id2})
- [[对话3]] - [在线查看](https://deepwiki.com/search/_{session_id3})
```

---

## 状态文件 (meta/obsidian-state.yaml)

```yaml
obsidian_vault: "/path/to/vault"

conversations:
  - file_path: "deepseek/对话.md"
    session_id: "xxx"
    web_url: "https://chat.deepseek.com/a/chat/s/{session_id}"
    title: "对话"
    platform: "deepseek"
    # 增量检测信息
    last_message_anchor: 25      # 上次处理到的锚点号
    last_processed_line: 680     # 上次处理到的结束行号（下次从 681 行开始读）
    # 提取的概念
    concepts_extracted:
      - 概念1
      - 概念2
  - file_path: "deepwiki/alibaba_ROCK.md"
    session_id: "ba6a68f8-4c5c-4722-b8e0-ccf2959fdb1e"
    web_url: "https://deepwiki.com/search/_ba6a68f8-4c5c-4722-b8e0-ccf2959fdb1e"
    title: "alibaba/ROCK"
    platform: "deepwiki"
    last_message_anchor: 10
    last_processed_line: 320
    concepts_extracted:
      - 概念3

concepts:
  - id: "概念1"
    file: "concepts/概念1.md"
    source_session: "xxx"

mocs:
  - id: "主题"
    file: "mocs/主题.md"
    concepts: [概念1, 概念2]
```

**字段说明**：
- `last_message_anchor`: 上次处理到的消息锚点号 （如 25 表示处理到 ^message-25）
- `last_processed_line`: 上次处理到的结束行号（用于 awk 'NR>行号' 跳过已处理内容）

---

## 双向链接验证

```yaml
---
aliases: ["OCI", "Open Container Initiative"]  # 支持简短别名
---

# 链接必须使用完整名称
- [[OCI（开放容器倡议）]]  # ✅ 正确
- [[OCI]]                   # ❌ 错误（除非在 aliases 中）
```

**规则**：
- 文件名和链接名必须完全一致
- 包含特殊字符（括号等）时必须完整匹配
- 使用 `aliases` 支持简短链接

---

## 错误处理

| 场景 | 处理方式 |
|------|---------|
| 状态文件不存在 | 创建新状态文件 |
| 对话文件被删除 | 从状态移除记录 |
| 行号计算失败 | 警告但继续处理 |
| 状态文件损坏 | 备份旧文件，重建状态 |

---

## 平台链接格式

**Session ID 来源**：从对话文件末尾的 `chatnets-meta` 注释中提取（见上方 [Session ID 提取规则](#session-id-提取规则)）

| 平台 | 网页链接格式 | 示例 |
|------|-------------|------|
| DeepSeek | `https://chat.deepseek.com/a/chat/s/{session_id}` | `https://chat.deepseek.com/a/chat/s/abc123` |
| ChatGPT | `https://chatgpt.com/c/{session_id}` | `https://chatgpt.com/c/abc123` |
| DeepWiki | `https://deepwiki.com/search/_{session_id}` | `https://deepwiki.com/search/_ba6a68f8-4c5c-4722-b8e0-ccf2959fdb1e` |

**DeepWiki URL 说明**：
- 完整URL格式：`https://deepwiki.com/search/_{session_id}?mode=fast`
- session_id 前需要添加下划线 `_`
- 可选参数 `?mode=fast` 用于指定搜索模式，生成链接时可省略
