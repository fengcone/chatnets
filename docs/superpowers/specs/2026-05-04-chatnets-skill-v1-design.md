# Chatnets Skill V1 Design

Status: Draft for user review
Date: 2026-05-04

## Purpose

Chatnets V1 is a Codex / Claude Code skill for learning inside an Obsidian vault.

The user opens the vault folder in Codex or Claude Code, starts a learning session with a topic, then chats normally. Chatnets acts as a learning companion and knowledge compiler: it detects candidate concepts, waits for Feynman-style understanding signals, and writes confirmed concepts into an Obsidian-friendly knowledge structure.

The goal is not to capture every AI conversation. The goal is to preserve the parts of a learning conversation that became stable understanding.

## Core Idea

The pipeline is:

```text
learning conversation -> generated session source -> Feynman detection -> topic-scoped concepts -> MOC
```

Chatnets does not depend on browser capture, a Go service, Codex internal session files, or Claude Code internal logs. During the learning session, the skill writes its own source notes into the vault. Those generated session notes become the durable source references for concept files.

## Vault Contract

The current working directory is treated as the Obsidian vault root.

The vault should include a default agent instruction file, preferably `AGENTS.md`, that tells Codex / Claude Code this folder is a learning vault rather than a normal software-development workspace. If the target agent expects another filename such as `CLAUDE.md`, Chatnets may create the equivalent file with the same intent.

Suggested `AGENTS.md` content:

```markdown
# Agent Instructions

This folder is an Obsidian learning vault.

When the user invokes Chatnets, prioritize learning, explanation, Feynman-style checks, and note synthesis. Do not treat this vault as an application codebase unless the user explicitly asks for software-development work.

For Chatnets learning sessions:
- Keep raw conversation out of the final concept layer.
- Write durable learning evidence to `sessions/`.
- Promote only confirmed understanding into `concepts/`.
- Keep uncertain material in `inbox/`.
- Maintain topic MOCs in `mocs/`.
```

Chatnets should check for this file at startup. If it is missing, Chatnets should ask before creating it.

## Startup Flow

The user starts a session with a command like:

```text
用 chatnets 学习 Linux 容器运行时
```

Chatnets then:

1. Confirms the current directory is the Obsidian vault root.
2. Determines the topic directory name.
3. If the topic is new, asks the user to confirm the large topic name.
4. Creates or reuses the topic directories and files.
5. Starts a dated session note.

The large topic name is user-facing and should be human-readable, for example `Linux 容器运行时`, `Kubernetes 网络`, or `AI 沙箱平台`.

## Directory Layout

For a topic named `Linux 容器运行时`, Chatnets maintains:

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

This avoids a flat global `concepts/` directory while still allowing cross-topic links.

## Session Source Notes

Session notes are not full chat transcripts. They are curated learning evidence written by Chatnets.

Each session note contains anchored blocks:

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

Concept files link to these anchors:

```yaml
source_sessions:
  - sessions/Linux 容器运行时/2026-05-04-container-runtime.md#^q-001
  - sessions/Linux 容器运行时/2026-05-04-container-runtime.md#^f-001
```

This gives stable Obsidian references without relying on Codex or Claude Code private storage formats.

## Feynman Detection

Chatnets promotes knowledge through three states:

1. `candidate`: the user asked about a concept, mechanism, comparison, architecture, principle, or workflow.
2. `needs-confirmation`: the user attempted a Feynman restatement, but Chatnets sees missing or incorrect understanding.
3. `confirmed`: the user restated the idea accurately enough in their own words.

Feynman signals include phrases such as:

```text
我理解一下...
所以是不是...
也就是说...
我的理解是...
我复述一下...
这样理解对吗...
我现在感觉它其实是...
```

The phrase alone is not enough. Chatnets must evaluate whether the restatement captures the core relation accurately. If not, it corrects the misunderstanding and leaves the item in `needs-confirmation`.

## Inbox Behavior

Concept candidates that have not passed Feynman confirmation stay in:

```text
inbox/<topic>.md
```

The inbox groups candidates by learning thread and records:

- candidate concept names
- current uncertainty
- what needs to be clarified
- links to the relevant session anchors

The inbox is allowed to be messy. The concept layer should stay clean.

## Concept Document Format

Confirmed concepts use a two-layer note structure: accurate synthesized knowledge plus the user's own understanding evidence.

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

The `准确定义` and `关键理解` sections should be cleaned up by the model. The `我的理解` section should preserve the user's own wording when possible.

## MOC Behavior

Each topic has one MOC:

```text
mocs/Linux 容器运行时.md
```

The MOC is the topic entry point. It should contain:

- core concepts
- suggested learning path
- related concepts across other topics
- session links
- unresolved questions

The MOC should not be a flat dump of every concept. Chatnets should keep it readable and organized.

## Same-Name Concept Strategy

Default behavior: concepts are scoped by topic.

Examples:

```text
concepts/Linux 容器运行时/Namespace.md
concepts/Kubernetes 基础/Namespace.md
```

Chatnets should not auto-merge these files. If it detects high overlap with an existing concept in another topic, it should ask:

```text
我发现这个 Namespace 和 Kubernetes 基础里的 Namespace 高度相关。
要保持主题内独立，还是建立一个 canonical concept 并让两个主题引用它？
```

V1 only needs to support the prompt. A future version may add a global canonical concept layer.

## State File

Chatnets stores operational state in:

```text
meta/chatnets-state.yaml
```

The state file tracks:

- known topics
- current active session per topic
- next anchor counters
- candidate concepts
- confirmed concepts
- known same-name or merge suggestions

Example:

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

## Non-Goals For V1

V1 should not include:

- Chrome extension capture
- phone app capture
- ChatGPT export import
- background daemon
- Go HTTP service
- automatic parsing of Codex or Claude Code internal session logs
- global concept canonicalization
- graph visualization UI

These may return later, but the first useful version should be a skill-first learning workflow.

## Error Handling

If the current directory does not look like a vault, Chatnets should ask before creating the structure.

If a topic already exists, Chatnets should reuse it.

If a concept file already exists in the same topic, Chatnets should update it rather than create a duplicate.

If the user's Feynman restatement appears wrong, Chatnets should avoid writing a confirmed concept and instead explain the correction.

If `AGENTS.md` is missing, Chatnets should ask before creating it.

## Validation Criteria

A successful V1 should support this workflow:

1. User opens an Obsidian vault in Codex or Claude Code.
2. User says: `用 chatnets 学习 Linux 容器运行时`.
3. Chatnets asks for or confirms the large topic directory name.
4. User asks about a concept.
5. Chatnets explains it and records a candidate in the topic inbox.
6. User gives a Feynman restatement.
7. Chatnets verifies it, creates a session source anchor, promotes the concept, and updates the topic MOC.
8. Obsidian shows topic-scoped concepts instead of one flat global concept list.

## Open Questions

1. Should Chatnets create `AGENTS.md` automatically on first run, or always ask first?
2. Should session notes include only successful Feynman triples, or also corrected failed attempts?
3. Should cross-topic merge suggestions live in `meta/chatnets-state.yaml`, a visible `inbox/merge-suggestions.md`, or both?
4. Should the skill support a command to close a learning session and generate a final review note?
