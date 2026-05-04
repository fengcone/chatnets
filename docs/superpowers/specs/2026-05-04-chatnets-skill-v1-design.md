# Chatnets Skill V1 设计

状态：草稿，等待用户 review
日期：2026-05-04

## 目标

Chatnets V1 是一个给 Codex / Claude Code 使用的学习型 skill。

用户在 Obsidian vault 根目录打开 Codex 或 Claude Code，然后用一个主题开启学习会话。之后用户就像平常聊天一样学习。Chatnets 一边解释、追问、纠错，一边把真正经过费曼复述确认的知识沉淀成 Obsidian 里的概念笔记。

这个版本不追求采集所有 AI 对话。它只保存学习过程中真正变成稳定理解的部分。

## 核心思路

整体流程是：

```text
学习对话 -> 生成 session 来源笔记 -> 识别费曼复述 -> 沉淀主题内 concepts -> 更新 MOC
```

Chatnets 不依赖浏览器插件、Go 服务、Codex 内部 session 文件，也不依赖 Claude Code 的内部日志。学习过程中，skill 自己在 vault 里写一份可引用的 session 笔记。这份 session 笔记就是后续 concept 文件的稳定来源。

## Vault 约定

当前工作目录就是 Obsidian vault 根目录。

这个 vault 默认应该有一个代理说明文件，优先使用 `AGENTS.md`。它的作用是告诉 Codex / Claude Code：这个文件夹是学习 vault，不是普通代码开发目录。如果某个工具更偏好 `CLAUDE.md` 之类的文件名，Chatnets 可以创建等价说明文件。

建议的 `AGENTS.md` 内容：

```markdown
# Agent Instructions

这个文件夹是一个 Obsidian 学习 vault。

当用户调用 Chatnets 时，优先进行学习陪伴、概念解释、费曼复述检查和笔记沉淀。不要把这个 vault 当成普通应用代码仓库，除非用户明确要求做软件开发工作。

Chatnets 学习会话约定：
- 不把原始聊天流水账直接放进最终概念层。
- 把可引用的学习证据写入 `sessions/`。
- 只有确认理解后的内容才进入 `concepts/`。
- 不确定内容先留在 `inbox/`。
- 主题入口和学习路径维护在 `mocs/`。
```

Chatnets 启动时应该检查这个文件。如果缺失，应先询问用户，再创建。

## 启动流程

用户可以这样启动：

```text
用 chatnets 学习 Linux 容器运行时
```

Chatnets 启动后：

1. 确认当前目录是 Obsidian vault 根目录。
2. 判断本次学习归属的大主题目录名。
3. 如果主题不存在，询问用户确认主题名。
4. 创建或复用主题相关目录和文件。
5. 创建当天的 session 笔记。

大主题名是给人看的，应尽量自然，例如 `Linux 容器运行时`、`Kubernetes 网络`、`AI 沙箱平台`。

## 目录结构

以主题 `Linux 容器运行时` 为例：

```text
<vault>/
  AGENTS.md

  sessions/
    Linux 容器运行时/
      2026-05-04-container-runtime.md

  concepts/
    Linux 容器运行时/
      containerd.md
      runc.md
      shim.md
      OCI runtime.md

  inbox/
    Linux 容器运行时.md

  mocs/
    Linux 容器运行时.md

  meta/
    chatnets-state.yaml
```

这样可以避免所有概念都平铺在一个 `concepts/` 目录下，同时仍然保留跨主题链接能力。

## Session 来源笔记

Session 笔记不是完整聊天记录，而是 Chatnets 整理出来的学习证据。

每个 session 笔记包含带锚点的学习片段：

```markdown
# container runtime 学习会话

## containerd 和 runc 的关系

### 提问 ^q-001

containerd 和 runc 是什么关系？

### 解释摘要 ^a-001

containerd 负责容器生命周期管理，runc 是 OCI runtime 的底层执行器，shim 负责解耦 containerd 与容器进程。

### 我的费曼复述 ^f-001

我理解一下，所以 containerd 更像管理层，runc 是最后真正创建容器进程的执行器，shim 把它们隔开。
```

concept 文件引用这些锚点：

```yaml
source_sessions:
  - sessions/Linux 容器运行时/2026-05-04-container-runtime.md#^q-001
  - sessions/Linux 容器运行时/2026-05-04-container-runtime.md#^f-001
```

这样 Obsidian 里可以稳定跳转，不需要依赖 Codex 或 Claude Code 的私有存储格式。

## 费曼识别

Chatnets 用三个状态推进知识沉淀：

1. `candidate`：用户问到了一个概念、机制、区别、架构、原则或流程。
2. `needs-confirmation`：用户尝试复述，但理解还有缺口或错误。
3. `confirmed`：用户已经用自己的话准确复述了核心关系。

费曼信号包括：

```text
我理解一下...
所以是不是...
也就是说...
我的理解是...
我复述一下...
这样理解对吗...
我现在感觉它其实是...
```

只出现这些表达还不够。Chatnets 必须判断用户复述是否抓住了核心关系。如果复述不准确，Chatnets 应该先纠正，而不是把错误理解写进正式 concept。

## Inbox 机制

还没有通过费曼确认的候选概念，先放在：

```text
inbox/<主题>.md
```

inbox 按学习线索整理，记录：

- 候选概念名
- 当前不确定点
- 还需要澄清什么
- 对应的 session 锚点

inbox 可以稍微乱一点。正式 `concepts/` 层要保持干净。

## Concept 文档格式

确认后的概念采用双层结构：一层是准确整理后的知识，一层是用户自己的理解证据。

```markdown
---
type: concept
status: confirmed
topic: Linux 容器运行时
aliases: []
tags: []
source_sessions:
  - sessions/Linux 容器运行时/2026-05-04-container-runtime.md#^q-001
  - sessions/Linux 容器运行时/2026-05-04-container-runtime.md#^f-001
---

# containerd

## 准确定义

...

## 关键理解

- ...
- ...

## 我的理解

> ...

## 学习来源

- [[2026-05-04-container-runtime#^q-001]] 提问
- [[2026-05-04-container-runtime#^f-001]] 费曼复述

## 相关概念

- [[runc]]
- [[shim]]
- [[OCI runtime]]
```

`准确定义` 和 `关键理解` 由模型整理成准确笔记。`我的理解` 尽量保留用户自己的说法，这样以后回看时能看到当时理解发生的证据。

## MOC 机制

每个主题有一个 MOC：

```text
mocs/Linux 容器运行时.md
```

MOC 是主题入口，应该包含：

- 核心概念
- 推荐学习路径
- 跨主题相关概念
- 相关 session 链接
- 未解决问题

MOC 不应该只是概念列表 dump。Chatnets 应该让它保持可读、有层次。

## 同名概念策略

默认按主题隔离 concept。

例如：

```text
concepts/Linux 容器运行时/Namespace.md
concepts/Kubernetes 基础/Namespace.md
```

Chatnets 不自动合并这些文件。如果发现另一个主题里已有高度相似的概念，应提醒用户：

```text
我发现这个 Namespace 和 Kubernetes 基础里的 Namespace 高度相关。
要保持主题内独立，还是建立一个 canonical concept 并让两个主题引用它？
```

V1 只需要支持提醒和人工决策。真正的全局 canonical concept 层可以放到后续版本。

## 状态文件

Chatnets 的运行状态写在：

```text
meta/chatnets-state.yaml
```

状态文件记录：

- 已知主题
- 每个主题当前活跃 session
- 下一个锚点编号
- 候选概念
- 已确认概念
- 同名概念或合并提醒

示例：

```yaml
topics:
  Linux 容器运行时:
    session_dir: sessions/Linux 容器运行时
    concept_dir: concepts/Linux 容器运行时
    inbox_file: inbox/Linux 容器运行时.md
    moc_file: mocs/Linux 容器运行时.md
    next_anchor: 2
    candidates:
      - shim
    confirmed:
      - containerd
      - runc
```

## V1 不做什么

V1 不包含：

- Chrome 扩展采集
- 手机 app 采集
- ChatGPT export 导入
- 后台 daemon
- Go HTTP 服务
- 自动解析 Codex / Claude Code 内部 session 日志
- 全局 concept 自动合并
- 图谱可视化 UI

这些以后都可以回来，但第一个可用版本应该先把 skill 内学习闭环做好。

## 错误处理

如果当前目录不像 Obsidian vault，Chatnets 应先询问，再创建结构。

如果主题已经存在，复用已有主题。

如果同主题下已有 concept 文件，更新它，不创建重复文件。

如果用户费曼复述明显有错，不写入 confirmed concept，而是先解释纠正。

如果缺少 `AGENTS.md`，先询问用户再创建。

## 验收标准

V1 成功时应支持这个流程：

1. 用户在 Codex 或 Claude Code 中打开 Obsidian vault。
2. 用户说：`用 chatnets 学习 Linux 容器运行时`。
3. Chatnets 询问或确认大主题目录名。
4. 用户围绕一个概念提问。
5. Chatnets 解释，并把候选概念记入主题 inbox。
6. 用户给出费曼复述。
7. Chatnets 验证理解，创建 session 来源锚点，提升 concept，更新主题 MOC。
8. Obsidian 里看到的是按主题组织的概念，而不是一个全局平铺列表。

## 待定问题

1. 第一次运行时，Chatnets 是否自动创建 `AGENTS.md`，还是总是先询问？
2. session 笔记是否只记录成功的费曼三元组，还是也记录纠错后的失败尝试？
3. 跨主题合并提醒放在 `meta/chatnets-state.yaml`、可见的 `inbox/merge-suggestions.md`，还是两边都放？
4. 是否需要一个“结束学习会话”的命令，用来生成最后的复盘笔记？
