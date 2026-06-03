---
name: chatnets
description: Use when 用户要在 Codex 或 Claude Code 中唤起 Chatnets，把学习对话沉淀到全局 Obsidian vault，整理 Session、原子概念、Flow、概念图、MOC 和参考资料
---

# Chatnets

Chatnets 是一个全局学习写作协议。用户先在 Codex 或 Claude Code 中自然学习、追问和费曼复述；当用户觉得这段对话值得沉淀时，唤起 Chatnets。Chatnets 读取当前可见对话和 `~/Chatnets` 中已有笔记，给出落盘草案，用户确认后写入 Obsidian vault。

Chatnets 的输出落在五类 Obsidian 文件中：`Session` 提供学习记忆索引，`Concepts` 沉淀原子概念，`Flows` 记录流程和链路，`Mocs` 组织知识地图，`Assets` 保存参考材料。文件路径、双向链接和用户整理动作表达知识的组织状态。

## Vault 结构

固定全局 vault 是 `~/Chatnets`，学习笔记默认写入这个目录。目录结构固定为：

```text
~/Chatnets/
  Assets/
  Session/
  Concepts/
  Flows/
  Mocs/
```

- `Assets/`：图片、PDF、截图、网页资料和其他参考材料。概念图默认放入 `Assets/Concepts/`，概念笔记、Flow、Session 和 MOC 里引用对应材料。
- `Session/`：学习记忆索引，按大类平铺，如 `Session/Linux.md`、`Session/Kubernetes.md`。文件内部按月份追加。
- `Concepts/`：原子概念集合。`Concepts/xx.md` 表示由 Chatnets 根据学习对话生成、等待用户归类的概念；`Concepts/<目录>/xx.md` 表示已归入某个知识目录的概念。
- `Flows/`：流程笔记集合，记录操作步骤、源码调用链、执行链路和排障路径。默认按大类建目录，如 `Flows/E2B/ResumeSandbox 到 VM ready.md`。
- `Mocs/`：概念地图，按大类知识体系平铺，如 `Mocs/Linux.md`、`Mocs/Kubernetes.md`。MOC 以链接、学习路径和问题索引为主；概念正文留在 Concepts，流程正文留在 Flows。

## 唤起方式

常见触发：

- 用户先聊天学习，然后说“用 Chatnets 总结一下”“沉淀到 Chatnets”“整理进 Obsidian”。
- 用户在费曼复述里直接唤起 Chatnets，比如“我的理解是... 这段用 Chatnets 记一下”。
- 用户学习了一条操作流程、源码调用链或执行链路，要求 Chatnets 记录成 Flow。
- 用户定期整理 `Concepts/` 根目录，要求 Chatnets 把某些概念归入 `Concepts/<目录>/` 并更新 MOC。

Chatnets 的可用来源范围是：当前可见对话、用户提供的文件或链接、以及 `~/Chatnets` 中已经存在的笔记。Codex 或 Claude Code 的隐藏日志不属于可用来源。如果上下文不足，先让用户补充材料，再生成落盘草案。

## 大类推断

每次唤起时，先根据当前对话和已有 `Mocs/*.md` 推断大类，例如 `Linux`、`Kubernetes`、`Kata 容器`。

- 能明确判断时，直接使用对应大类。
- 对话跨多个大类时，选择最主要的大类，并在草案里说明次要关联。
- 不确定时，只问一次用户要归到哪个大类。
- 新大类成立时，同时创建 `Session/<大类>.md` 和 `Mocs/<大类>.md`。

## 落盘流程

1. 读取相关历史：对应的 `Mocs/<大类>.md`、`Session/<大类>.md`、可能相关的 `Concepts/` 和 `Flows/` 文件。
2. 从当前对话中识别学习收获，重点看用户提问和用户费曼复述；如果用户多次复述、修正和追问同一问题，要保留理解逐步形成的过程。
3. 给出简短落盘草案，列出准备更新的 `Session`、`Concepts`、`Flows`、`Mocs`、`Assets`。
4. 等用户确认。用户可以确认全部、只确认部分，或要求修改。
5. 确认后写入文件。新增概念默认写入 `Concepts/` 根目录；新增 Flow 默认写入 `Flows/<大类>/`；分类目录只在用户明确要求整理时使用。
6. 如果 `~/Chatnets` 已初始化 git 仓库，落盘后提交一次 commit；如果尚未初始化，先询问用户是否启用 git 版本管理。

落盘草案示例：

```markdown
## Chatnets 落盘草案

### Session
- 更新 `Session/Linux.md` 的 `2026-05` 小节，记录 containerd/runc 这次学习。
- 如果当前环境有 `CODEX_THREAD_ID`，写入原始对话回跳链接。

### Concepts
- 新建 `Concepts/containerd.md`
- 新建 `Concepts/runc.md`
- 更新 `Concepts/shim.md`

### Flows
- 新建 `Flows/Linux/containerd 调用 runc 创建容器.md`

### Mocs
- 更新 `Mocs/Linux.md`：加入 [[containerd]]、[[runc]]、[[shim]] 和 [[Flows/Linux/containerd 调用 runc 创建容器|containerd 调用 runc 创建容器]] 的学习路径。
- 在“待增加”里记录 cgroup freezer，不使用双向链接。

### Assets
- 生成 `Assets/Concepts/containerd.png`
- 复制或引用 `Assets/containerd-architecture.pdf`
```

## Session 规则

`Session/` 是大脑索引：帮助用户想起当时怎么问、怎么理解、哪里被纠正。它记录可回忆的学习片段，而非逐条保存全部对话。

文件按大类平铺：

```text
Session/
  Linux.md
  Kubernetes.md
```

每个文件内部按月份组织：

```markdown
# Linux

## 2026-05

### 2026-05-08 containerd 和 runc 的关系

- **原始对话：** [打开 Codex 原文](codex://threads/00000000-0000-0000-0000-000000000000)
- **用户提问：** containerd 和 runc 是什么关系？
- **AI 摘要：** containerd 负责容器生命周期管理，runc 是底层 OCI runtime，containerd 通常通过 shim 调用 runc。
- **用户费曼复述：** 我理解 containerd 更像管理层，runc 更像真正执行创建容器的工具。
- **AI 纠错/评价：** 理解基本正确，需要补充 shim 是隔离 containerd 和容器进程生命周期的中间层。
- **相关概念：** [[containerd]]、[[runc]]、[[shim]]

---

### 2026-05-08 containerd shim 的作用

- **原始对话：** [打开 Codex 原文](codex://threads/00000000-0000-0000-0000-000000000000)
- **用户提问：** shim 为什么要独立出来？
- **AI 摘要：** shim 隔离 containerd 和具体容器进程，帮助容器在 containerd 重启等情况下继续被管理。
- **用户费曼复述：** 我理解 shim 是 containerd 和容器之间的中间层，避免 containerd 直接绑定容器进程生命周期。
- **AI 纠错/评价：** 方向正确，还要注意 shim 和 OCI runtime 的职责边界。
- **相关概念：** [[shim]]、[[containerd]]、[[runc]]
```

记录原则：

- 固定使用加粗标签：`**原始对话：**`、`**用户提问：**`、`**AI 摘要：**`、`**用户费曼复述：**`、`**AI 纠错/评价：**`、`**相关概念：**`。
- 每个费曼三元组/四元组之间用 `---` 分割，方便人在 Obsidian 中扫读。
- 用户说的话尽量一字不差，尤其是提问和费曼复述。
- AI 回复只写摘要，突出结论、纠错和边界。
- 如果用户围绕同一问题多次费曼复述，按时间顺序把每一轮都写入同一个 `###` 学习标题下；不要只保留最后一次正确复述。
- 多轮复述之间用 `---` 分割。后续轮次可以只写本轮新增的 `**AI 摘要：**`、`**用户费曼复述：**`、`**AI 纠错/评价：**` 和 `**相关概念：**`，不用重复已经相同的原始对话链接。
- 每次唤起 Chatnets 后，在对应月份下追加一段。
- 如果同一天多次学习同一主题，可以追加多个三级标题。
- 相关概念只链接已经存在或本次将创建的概念文件。

原始对话回跳：

- 在 Codex Desktop 中，优先读取环境变量 `CODEX_THREAD_ID`，自动生成 `codex://threads/<CODEX_THREAD_ID>`。
- 如果用户手动提供 `codex://...` deeplink，使用用户提供的链接。
- 如果是在 Codex 旁路聊天中唤起 Chatnets，优先让用户提供原学习会话的 deeplink 或 thread id；不要默认把旁路聊天的 `CODEX_THREAD_ID` 当作原学习会话。
- 如果既没有 `CODEX_THREAD_ID`，也没有用户提供的 deeplink，就省略 `**原始对话：**`，不要阻塞落盘。
- 原始对话链接只写入 `Session/`，不要写入 `Concepts/` 或 `Mocs/`，避免污染知识图谱。
- 原始对话链接只是回到 Codex 原文的快捷入口，不替代 Session 摘要，也不当作长期归档。

## 费曼模式

费曼复述是 Chatnets 判断学习发生的核心信号。重点识别用户是否用自己的话表达理解。

触发信号包括：

- “我理解一下...”
- “我的理解是...”
- “我复述一下...”
- “所以是不是...”
- “也就是说...”
- “这样理解对吗...”
- “我现在感觉它其实是...”

也要识别无固定开头但明显在复述的内容，例如用户把刚才解释的机制重新组织成因果链、类比、边界判断。

判断标准：

- 核心关系是否正确：谁依赖谁、谁负责什么、因果方向是否对。
- 边界是否清楚：有没有把相邻概念混成一个东西。
- 是否是用户自己的语言，避免复制 AI 原话。
- 是否值得以后回看，不会把错误理解当成知识。

失败复述和中间态复述都要写入 `Session/`，因为它们记录了纠偏过程和理解如何逐步成形。概念笔记里的“我的理解”只写最终稳定的理解；失败复述、中间态复述和多轮纠偏保留在 Session 中。

## Concepts 规则

`Concepts/` 只放原子概念。流程链路写入 `Flows/`；判断、对比和边界内容写进相关原子概念内部章节，或放进 MOC 的学习路径。

原子概念要满足：

| 标准 | 说明 |
|------|------|
| 单一性 | 只描述一个事物或概念 |
| 通用性 | 在领域内被广泛认知和使用 |
| 独立性 | 可以独立存在和讨论 |

接受：

- 单个技术名词：`cgroup`、`namespace`、`mount`、`Pod`、`Service`、`Deployment`、`镜像`、`容器`。
- 带限定的独立概念：`Kubernetes Namespace`、`Linux cgroup`。判断技巧是去掉限定词后，概念是否仍然独立存在。

拒绝：

- 组合短语：`kubelet cgroup 驱动`、`容器镜像分层存储`、`Kubernetes 高可用集群`。
- 设计原则或方法论：`XX 设计原则`、`XX 最佳实践`、`XX 编程范式`。
- 描述性短语：`容器与虚拟机对比`、`微服务架构选型`。

新增概念默认写入 `Concepts/<概念名>.md`。用户确认整理时，再移动到 `Concepts/<目录>/<概念名>.md`。移动后同步更新 MOC 和相关笔记里的链接。

每个新增概念默认配一张概念图。概念图是帮助回忆的视觉锚点，不替代正文定义、边界和纠错。已有概念被大幅更新时，如果还没有概念图，也补上概念图；当前环境不能生成图片时，可以在落盘草案里说明待补图，但不要把生成图片用的提示词写入 Concept 文档。

概念笔记模板：

```markdown
# containerd

## 概念图

![[Assets/Concepts/containerd.png]]

## 准确定义

containerd 是一个负责管理容器生命周期的容器运行时守护进程。

## 我的理解

这里写用户已经复述清楚、并经过 Chatnets 纠偏后的理解。

## 常见混淆

- containerd 不是 [[runc]]。
- containerd 通常通过 [[shim]] 管理容器进程生命周期边界。

## 相关概念

- [[runc]]
- [[shim]]

## 学习来源

- [[Session/Linux#2026-05-08 containerd 和 runc 的关系|Linux · 2026-05-08 containerd 和 runc 的关系]]
```

概念图规则：

- 图片路径使用 `Assets/Concepts/<概念名>.png`。Concept 文档中优先用 `![[Assets/Concepts/<概念名>.png]]` 引用，避免概念文件移动后相对路径失效。
- 当前 Codex 环境支持图片生成时，用户确认落盘后直接生成图片并写入 `Assets/Concepts/`。
- 当前环境不支持图片生成时，不阻塞落盘，可以在本次回复或落盘草案里说明待补图；不要在 Concept 文档里写生成图片用的提示词。
- 概念图只表达一个原子概念的核心心智模型。概念偏机制时画机制关系，偏抽象时画类比模型，偏边界时画它和相邻概念的边界。
- 图里少放文字，不能让图片承担精确定义、源码事实、配置细节或未经确认的关系。
- 生成图片后，Concept 文档只保留 `## 概念图` 和图片引用，不保留生成提示词。

生成概念图时，内部按这些信息组织提示词，不写入 Obsidian 文件：

- 概念名
- 一句核心定义
- 用户已经确认过的理解
- 需要表现的核心关系
- 不要表现的错误类比、误解或不确定关系
- 视觉要求：横版图、适合放在 Obsidian 概念笔记顶部、干净、技术感、浅色背景、少文字、用图形和箭头表达边界与关系

Concept 学习来源链接规则：

- `Mocs/<大类>.md` 和 `Session/<大类>.md` 允许同名，但 Concept 的 `## 学习来源` 必须明确指向 `Session/` 目录。
- 学习来源统一写成 `[[Session/<大类>#<Session 三级标题>|<大类> · <Session 三级标题>]]`。
- 不要写裸链接，例如 `[[Linux#...]]`、`[[E2B#...]]`、`[[Kubernetes#...]]`；这类链接在存在同名 MOC 时容易跳错。
- 概念链接仍然使用概念名，例如 `[[containerd]]`、`[[userfaultfd]]`；Flow 链接使用带路径链接，例如 `[[Flows/E2B/ResumeSandbox 到 VM ready|ResumeSandbox 到 VM ready]]`。

## Flows 规则

`Flows/` 记录有顺序、有入口、有出口的过程，用来保存操作步骤、源码调用链、执行链路、部署过程、排障路径和实验过程。Flow 回答的是：“这件事是怎么一步步发生的？”

边界：

- 单个技术名词写入 `Concepts/`。
- 大类知识体系写入 `Mocs/`。
- 用户怎么问、怎么复述、怎么被纠正写入 `Session/`。
- 一条流程、链路、调用路径或排障路径写入 `Flows/`。

文件路径：

```text
Flows/<大类>/<Flow 标题>.md
```

Flow 标题要像一条过程，而不是一个名词。优先使用“入口到出口”或“动作 + 结果”的名字，例如 `ResumeSandbox 到 VM ready`、`containerd 调用 runc 创建容器`。

Flow 笔记使用这些章节：`适用场景`、`入口`、`流程`、`出口`、`关键概念`、`容易误解`、`学习来源`。其中 `流程` 用有序列表，`关键概念` 只链接已存在或本次将创建的概念，`学习来源` 指向对应 Session。

记录原则：

- Flow 里的每一步尽量写成动作，不写成抽象名词堆叠。
- 只双链已存在或本次将创建的概念文件；还没学成原子概念的词，先保持纯文本。
- Flow 可以被 MOC 链接，MOC 中使用带路径链接，例如 `[[Flows/E2B/ResumeSandbox 到 VM ready|ResumeSandbox 到 VM ready]]`。
- Flow 的学习来源必须明确指向 `Session/` 目录，不写裸链接。
- Flow 可以引用 `Assets/` 中的架构图、截图、PDF 或源码阅读材料；如果需要流程图，放入 `Assets/Flows/`。

## Mocs 规则

`Mocs/` 是大类知识体系的地图，文件平铺：

```text
Mocs/
  Linux.md
  Kubernetes.md
  Kata 容器.md
```

MOC 可以链接已存在或本次将创建的 `Concepts/` 和 `Flows/` 文件。还没创建的概念或 Flow 写在“待增加”区，不使用 `[[双向链接]]`。

MOC 示例：

```markdown
# Linux

## 核心概念

- [[containerd]]
- [[runc]]
- [[shim]]

## 学习路径

1. 先理解 [[容器]]
2. 再理解 [[containerd]] 如何管理容器生命周期
3. 再理解 [[runc]] 和 [[shim]] 的边界
4. 再看 [[Flows/Linux/containerd 调用 runc 创建容器|containerd 调用 runc 创建容器]]

## 关联问题

- containerd 为什么需要 shim？
- runc 退出后容器进程还在吗？

## 待增加

- cgroup freezer：后续需要单独学习
- namespace 与 mount namespace 的关系
```

## Assets 规则

如果当前对话涉及图片、PDF、截图、网页资料或本地文件：

- 可用资料放入 `Assets/`，优先保留原始文件名；必要时加日期或主题前缀。
- 概念图放入 `Assets/Concepts/`，文件名使用对应概念名。
- 笔记中使用相对链接，例如 `![架构图](../Assets/containerd-architecture.png)` 或 `[PDF](../Assets/containerd.pdf)`。
- Concept 文档中的概念图使用 Obsidian 嵌入链接，例如 `![[Assets/Concepts/containerd.png]]`。
- Flow 相关流程图或截图放入 `Assets/Flows/`。
- 大型源码仓库、完整网页正文或长 PDF 内容保留在原位置；概念笔记只记录理解、引用位置和关键材料链接。

## GitHub 源码学习

如果学习涉及 GitHub 源码，源码统一优先使用 `~/WorkSpaceG`：

- 先在 `~/WorkSpaceG` 查找是否已有对应仓库。
- 已有仓库就直接阅读、搜索和讲解。
- 未找到仓库时，再下载到 `~/WorkSpaceG`。
- Obsidian vault 只记录学习理解、文件路径、函数名、commit/tag 和关键引用，不保存源码全文。

## 落盘前检查清单

写文件前自检：

1. 是否已经推断或确认大类？
2. 是否读取了对应 `Mocs/<大类>.md` 和 `Session/<大类>.md`？
3. 新概念是否真的是原子概念？
4. 新概念是否默认写入 `Concepts/` 根目录？
5. 新概念是否包含 `## 概念图`，且没有写入生成提示词？
6. 概念图是否只表达已确认的核心关系，没有替代正文？
7. 如果内容是流程、链路、操作步骤或排障路径，是否写入 `Flows/` 而不是伪装成 Concept？
8. Flow 是否有清楚的入口、流程、出口和关键概念？
9. MOC 双向链接是否只指向已存在或本次将创建的 Concepts/Flows？
10. 未创建概念或 Flow 是否放在 MOC 的“待增加”区，并保持纯文本？
11. Concept 和 Flow 的 `## 学习来源` 是否使用 `[[Session/<大类>#标题|...]]`，没有使用裸的 `[[<大类>#...]]`？
12. Session 是否尽量保留用户原话，AI 回复是否只摘要？
13. 如果用户多次费曼复述同一问题，Session 是否按时间顺序保留了每一轮，而不是只保留最终版本？
14. 如果存在 `CODEX_THREAD_ID` 或用户提供了 deeplink，Session 是否写入 `**原始对话：**`？
15. 如有 Assets，是否使用正确链接引用？
16. 用户是否已经确认落盘？

## 落盘后检查清单

写文件后自检：

1. `Session/<大类>.md` 已按月份追加。
2. `Concepts/` 中新增或更新了原子概念。
3. 新增或大幅更新的 Concept 已有概念图；如果当前环境不能生成图片，已在本次回复或草案说明待补图，且 Concept 文档没有保留生成提示词。
4. 如有流程、链路、操作步骤或排障路径，`Flows/<大类>/` 中已新增或更新对应 Flow。
5. `Session/` 中的原始对话链接能回跳到 Codex 原文，且没有写入 `Concepts/`、`Flows/` 或 `Mocs/`。
6. Concept 和 Flow 的学习来源链接都显式指向 `Session/` 目录。
7. `Mocs/<大类>.md` 已更新学习路径、概念关联和 Flow 入口。
8. Obsidian 双向链接都指向已存在或本次创建的 Concepts/Flows。
9. 如果 `~/Chatnets` 是 git 仓库，已提交一次清晰的 commit。
