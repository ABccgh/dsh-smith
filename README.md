# DSH 智能体工坊 · DSH Agent Smith

一个专门用于**开发 DSH 智能体与 Cordis 插件**的 DeepSeek Harness agent preset：强化思考协议、四层记忆纪律、四位具名专家的常驻团队。

> An agent preset for the DeepSeek Harness, specialized in building harness agents and Cordis plugins.

[![topics](https://img.shields.io/badge/topics-DeepSeek%20Harness%20Plugins-blue)](#)

---

## 它是什么

DeepSeek Harness（DSH）里没有独立的配置语言：**每一项能力都是 `cordis.yml` 里的一个插件行**，而一个 agent preset 就是为单个会话挂载的这样一份文件。本仓库提供的 `dsh-smith` 就是这样一份 preset：文件里具名 **36 行**（16 个顶层行 + 3 个 group 内的 20 行），组合后 **33 行**（其余为 group 容器本身与流式包含）。

它从出厂 `cordis` 预设复制而来，因此天然可挂载，然后围绕三件事重建：

| 目标 | 实现 |
| --- | --- |
| 专门开发 DSH 智能体与插件 | 完整保留运行时自省工具集（inspect / define / run / stop）＋ 两个创作技能 ＋ 新增本部署的运行时速查技能 |
| 强化思考 | 组合设计规划协议（计划模式改造）＋ 两位专家 `reasoningEffort: max` ＋ 人格前缀的五步推理序 |
| 加强记忆 | 四层记忆契约 ＋ `AGENTS.md` 加载预算提升到 192 KiB ＋ 常驻记忆专家 |
| 专业专家团队 | 四条独立 `tool-subagent` 行，各自 persona、推理预算与工具过滤 |

## 快速开始

**前置条件**：已安装 DeepSeek Harness（`dsh`），Node.js ≥ 20。

```sh
git clone https://github.com/ABccgh/dsh-smith.git
cd dsh-smith
node bin/install.mjs
```

安装脚本把 `dsh-smith/` 整个目录复制到 `${DSH_HOME:-$HOME/.dsh}/.agent-presets/dsh-smith/`。它不会覆盖已存在的同名预设。

**验证安装**：

```sh
node bin/verify.mjs
```

该脚本调用花名册的 `standingKeyFor(id)` 做真实挂载检查——组合每个插件行，但不启动 agent、不启动会话、不启动回合。它刻意区分三种结局，**绝不把「没检查」说成「检查通过」**：

| 输出 | 含义 | 退出码 |
| --- | --- | --- |
| `MOUNTED OK` | 组合成功：无未激活行，无泄漏到根 realm 的服务 | 0 |
| `MOUNT REJECTED` | 无法组合，并打印确切原因 | 1 |
| `INCONCLUSIVE` | 本机没有可询问的 harness 运行时，**什么都没验证** | 1 |

裸 Cordis 运行时不含 harness 的注册表，所以在普通 shell 里它通常返回 `INCONCLUSIVE`；要在真实部署里验证，请在任意模式的会话中调用 `standingKeyFor('dsh-smith')`。

然后在需要该能力的会话里选择模式 **「DSH 智能体工坊」**。

```sh
# 也可以手动指定
dsh --agent-preset dsh-smith
```

## 组成

### 1. 思维协议

计划模式被替换为**组合设计协议**，要求按固定顺序作答：

1. **目标生命周期与平面** —— 改哪个文件，为什么是这一层而不是另一层；
2. **行清单** —— 每一行的精确包名、id、以及值发生变化的配置键；
3. **服务归属** —— 新行发布了哪些服务，由哪个 group/realm 持有，哪些消费方必须同处一个 realm；
4. **证据** —— 支撑该设计的文件、类型声明与 inspect 查询，以及没有证据能定论的假设；
5. **失败模式** —— 可能「挂载成功但毫无贡献」、与宿主注册冲突、或破坏其它会话的每一种方式；
6. **验证方式** —— 能证明改动成立的确切命令或调用，以及「成功」的可观察结果。

人格前缀另有一段五步推理序：目标生命周期 → 服务归属 → 证据 → 最小充分组合 → 证伪。核心要求是**区分「已核实」与「推断」**，并在用户会把推断读成事实的地方标注出来。

### 2. 记忆纪律

| 层 | 路径 | 生命周期 |
| --- | --- | --- |
| 指令 | `AGENTS.md`（按目录） | 持久，自动加载 |
| 编年史 | `docs/agent-notes/PROJECT.md` | 持久，就地修订 |
| 决策 | `docs/agent-notes/DECISIONS.md` | **只追加**，含「什么会推翻它」 |
| 工作板 | `docs/agent-notes/BOARD.md` | 易变，自由重写 |

`AGENTS.md` 的加载预算在本预设中从默认 65536 提升到 **196608 字节**；工具结果修剪阈值同步放宽（12288/6144/2048），因为专家报告与挂载验证输出是本预设的长结果。

### 3. 专家团队

四位具名专家，每一位是一条独立的 `@deepseek-ai/dsh-tool-subagent` 行——spawn 提供者声明了 `persona`、`toolFilter`、`depthLimit`、`agentOptions` 能力，所以「角色」就是给某一行一个角色的 persona 和推理预算。

| 工具 | 职责 | 推理预算 | 写权限 | 输出契约 |
| --- | --- | --- | --- | --- |
| `expert_architect` | 架构与设计 | `max` | 有 | 决策 / 边界 / 取舍 / 风险 / 验收 |
| `expert_verifier` | 对抗式验证 | `max` | **无** | 结论 / 发现 / 未被攻破 / 空白 |
| `expert_protocol` | 协议、生态、版本 | 默认 | 无 | 答案 / 证据 / 冲突 / 未知 |
| `expert_chronicler` | 记忆维护 | 默认 | 仅记忆层 | 已记录 / 已确立 / 未决 |

`expert_verifier` 通过工具过滤被摘掉 `write` 与 `edit`：**看不见，且强制执行也会被拒**。审查无法悄悄变成重写，这是该行存在的全部意义。

四者默认后台运行（`backgroundMode: continuable`），因此一条消息可以并行启动全部专家；`subagent` 行的 `maxDepth: 2` 把递归界定为「主智能体 → 专家 → 专家的助手」。

### 4. 随行技能

| 技能 | 作用 |
| --- | --- |
| `editing-cordis-compositions` | 组合创作与两个平面的判据（随出厂 `cordis` 预设分发） |
| `cordis-plugin-development` | 动态 Cordis 插件开发（随出厂 `cordis` 预设分发） |
| `dsh-runtime-reference` | **本部署的**路径、按平面分组的行清单、实时服务与提示段落名、挂载诊断 |
| `dsh-expert-team` | 团队名册、交接契约、如何组合一个新角色 |
| `dsh-memory-chronicle` | 四层记忆布局、条目格式、维护规则 |

## 一个值得知道的挂载约束

`tool-cordis` 把自己的 Host inspect 提供者注册进 `cordisInspect`，而该注册表**按 provider id 去重且不幂等**——所以同一个进程里不能有两个含 `tool-cordis` 的组合同时存活。出厂的 `cordis` 预设正是这样一个组合。

因此本预设把该行写成自条件加载：

```yaml
- id: tool-cordis
  name: '@deepseek-ai/dsh-tool-cordis'
  disabled: !!js ctx.get('cordisInspect') !== void 0
```

- 注册表不存在 → 本行加载并注册，会话拿到完整 Cordis 工具集；
- 注册表已存在 → 提供者（以及工具）已在进程内，本行自禁用，而不是让挂载失败。

用 `ctx.get()` 而不是 `ctx.cordisInspect`：`!!js` 门在 Loader 上下文求值，Cordis guard 会拒绝未经声明的属性访问。这是实测结论，不是推断。

## 验证状态

本组合经过真实挂载验证，而非仅阅读确认：

- `agentPresets.standingKeyFor('dsh-smith')` **挂载通过** —— 无未激活行，无泄漏到根 realm 的服务；
- `compositionInventory()` 报告 **33 行全部组合，32 行 `ACTIVE`**；
- 恰好 4 行按设计关闭：`tool-bash`（Windows 平台门）、`tool-cordis`（条件门）、`tool-subagent-codex` 与 `tool-subagent-claude-code`（未安装的可选产品提供者）；
- 四条专家行 `tool-expert-architect / verifier / protocol / chronicler` 全部 `ACTIVE`。

**未经端到端验证的部分**：专家工具在模型侧的最终工具名，以及子代理创建路径。这两点由以下事实推导成立——行配置已通过 schema 校验、spawn 提供者的能力标志已从包内类型声明核实、且「多行 `tool-subagent` 各自 `toolName`」这一模式在出厂 `standard` 预设中已用于 `subagent` + `subagent_fork`。首次使用时请确认工具列表里出现上述四个名字。

## 兼容性

针对 DeepSeek Harness **0.1.5-rc.1** 的行名与配置面编写。行名、服务键与配置字段属于部署内部接口，升级后可能移动；升级后请重新运行 `node bin/verify.mjs`。

## 许可与来源

MIT。见 [LICENSE](LICENSE)。

`dsh-smith/skills/` 下的 `editing-cordis-compositions` 与 `cordis-plugin-development` 两个技能复制自 DeepSeek Harness 官方发行包 `@deepseek-ai/dsh-agent-presets` 的 `cordis` 预设，遵循其 MIT 许可，版权归 DeepSeek 所有；其余内容为本仓库原创。
