# DSH 研发工坊 · DSH Forge

专门用于**软件开发**的 DeepSeek Harness agent preset：软件工程计划协议与 PTC 组合推理、四层项目记忆纪律与常驻记忆专家、五位具名专家的固定团队。

> A DeepSeek Harness agent preset for software delivery: a software-engineering planning protocol, PTC code-mode reasoning, a layered project-memory discipline, and a standing team of five named experts.

| | |
| --- | --- |
| 预设 id | `dsh-forge` |
| 显示名 | DSH 研发工坊 · DSH Forge |
| 安装路径 | `${DSH_HOME:-$HOME/.dsh}/.agent-presets/dsh-forge/` |
| 血统 | 出厂 `standard` 预设 ＋ 本文件的三大支柱（**不是**从 `dsh-smith` 派生） |
| 组合行数 | 文件侧 **38 行具名** = 3 个 group 容器 ＋ **35 行叶子**；清单按叶子报 35（两者一致）。其中 **31 行激活**、2 行 `conditional`、2 行关闭。见「验证状态」的逐行口径 |
| 宿主依赖 | `dsh-web-app` bundle 的 `code-runtime`（`@deepseek-ai/dsh-code-runtime-worker-thread`） |

## 与 `dsh-smith` 的分工

同一个仓库里两个预设，定位不同，互不覆盖：

| | `dsh-smith` | `dsh-forge` |
| --- | --- | --- |
| 做什么 | 造 DSH 智能体、写 Cordis 插件 | 交付软件：写、改、测、调、审 |
| 专家角色 | 架构 / 验证 / 平台 / 编年 | 架构 / 验证 / **调试** / 平台 / 编年 |
| 计划协议 | 组合设计（平面 / realm / 行清单） | 软件工程（改动面 / 接口 / 边界 / 验收） |
| 工具呈现 | 原生工具表 | `both`：原生工具表 ＋ `run_code` 的 TypeScript SDK |
| 自省工具 | `tool-cordis` 行（本部署下恒关） | 不含该行 |
| 记忆层 | `AGENTS.md` ＋ `docs/agent-notes/` 三层 | 同上，另加 `RUNBOOK.md`（命令层） |

## 安装与使用

```sh
cd dsh-smith
node bin/install.mjs --preset dsh-forge
```

或在模式选择器里选 **「DSH 研发工坊 · DSH Forge」**。

> **没有命令行开关可以选预设。** 预设是**会话启动时由选择器**挂载的：`dsh` 的选项族是 `--profile` / `--from-default-profile` / `--patch` / `--dump-config` / `--dump-default-config`，`dsh web` 的是 `--host` / `--no-open` / `--port` / `--trusted-host`，`@deepseek-ai/**` 里**没有任何包**含 `--agent-preset` 这个字符串。装完请**新开一个会话**并在选择器里选它。

`--preset` 省略时默认仍是 `dsh-smith`，所以既有的调用方式含义不变。`--force` 是**真正的替换**（先删再拷），这是旧版本删掉的技能不会留在磁盘上继续被加载的唯一保证。

> ### ⚠️ 必须开一个**新会话**
>
> preset 在**会话启动时**挂载，已经开着的会话不会获得它。装完请新开一个会话。

## 三大支柱

### 1. 思考

| 手段 | 配置 | 依据 |
| --- | --- | --- |
| PTC 呈现 | `tool-presentation` 行：`mode: both` | 一个 `run_code` 程序可以把「搜索 → 读 → 改 → 跑测试」串成**一步**内的链条，而不是每跳一次工具往返 |
| 计划协议 | `plan-mode` 的 `section` 换成软件工程六段 | 需求与验收 → 改动面（逐文件、引路径与行号）→ 接口与数据 → 边界与失败路径 → 验证（可观测结果）→ 假设与未选方案 |
| 专家推理预算 | 架构 / 验证 / 调试三行 `reasoningEffort: max` | 这三类错误发现得越晚越贵 |
| 卡死循环可见 | `repeat-tool-reminder`：`thresholds: [3,6,10]`、`argumentsPreviewChars: 2000` | 计划让好的方案成为可能，这个让**坏的循环**变得可见 |

**为什么是 `both` 而不是 `ptc`** —— 这是读实现读出来的，不是偏好。`dsh-tools/lib/index.js:2993-2995`：

```js
collapses(name, scope, nested) {
    return !nested && this.modeFor(scope) === "ptc" && name !== "run_code";
}
```

在 `ptc` 下，**模型直接调用**只允许 `run_code` 一个名字，`wireSchemas` 把请求收敛到只发 `run_code`（同文件 `:2735-2738`）。于是 `exit_plan_mode`、`ask_user_question`、`present` 只能经 SDK 间接调用。它们**确实能工作**——SDK 的 binding 会转发调用方身份（`:1207-1220` 传播 `agent` / `parent` / `signal`），而 `exit_plan_mode` 要的正是 `exec.agent`（`dsh-plan-mode/lib/index.js:252-255`）——但那是**可靠性选择**而非正确性选择：`both` 既保留 `run_code`，也保住那几个「价值就在于被直接、无歧义地调用」的工具。

### 2. 记忆

四层契约写进人格后缀，命令层单独成层：

| 层 | 文件 | 生命周期 |
| --- | --- | --- |
| 指令 | `AGENTS.md`（按目录） | 持久，自动加载；本预设预算 **196608 字节**（宿主默认 65536） |
| 命令 | `docs/agent-notes/RUNBOOK.md` | 持久，就地编辑；构建 / 测试 / 跑 / 重置，一行一条 |
| 编年 | `docs/agent-notes/PROJECT.md` | 持久，就地编辑；已证实的事实，每行带来源 |
| 决策 | `docs/agent-notes/DECISIONS.md` | **只追加**；一条一决定，含被否方案与推翻条件 |
| 工作板 | `docs/agent-notes/BOARD.md` | 易变，随意重写 |

`RUNBOOK.md` 是相对 `dsh-smith` 的**唯一新增层**，理由是纯软件的重复成本主要落在命令上：每轮开工都要重新找「测试怎么跑」比重新找架构结论更频繁，也更便宜就能写下。触发规则是同一个：**第二次查同一条命令时就写下来**。

还有一层不在文件里：**会话目标**。`command-goal` / `tool-goal` 两行让一个长迁移或大特性跨回合存活，因为目标存在会话日志里，而不是存在上下文里。

### 3. 专家团队

五个角色，每个是独立的 `tool-subagent` 行，各自 persona、推理预算与工具过滤：

| 工具 | 角色 | 推理预算 | 可写 | 什么时候叫 |
| --- | --- | --- | --- | --- |
| `expert_architect` | 架构与设计 | `max` | 是 | 分解、边界、归属、接口；错得晚就很贵的决定 |
| `expert_verifier` | 对抗式验证 | `max` | **否**（`deny: [write, edit]`） | 在信任一个 diff、一个断言或一份计划之前 |
| `expert_debugger` | 调试与根因 | `max` | **否**（`deny: [write, edit]`） | 从读到的代码解释不了的失败 |
| `expert_protocol` | 平台与生态 | 继承主 agent | 是 | 版本、库契约、API、产品实际行为 |
| `expert_chronicler` | 编年与记忆 | 继承主 agent | 是（按指令只写记忆层） | 决定落定或里程碑完成之后 |

外加 `subagent`（通用工人）与 `subagent_fork`（需要这段对话历史的任务）。

**`deny: [write, edit]` 是什么、不是什么。** 它把这两个工具从子代理的可见集合里移除，并让强制调用失败——这部分是强制的（在 `dsh-smith` 上实测过，见该仓库 README）。它**不是**沙箱边界：子代理保留 `pwsh`，而 shell 能写文件。它是**设计信号**，两个人的 persona 都明说了这一点，而不是承诺一个这一行给不出的沙箱。也**故意不 deny `pwsh`**——复现缺陷是最强的证据，一个不能跑任何东西的验证者只是校对员。

**递归上界是数出来的，不是描述出来的。** `resolveChildDepth` 算 `childDepth = parent 的 delegationDepth + 1`，只在 `childDepth > maxDepth` 时拒绝。顶层 agent 的头部是 `delegationDepth: 0`，所以层级是 0、1、2……**不是** 1、2、3。因此**七条启用的委派行全部显式写出 `maxDepth: 2`**：`tool-subagent`、`tool-subagent-fork`、五条专家行（另有两条 `disabled: true` 的产品行写的是 `provider-managed`）。漏写会取 schema 默认值 **3**（不是"继承兄弟行"），那样专家子树会比主 agent 自己的工具多一层。

**推理预算怎么生效。** `resolveChildAgentOptions` 把父级的路由、模型、effort、maxTokens 作为起点，再用该行的 `agentOptions` 覆盖；**命名了 `reasoningEffort` 就压制了**「换路由即丢弃 effort」那条删除规则。所以三个 `max` 是**钉死的**，你在 GUI 里换模型它们不变；另两个角色不写，就是继承主 agent 当前路由的 effort。

## 行清单

38 行具名，按缩进数出来是：**20 行顶层**（其中 17 行是普通插件行、3 行是 group 容器）＋ **3 个 group 内的 18 行**。下面的表按职责分组，不是按缩进分组：

| 顶层 | 内容 |
| --- | --- |
| `persona` | 人格前缀（身份、证据纪律、工作环、计划、团队）与后缀（思考 / 记忆 / 团队 / 不制造事实 四段协议） |
| `agent-instructions` | `maxBytes: 196608`、`maxSourceBytes: 49152` |
| `tool-*` | bash / pwsh / fs / fs-search / jobs / goal / skill / todo / web / ralph / workflow / subagent 家族 / ask-user / present |
| `repeat-tool-reminder`、`tool-presentation` | 见「思考」一节 |

| group | realm（`isolate`） | 行 |
| --- | --- | --- |
| `thinking` | `planMode` | `plan-mode` |
| `compaction` | `compaction`、`toolResultPruner` | `compaction-basic`、`command-compact`、`tool-result-pruner` |
| `team` | `workflowEngine` | `tool-subagent-control`、`tool-subagent-list-agents`、`tool-subagent`、`tool-subagent-fork`、五条专家行、codex / claude-code 两行（`disabled`）、`workflow-worker-thread`、`tool-workflow`、`tool-ralph` |

**realm 规则**：宿主已提供的服务（`tools`、`systemPrompt`、`skills`、`subagents`、`jobs`、`goals`、`fs`、`shell`、`codeRuntime`、`tokenMeter`）**一律从宿主消费，不进任何 realm**；只有预设自己拥有、且 agent 之外无人读的服务才进 realm。`compaction-basic` 通过 `ctx.get` 读 `toolResultPruner`，所以那一对**必须同 realm**——消费者留在 realm 外会解析到宿主注册表，而宿主没有，于是「挂载成功但压缩静默不生效」。

**刻意排除的能力（不是缺陷）**：

- **`@deepseek-ai/dsh-tool-pwsh-persistent` / `-bash-persistent`**：它们 inject `["tools","terminals"]`，而本部署**没有任何 bundle 组合 `dsh-terminal`**——唯一注册后端的包 `dsh-terminal-bash` 在 `dsh-base` 与 `dsh-web-app` 两份 patch 里都没有行。把这个工具行加进来会留下一个永远等待 `terminals` 的行并让挂载失败。**持久 shell 是 host 平面的改动，不是 preset 的。**
- **`@deepseek-ai/dsh-tool-str-replace-editor`**：`read` / `write` / `edit` 已经覆盖查看与编辑，第四种改文件的方式只是让模型在每次编辑时多做一个必须做对的选择。
- **`@deepseek-ai/dsh-tool-cordis`**：`dsh-forge` 是软件开发 agent，不是 harness 制造机；而且在本部署下这一行恒关，加进来就是一行永远不激活的死行。**所以 `dsh-forge` 会话里 `cordis_*` 工具一个都没有，这是设计意图，不是缺失**——要开发 Cordis 插件请用 `dsh-smith`，或者改用出厂「创造模式」预设。

## 验证状态

**这一节区分「已验证」「只做了静态检查」和「未验证」，请按字面读。** 截至本次测量，**三项真会话核查全部关闭**；本节剩下的“未验证”只有两条边界，都写在「界限」一节里：冷进程挂载未实测，以及 `expert_verifier` 是**由配置对等推出**而非单独委派。

### 已完成的检查

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| **挂载（唯一算数的检查）** | 出厂 `cordis` 会话里的动态插件探针调 `agentPresets.standingKeyFor('dsh-forge')` | **`MOUNTED OK`** —— 详见表下的说明与逐行清单 |
| 技能 frontmatter | `node bin/lint-skills.mjs --preset dsh-forge` | 4 个技能全部 `ok`，`all 4 skill(s) lint clean`，退出码 0 |
| 安装 | `node bin/install.mjs --preset dsh-forge` | 成功路径打印 `installed: C:\Users\曦曦\.dsh\.agent-presets\dsh-forge`、`contents: agent.cordis.yml, preset.yml, skills`，退出码 0。重复执行时会按设计拒绝覆盖（`already exists — refusing to overwrite`，退出码 1）——注意 `target:` 与 `found:` 两行**两条路径都会打印**，所以它们**不能**用来证明安装完成 |
| 静态预检 | `node bin/preflight.mjs --preset dsh-forge` | **38 行全部解析，24 行用自己的 schema 验证通过，10 行跳过，0 行失败** |
| 预检的否证对照 | 故意植入 `mode: nope` 与不存在的包名 | 分别报 `$.mode expected "native" \| "ptc" \| "both" but got "nope"` 与 `package does not resolve`，退出码 1 —— **这个检查会失败** |
| 回归 | 不传 `--preset` 跑四个脚本 | `dsh-smith` 行为与改动前逐字一致（5 技能 lint clean；drift 报 36/32 行、6 行偏离；install 拒绝覆盖） |

### 挂载结果：`MOUNTED OK`

**这条检查跑过了，通过。** 跑法是**动态插件探针**，在一个出厂「创造模式」(`cordis`) 预设的会话里：那个预设的 `tool-cordis` 行是 `enabled=true`，所以 `cordis_*` 齐全，而探针需要的正是它们。

```
preset_probe(id="dsh-forge")
→ MOUNTED OK: standingKeyFor(dsh-forge) resolved a standing scope key
```

**逐行清单（`MOUNTED OK` 之外唯一的数字，已逐行核对）。** 先把计数口径钉死，因为之前两个数字都是错的：`flattenRows()`（文件侧，`dsh-agent-presets/lib/index.js:991`）与 `mountedCompositionRows()`（挂载侧，同文件 `:1038`）**都跳过 group 容器**，只报叶子行。所以 **38 行具名 = 3 个 group 容器 ＋ 35 行叶子**，清单报 35 —— 与我文件侧独立复现的 35 **完全一致**。在这 35 行里：

| 状态 | 行数 | 行 |
| --- | --- | --- |
| `enabled: true` | **31** | 其余全部 |
| `enabled: "conditional"` | 2 | `tool-bash`（`process.platform === 'win32'`）、`tool-pwsh`（`process.platform !== 'win32'`）—— Windows 上后者关、前者开，恰好一行在跑 |
| `enabled: false` | 2 | `tool-subagent-codex`、`tool-subagent-claude-code`（未安装的可选产品提供者） |

**所以「35 行 active」这个说法是错的**：35 是**清单总行数**，不是激活数。激活是 **31**。之前我记的「34 启用」也错——那是我从「38 具名 − 4 disabled」算出来的，而 38 里含 3 个不参与清单的 group 容器。正确的算式只有一条：**35 叶子 − 4 关闭 = 31 激活**（其中 `!!js` 门在 Windows 上关掉 `tool-bash`；`tool-pwsh` 开着）。

**这份清单回答的正是静态检查看不见的那一类**：35 行全部有 fiber，没有一行是「挂上了但什么都没贡献」。`dsh-forge` 不含 `tool-cordis`，所以它连那个候选都没有。`compaction` 组里 `toolResultPruner` 提供者与 `compaction-basic` 消费者的配对、以及 `tool-presentation` 等宿主 `codeRuntime` 这两处，也随整个子树一起激活——任一处若是「等待服务」，清单里出现的就会是未激活行。

> **一处仍未实测的边界**：上面这次是在**当前进程**里跑的。「另一个新进程里挂载是否同样干净」是**推断**（两道 `!!js` 门读 `process.platform` 与 `cordisInspect`，冷进程里同值），不是实测——没有另起 harness 进程，因为那会再起一台服务器。

### 界限：哪些东西证明不了什么

**~~探针之外的运行时行为仍未验证~~ —— 已实测关闭**：`run_code` 与 `tools:sdk` 段落确实到达模型，**带强制过滤的两个角色**（`expert_verifier`、`expert_debugger`）的 `deny: [write, edit]` 在 PTC 下成立。见下面的「三项的实测结果」。保留这一行是为了记住**它曾经为什么是空白**：挂载清单说行激活了，`preflight.mjs` 说配置合法，两者都没有向模型发过一个请求。

**再说清一件容易搞混的事：`node bin/verify.mjs` 不是那条挂载检查，而且换会话救不了它。**

| 路径 | 需要什么 | 在 `dsh-forge` / `dsh-smith` 会话 | 在出厂 `cordis` 会话 |
| --- | --- | --- | --- |
| 动态插件探针（`cordis_*` → `agentPresets`） | `tool-cordis` 行注册的 `cordis_*` 工具 | **不可用**（`dsh-forge` 没有该行，`dsh-smith` 把该行关掉） | **可用** —— 上面这次就是在这里跑的 |
| `node bin/verify.mjs` | 无——它自己起裸运行时 | 不可用 | **同样不可用** |

第二行是**脚本结构问题，不是会话问题**：`bin/verify.mjs` 自己 `new cordis.Context()` 起一个**裸 Cordis 运行时**，按定义不含 harness 注册表，所以 `agentPresets` 永远缺席，它**从任何会话都会打印 `INCONCLUSIVE`**。这一点实测了两次、输出逐字相同：一次在普通 shell，一次就在那个 `tool-cordis` 已激活的出厂 `cordis` 会话里。脚本头注释已按实测改正，不再暗示「换个会话就能跑通」。

> **`bin/preflight.mjs` PASSED 不等于能挂载。** 它看不到的恰好是最要命的三类：**激活了但什么都没贡献的行**（消费者与提供者不在同一 realm）、**泄漏到根 realm 的服务**、以及**写在 `apply()` 而不是 schema 里的校验**（例：`repeat-tool-reminder` 的 `thresholds: [1]` 能过 schema，却在 load 时从 `apply` 抛错）。另外它**不拒绝未知配置键**——schemastery 对多余的键不报错（实测：合法 `mode` 旁边多一个 `bogus: 1` 验证干净），所以把键名敲错但必需字段仍在的情况，它看不见。

那 10 行「跳过」要逐类说清，因为**跳过不等于通过**。按实测的输出分类，10 = 3 ＋ 1 ＋ 1 ＋ 5：

- **3 个 group 行**：`thinking` / `compaction` / `team`，本身没有包，只作容器；
- **1 行用命名空间子路径**的包：`tool-subagent-list-agents`（`@deepseek-ai/dsh-tool-subagent-control/list-agents`）；
- **1 行 config 里含未求值的 `!!js` 表达式**：`skill-filesystem` → `customSkillDirs[0]`。**这一行最值得点名，因为它的配置根本没被验证过**——脚本不会去求值一个表达式；
- **5 行不导出可用 `Config` schema 的包**：`command-goal`、`plan-mode`、`command-compact`、`tool-subagent-control`、`tool-ask-user`——它们的配置面写在 `apply()` 里，正是上一条说的盲区。

（易错点：`tool-subagent-control` 本身和它的 `list-agents` 子路径是**两个不同的 skip**，前者算「无 schema」，后者算「子路径」，合计 2，不是 1。）

### 三项核查清单（已全部实测关闭）

**下面三条原本是「需要你在真会话里确认」的清单，现在都已实测关闭**——测量条件与逐条读数见本节末尾的实测表。清单保留原样，因为它是那三项测量的判据来源；每一行末尾注明实测结论。

1. **工具真的到了模型面前。** 新会话里看工具表：`expert_architect`、`expert_verifier`、`expert_debugger`、`expert_protocol`、`expert_chronicler`、`subagent`、`subagent_fork`、`workflow`、`job_list` 全部在；而 `subagent_codex` / `subagent_claude_code` **恰好缺席**（与那两行 `disabled: true` 一致）。
2. **PTC 生效。** 工具表里出现 `run_code`，且提示词里有 `tools:sdk` 生成的 TypeScript 接口段。注意 `run_code` **不会**出现在 `cordis_inspect_query → Tool.listTools` 的列表里，那**不是**缺陷：它是 PTC 的呈现传输，被保留禁止注册（`dsh-tools/lib/index.js:2780`），只在 schema 组装时才物化。

3. **带强制过滤的两个角色的过滤真的生效，且 `mode: both` 没有把它绕过去。** 组合里**只有两行**带 `toolFilter.deny: [write, edit]`——`tool-expert-verifier`（`:548`）与 `tool-expert-debugger`（`:629`）。其余三行（architect / protocol / chronicler）**没有强制过滤**，它们的只读是**指示**而非组合保证。委派一次 `expert_debugger`，读回它的 `TOOLS` 列表：应无 `write` / `edit`；**并且它的 SDK 段里也不应有这两个名字**。

> **实测结果比「会被拒绝」更强**：在 PTC 下这两个名字**连绑定都不存在**，`tools.write` 抛 `TypeError` 而不是被守卫拒绝——「原生表没有」与「SDK 段没有」是**同一个事实的两面**（两者都从 `view(scope).visible` 取数），不是两条独立证据。详见下面的实测表。

### 三项的实测结果

**测量条件：** 会话 `session-8b8072a6`，预设 `dsh-forge`；`~/.dsh/.agent-presets/dsh-forge/agent.cordis.yml` 与本仓库文件 **哈希一致**（`C8353AF1…A86A1`，即没有手改漂移）；`@deepseek-ai/*` 均为 `0.1.5-rc.1`。

| # | 判据 | 结果 | 观测方式 |
| --- | --- | --- | --- |
| 1 | 九条工具到达模型 | **全部在**，且 `subagent_codex` / `subagent_claude_code` 恰好缺席 | 本会话工具表 32 项。32 项与组合是**精确对应**：九条委派/编排行（`subagent` `:477`、`subagent_fork` `:497`、五条专家、`workflow` `:792`、`ralph` `:798`）＋ `list-agents` `:472` ＋ 其余模型面行。**README 的「九条」是核查清单的下限，不是穷尽清单**——`ralph`、`interrupt_agent`、`job_kill` 等同在 |
| 2 | `run_code` 到达模型、`tools:sdk` 段落真的生成 | **都成立，且 SDK 段是可用的** | `run_code` 在本会话实际执行；子代理在自己的上下文里 `await tools.glob(...)` **成功返回 15 条路径**，其提示词含以 `Program-only SDK bindings:` 开头的整段 `interface ToolArgsMap` / `ToolOutputMap` / `declare const tools`。被过滤的孩子同样收到 SDK 段，只是少了两个成员 |
| 3 | `deny: [write, edit]` 在 PTC 下仍成立 | **成立，且比「拒绝」更强：绑定根本不存在** | 见下 |

**第 3 条的三种独立读数。** 委派一次 `expert_debugger`（`:629-639`，`deny: [write, edit]`；与 `expert_verifier` `:548-558` 是**逐字对等的配置**，所以我测一条即可覆盖两行）：

1. **挂载表**：`propcount = 30`，`Object.keys` / `getOwnPropertyNames` / `getOwnPropertySymbols` 三条路径一致（`0` 个 symbol，原型为 `null`），`has_write=false`、`has_edit=false`、`has_ralph=true`。
2. **SDK 段**：`write` / `edit` 两个成员都不在；`pwsh` / `read` / `grep` 在。
3. **强制调用**：`tools.write` 与 `tools.edit` 抛 **`TypeError: tools.write is not a function`**（`instanceof ToolCallError === false`，即**根本没进工具层**）；同一次运行里 `tools.glob` 成功。事后 `Test-Path` 为 `False`，没有写出任何文件。

**⚠️ 这里要更正 D-17 的一处措辞。** D-17 记的是强制的 `write` 返回 `Error: unknown tool "write"`——那是**派发阶段**的拒绝（模型按原生 schema 直调一个不可见工具会走到 `resolveExecution` → `UNKNOWN_TOOL`）。PTC 下的实际情形**更早**：`sdkSchemas()`（`dsh-tools/lib/index.js:2922-2923`）从 `view(scope).visible` 渲染，被 deny 的名字**不进 SDK 对象**，所以 JS 在属性查找时就抛 `TypeError`，调度器从未被调用。两句都对，但「强制执行也会被拒」这个说法暗示了一道主动的守卫，而真实机制是**该绑定不存在**。设计信号因此落在呈现层，比「拒绝」更早也更彻底。

**差分对照（排除替代解释）。** 一个**同深度、同 spawn 提供者、同 `applyChildComposition` 路径、但不带 `toolFilter`** 的普通 `subagent`（该行 `:477-484` 确实没有 `toolFilter`）：32 项，`write`/`edit` 都在，`tools.edit` **被真实派发**到 code-runtime worker 并返回带 `toolName: "edit"` 的 `ToolCallError`（因未先读文件而失败——文件级原因，不是缺绑定）。机制读自安装包：`dsh-subagent/lib/index.js:554` 的 `childCtx.tools.restrict(composition.toolFilter)` → `ToolLayer.admits`（`dsh-tools/lib/index.js:2546`）→ `view(scope)`（`:2868` 的 `layers.every(...)`）→ `visible`；`schemas()` 与 `sdkSchemas()` 都从这一个 `visible` 取数，所以「原生表没有」与「SDK 段没有」是同一个事实的两面，不是两条独立证据。

**一条方法学提醒（本次踩到）。** 被过滤孩子的**第一份**报告把 `ralph` 写漏了（运行时的数组里有它，散文列表里没有），并把 `type ToolName` 引成了 `type ToolNames`。计数 30 一直是**对的**（30 = 32 − 2），错的是人工转录。所以：**子代理自报的列表要按原文核对，或者干脆让运行时 `console.log` 出数组**；本次是复核那一遍才把 `ralph` 找回来。另一处易误伤的探针：SDK 段里 `edit` 作为**子串**是存在的——`update_goal` 的 `action: "edit" | "pause" | …` 枚举值；**整段提示词里也有**（persona 自己写着 "`write` and `edit` are filtered out"）。所以对整段提示词 grep `edit` **不是有效仪器**，只有 `tools:sdk` 段内的成员名（`edit:`）才是。

## 升级后

```sh
node bin/drift-check.mjs --preset dsh-forge    # 与出厂 standard 预设逐行比对
node bin/preflight.mjs  --preset dsh-forge     # 行是否还解析得动、配置面是否还合法
node bin/lint-skills.mjs --preset dsh-forge    # 四个技能是否仍完整
```

`drift-check` **只报告，不自动同步**。对 `dsh-forge` 而言它比对的是**出厂 `standard`**，不是 `cordis`：血统不同，比错上游会把每一行的合法差异都报成漂移，把真正的漂移埋在里面。上游独有行里 `planning` / `delegation` 在本副本里对应重命名后的 `thinking` / `team`。

当前状态（实测）：共有 **29 行，其中 6 行有意偏离**——

| 行 | 偏离内容 |
| --- | --- |
| `persona` | `prefix` 与 `suffix` 都换成整套身份与工作协议（上游 `suffix` 只是一句工作目录） |
| `agent-instructions` | `maxBytes` 65536 → 196608，并加 `maxSourceBytes: 49152` |
| `skill-filesystem` | 加 `customSkillDirs`，把这个预设自己的 `skills/` 目录纳入发现范围 |
| `tool-result-pruner` | 三档阈值全部放宽（8192/4096/1024 → 16384/8192/4096） |
| `tool-subagent`、`tool-subagent-fork` | 显式 `maxDepth: 2`（上游省略，会取 schema 默认值 3） |

另加 **9 行本预设独有**：`thinking`、`team` 两个 group，五条专家行，`repeat-tool-reminder`，`tool-presentation`。这 9 行**不在比对范围内**——要检查递归统一性或 realm 归属，直接按行审计文件更可靠。

## 许可

MIT。见 [LICENSE](../LICENSE)。本预设的四个技能为原创；`dsh-smith/skills/` 下复制自官方发行包的技能不在此列，来源见主 [README](../README.md#许可与来源)。
