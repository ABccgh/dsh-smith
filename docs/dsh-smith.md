# DSH 智能体工坊 · DSH Agent Smith

专门用于**开发 DSH 智能体与 Cordis 插件**的 DeepSeek Harness agent preset：组合设计思考协议、四层记忆纪律、四位具名专家的常驻团队。

> An agent preset for the DeepSeek Harness, specialized in building harness agents and Cordis plugins.

| | |
| --- | --- |
| 预设 id | `dsh-smith` |
| 显示名 | DSH 智能体工坊 |
| 安装路径 | `${DSH_HOME:-$HOME/.dsh}/.agent-presets/dsh-smith/` |
| 血统 | 出厂 `cordis` 预设（＝ `standard` ＋ 自省工具集） |
| 组合行数 | **36 行具名** = 3 个 group 容器（`thinking` `:284`、`compaction` `:328`、`team` `:394`）＋ 33 行叶子 |
| 安装副本校验 | 与仓库文件逐字节一致（编辑后必须重跑 `install.mjs`） |

## 它是什么

DeepSeek Harness（DSH）里没有独立的配置语言：**每一项能力都是 `cordis.yml` 里的一个插件行**，而一个 agent preset 就是为单个会话挂载的这样一份文件。

本预设从出厂 `cordis` 预设复制而来，因此天然可挂载，然后围绕三件事重建：

| 目标 | 实现 |
| --- | --- |
| 专门开发 DSH 智能体与插件 | 组合设计协议（计划模式改造）＋ 两个创作技能（复制自上游）＋ 本部署的运行时速查技能 |
| 强化思考 | 组合设计规划协议 ＋ 两位专家 `reasoningEffort: max` ＋ 人格前缀的五步推理序 |
| 加强记忆 | 四层记忆契约 ＋ `AGENTS.md` 加载预算 196608 字节（宿主默认 65536）＋ 常驻记忆专家 |
| 专业专家团队 | 四条独立 `tool-subagent` 行，各自 persona、推理预算与工具过滤 |

## 组成

### 1. 思维协议

计划模式被替换为**组合设计协议**，要求按固定顺序作答：目标生命周期与平面 → 行清单（精确包名 / id / 变化的配置键）→ 服务归属（哪些服务发布、哪个 realm 持有、哪些消费者必须同处一个 realm）→ 证据 → 失败模式 → 验证（可观测结果，而不是「没报错」）。

### 2. 记忆纪律

四层：`AGENTS.md`（自动加载的持久规则）、`docs/agent-notes/PROJECT.md`（就地编辑的编年）、`DECISIONS.md`（**只追加**）、`BOARD.md`（易变的工作板）。`agent-instructions` 行把加载预算提到 **196608 字节**，单文件上限 **49152 字节**——超过上限的文件是**被整个忽略**而不是被截断，所以长文件要拆不要长。

### 3. 专家团队

| 工具 | 角色 | 推理预算 | 可写 | 何时叫 |
| --- | --- | --- | --- | --- |
| `expert_architect` | 架构与设计 | `max` | 是 | 分解、边界、归属、接口 |
| `expert_verifier` | 对抗式验证 | `max` | **否**（`deny: [write, edit]`） | 在信任一个 diff 或断言之前 |
| `expert_protocol` | 平台与生态 | 继承主 agent | 是 | 版本、库契约、产品实际行为 |
| `expert_chronicler` | 编年与记忆 | 继承主 agent | 是（按指令只写记忆层） | 决定落定或里程碑完成之后 |

外加 `subagent`（通用工人）与 `subagent_fork`（需要这段对话历史的任务）。

**递归上界是数出来的。** `resolveChildDepth` 只在 `childDepth > maxDepth` 时拒绝，顶层 agent 的 `delegationDepth` 是 **0**，所以层级是 0、1、2。**六条委派行全部显式写出 `maxDepth: 2`**（`subagent` `:414`、`subagent_fork` `:435`、四条专家行 `:445`/`:484`/`:554`/`:586`）；漏写会取 schema 默认值 **3**——不是「继承兄弟行」。可达链是 `lead(0) → expert(1) → helper(2)`。

### 4. 随行技能（5 个）

| 技能 | 作用 | 来源 |
| --- | --- | --- |
| `editing-cordis-compositions` | 组合创作与两个平面的判据 | 复制自出厂 `cordis` 预设（MIT） |
| `cordis-plugin-development` | 动态 Cordis 插件开发 | 复制自出厂 `cordis` 预设（MIT） |
| `dsh-runtime-reference` | 本部署的路径、按平面分组的行清单、实时服务与提示段落名 | 本仓库原创 |
| `dsh-expert-team` | 团队名册、交接契约、如何组合一个新角色 | 本仓库原创 |
| `dsh-memory-chronicle` | 四层记忆布局、条目格式、维护规则 | 本仓库原创 |

前两个是**照抄未改的上游文件**，正文里提到 `cordis_mount` / `cordis_unmount`——**本部署没有 `cordis_mount` 这个工具**，实际是 `cordis_define` / `cordis_run` / `cordis_stop` / `cordis_undefine`。我没有删改正文（那会让与上游的差分失效），而是在各自开头加了**更正横幅**，并写明「与 `cordis_inspect_list` 冲突时以它为准」。这两个技能教的**方法依然正确**——复制预设、改副本、挂载验证、绝不碰出厂安装——变的只是工具名。

## 已知限制

### `tool-cordis`：门为什么在，以及它带来的后果

**两个注册面，作用域完全不同——这是理解一切的前提。** `dsh-tool-cordis` 的 `apply(ctx)` 做三类事：

| 注册什么 | 用什么 | 作用域 |
| --- | --- | --- |
| 一个提示段落 `tool:cordis` | `ctx.systemPrompt.section` | 挂载它的会话 |
| **四个** Host inspect provider（`Service`、`Event`、`Builtin`、`Tool`） | `ctx.effect(() => ctx.cordisInspect.register(...))` | **进程全局** |
| **七个** 工具（`cordis_inspect_list` / `_query` / `_self` / `define` / `run` / `stop` / `undefine`） | `ctx.tools.register` | 挂载它的会话 |

计数是实测的：该文件里 `ctx.cordisInspect.register` 出现一次（在一层 `hostInspectProviders` 循环里迭代四次），`ctx.tools.register(` 出现 **7** 次。

**只有那四个 provider 是进程全局的；七个工具不是。** 工具按 agent scope 注册，所以一个组合关掉这一行，**它的**会话就没有 `cordis_*`——不管同进程里别的组合注册过什么。

那四个 provider 注册进 `cordisInspect`，而该注册表的 provider map **按 id 去重且直接 throw**，所以一个进程里第二个含 `tool-cordis` 的组合会**整体挂载失败**。因此 `dsh-smith` 给这一行加了门：

```yaml
- id: tool-cordis
  name: '@deepseek-ai/dsh-tool-cordis'
  disabled: !!js ctx.get('cordisInspect') !== void 0
```

`ctx.get('cordisInspect')` 问的是「**注册表是否存在**」，不是「有没有东西注册进去」。该注册表由 `DynamicCordisRunnerService` 的**构造函数**创建，挂在一个无条件、永不释放的 host 行下面——这是**生命周期事实，不是挂载顺序事实**，重启不会改变它。所以 **`dsh-smith` 会话永远没有 `cordis_*` 工具**。

**这不是本部署的普遍现象。** 实测的 live Loader 状态：

| 预设 | `tool-cordis` 行 | `cordis_*` 工具 |
| --- | --- | --- |
| 出厂 `cordis` | `enabled=true`，`fiberPhase=active` | **有** — 要跑挂载检查/插件开发就用它 |
| `dsh-smith` | `enabled=false`（上式门） | 无 |
| `dsh-forge` | 不含该行 | 无 |

在会话里试一次 `cordis_inspect_list`：它回答了，你不在这种情况；提示工具不存在，就是要换出厂 **「创造模式」** 预设的会话来写 Cordis 插件。

**真正的修法不在这个仓库里**，需要上游两件事：让 `CordisInspectRegistryService.register()` 对已注册的 provider id 幂等；以及让一个**只想要工具**的组合能消费既有 provider 而不重新注册它们。第二件才是缺的那一半——现在的 `apply` 同时注册 provider 与七个工具，所以「跳过 apply 以避免冲突」会把工具一起跳过。YAML 表达不了这件事，这是本仓库已知的天花板。provider 的生命周期应当是「首个注册者拥有，进程内不释放」，**不要用引用计数**（D-13）。

### 信任边界：这不是沙箱

`cordis_define` + `cordis_run` 会把**模型写的 JavaScript 直接对着实时运行时求值**，而这样定义出来的 Package 会被激活、并被 agent 写进别的会话将挂载的 preset。所以本预设的会话应当按**等同于 shell 访问**来对待。

`!!js` 门、`isolate` realm、以及所有「平面」规则管的是**归属**，不是**权限**——它们防止配置错误，不防止恶意。请只在你愿意让模型改这台机器的环境上使用它。

### 刻意排除的能力（不是缺陷）

- **`@deepseek-ai/dsh-mcp-client`** —— 已安装，但基础组合与 web-app 组合都没挂载它。MCP 支持是一条独立的信任面（外部进程、它自己的凭据与工具面），本预设不替使用者打开。需要就在 profile 补丁层自行加行。
- **`@deepseek-ai/dsh-tool-subagent-report`** —— 结构化子代理报告。**这个包在本部署里是坏链**：`node_modules` 下的目录指向安装缓存中不存在目标，看起来装了、其实导不进来。所以它不能作为依赖；判断包是否存在必须查**内容**而不是查名字。

## 验证状态

**按字面读。** 本仓库区分「已验证」「只做了静态检查」「未验证」，而**唯一算数的挂载检查需要出厂 `cordis` 预设的会话**——原因见上一节与根目录 `README.md`。

### 已验证

| 项目 | 结果 | 依据 |
| --- | --- | --- |
| 挂载 | **通过** —— 无未激活行、无泄漏到根 realm 的服务 | `agentPresets.standingKeyFor('dsh-smith')`，同进程内多次复验 |
| 组合清单 | **36 行全部组合，29 行 `ACTIVE`** | `compositionInventory()` |
| 按设计关闭的行 | 恰好 4 行：`tool-bash`（Windows 平台门）、`tool-cordis`（上式门）、`tool-subagent-codex` 与 `tool-subagent-claude-code` | 同上 |
| 去掉 `tool-cordis` 的门会整体挂载失败 | **是** —— 做过的对照实验，不是推断 | 同上 |
| 四条专家工具到达模型工具表 | **是** —— 且 `subagent_codex` / `subagent_claude_code` 恰好缺席 | 真实会话的工具 schema |
| 四个人格按契约输出 | **4 / 4** —— `architect` 五段、`chronicler` 三段、`verifier` 四段、`protocol` 四段，逐块与 persona 文本一致 | 四次真实调用，比对**终稿** |
| `write` / `edit` 过滤被强制 | **是** —— 子代理 `TOOLS` 里没有这两个名字；强制调用返回 `Error: unknown tool "write"`；探针路径 `Test-Path` 为 false | 一次 `expert_verifier` 委托 |
| 排除替代解释 | **是** —— 同深度、同 provider、同 `applyChildComposition` 路径但不带 `toolFilter` 的对照子代理**保留**了这两个工具，而 `pwsh`（该行注释明写故意不 deny）在两者中都存活 | 同上 |
| 提示词段落预算 | **有效** —— `agent-instructions` 行对 `dsh-smith` scope 生效 | 挂载后的行为 |

### 未验证，且不声称

- **`restrict()` 本身**（而非其它有同样可观测效果的机制）造成了拒绝——D-17 记了这一点。
- **`toolFilter` 遇到未知名字是否 fail-loud**、与 `allow` 如何组合——未测。
- **冷进程**里挂载是否同样干净——推断（`!!js` 门读 `platform` 与 `cordisInspect`，冷进程同值），未实测。

## 兼容性

针对 DeepSeek Harness **0.1.5-rc.1** 的行名与配置面编写。行名、服务键与配置字段属于部署内部接口，升级后可能移动。

**本 preset 派生自出厂 `cordis` 预设，会随上游升级漂移。** 升级后重跑：

```sh
node bin/drift-check.mjs --preset dsh-smith   # 与出厂 cordis 逐行比对（只报告，不同步）
node bin/preflight.mjs  --preset dsh-smith    # 行是否还解析得动、配置面是否还合法
node bin/lint-skills.mjs --preset dsh-smith   # 五个技能是否仍完整
```

`drift-check` **只报告，不自动同步**——本预设刻意改写了它继承的多行（人格、指令预算、修剪阈值、`maxDepth`、`tool-cordis` 的门），一个「体贴地」帮你同步的工具会把这份副本的意义整个抹掉。

一个边界：**它只比对两份文件都有的行**。本预设独有的行（`thinking` / `team` 两个 group 与四条专家行）不在比对范围内，所以那四条专家行上的 `maxDepth: 2` 在这里**不会**出现——要检查递归统一性，直接按行审计更可靠。

## 许可与来源

MIT。见 [LICENSE](../LICENSE)。

`dsh-smith/skills/` 下的 `editing-cordis-compositions` 与 `cordis-plugin-development` 复制自 DeepSeek Harness 官方发行包 `@deepseek-ai/dsh-agent-presets` 的 `cordis` 预设，遵循其 MIT 许可，版权归 DeepSeek 所有；其余内容为本仓库原创。
