# Chatnets

> 在 Codex 或 Claude Code 中把学习对话沉淀成 Obsidian 知识库

Chatnets 是一个全局学习写作协议（以 Skill 的形式提供）。你在 Codex 或 Claude Code 中自然地学习、追问、用自己的话复述；当你觉得这段对话值得记下来，就唤起 Chatnets。它读取当前可见对话和 `~/Chatnets` 中已有笔记，给出一份落盘草案，你确认后再写入 Obsidian vault。

## 核心理念

费曼复述是 Chatnets 判断学习是否真正发生的核心信号。只有你用自己的话讲清楚的内容，才会变成稳定的概念笔记；失败的复述也会保留在 Session 中，记录纠偏过程。

## Vault 结构

固定的全局 vault 是 `~/Chatnets`：

```text
~/Chatnets/
  Assets/      # 图片、PDF、截图、网页资料;概念图放 Assets/Concepts/
  Session/     # 学习记忆索引,按大类平铺,文件内按月份追加
  Concepts/    # 原子概念,一个概念一个文件
  Mocs/        # 大类知识地图,记录学习路径和关联问题
```

四类文件的分工：

- **Session**：可回忆的学习片段，保留你的原始提问和费曼复述，AI 回复只摘要。
- **Concepts**：原子概念（单一、通用、独立），默认配一张概念图作为视觉锚点。
- **Mocs**：大类地图，组织学习路径、关联问题和待学清单。
- **Assets**：参考材料和概念图。

## 怎么用

### 安装

把 `SKILL.md` 链接到你的 Skill 目录：

```bash
# Claude Code
mkdir -p ~/.claude/skills/chatnets
ln -s "$(pwd)/SKILL.md" ~/.claude/skills/chatnets/SKILL.md

# Codex 按对应的 Skill 配置方式接入
```

首次写入时，如果 `~/Chatnets` 还不是 git 仓库，Chatnets 会问你是否启用 git 版本管理。

### 唤起

先正常聊天学习，然后用任意一种方式唤起：

- “用 Chatnets 总结一下”
- “沉淀到 Chatnets”
- “整理进 Obsidian”
- 直接在费曼复述后说“这段用 Chatnets 记一下”

Chatnets 会：

1. 推断这次学习属于哪个大类（如 `Linux`、`Kubernetes`）。
2. 读取对应的 `Mocs/<大类>.md`、`Session/<大类>.md` 和相关 `Concepts/`。
3. 输出一份落盘草案，列出准备更新的 Session、Concepts、Mocs、Assets。
4. 等你确认（全部、部分、或要求修改）。
5. 写入文件，必要时生成概念图，最后提交一次 git commit。

### 落盘草案示例

```markdown
## Chatnets 落盘草案

### Session
- 更新 Session/Linux.md 的 2026-05 小节,记录 containerd/runc 这次学习

### Concepts
- 新建 Concepts/containerd.md
- 新建 Concepts/runc.md
- 更新 Concepts/shim.md

### Mocs
- 更新 Mocs/Linux.md:加入 [[containerd]]、[[runc]]、[[shim]] 的学习路径

### Assets
- 生成 Assets/Concepts/containerd.png
```

## 设计要点

- **原子概念**：`Concepts/` 只放单一、通用、独立的概念（如 `containerd`、`cgroup`、`Pod`）。组合短语、设计原则、对比类内容不进入 Concepts，而是写进相关概念内部章节或 MOC 的学习路径。
- **概念图**：每个新增概念默认配一张概念图（`Assets/Concepts/<概念名>.png`），表达核心心智模型，不替代正文定义。生成图片的提示词不写入 Concept 文档。
- **整理时机**：新概念默认写入 `Concepts/` 根目录；只在你明确要求整理时才移动到 `Concepts/<目录>/`，同步更新所有相关链接。
- **回跳链接**：在 Codex Desktop 中自动读取 `CODEX_THREAD_ID` 生成 `codex://threads/<id>`，只写入 Session，不污染 Concepts 和 Mocs。
- **源码学习**：涉及 GitHub 源码时统一使用 `~/WorkSpaceG` 作为本地仓库目录，Obsidian 只记录理解和引用位置，不保存源码全文。

## 详细规则

完整的协议细节看 [SKILL.md](SKILL.md)：Vault 结构、唤起方式、大类推断、落盘流程、Session/Concepts/Mocs/Assets 各自的规则、费曼模式识别、概念图生成、落盘前后检查清单。
