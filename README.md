# DSH 智能体工坊 · DSH Agent Smith

一个专门用于**开发 DSH 智能体与 Cordis 插件**的 DeepSeek Harness agent preset：强化思考协议、四层记忆纪律、四位具名专家的常驻团队。

> An agent preset for the DeepSeek Harness, specialized in building harness agents and Cordis plugins.

[![topics](https://img.shields.io/badge/topics-DeepSeek%20Harness%20Plugins-blue)](https://github.com/search?q=topic%3Adeepseek-harness-plugins&type=repositories)

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

安装脚本把 `dsh-smith/` 整个目录复制到 `${DSH_HOME:-$HOME/.dsh}/.agent-presets/dsh-smith/`。它不会覆盖已存在的同名预设（要替换请加 `--force`）。

脚本会先打印它选定的 home 与目标路径，并在该目录**缺少 harness 常见条目**（`profiles/`、`sessions/`、`storages/`、`settings.yaml`）时给出警告——因为把预设装进一个永远不会被扫描的目录是**静默失败**：复制成功，预设永远不出现。harness 装在别处就用 `DSH_HOME` 或 `--home <dir>` 指定。

`--force` 是**真正的替换**，不是合并：它会先删除目标目录再复制。否则旧版本删掉的技能会留在磁盘上继续被加载，而你以为自己装的是新版本。

> ### ⚠️ 必须开一个**新会话**
>
> preset 是在**会话启动时**挂载的。**已经开着的会话不会获得新预设**——它继续跑它自己启动时的那套组合。装完就在旧会话里问"怎么没生效"，是这个预设最常见的困惑来源。
>
> 更隐蔽的一种情况：如果在会话中途切换预设，**会话持久化头里的 `agentPreset` 字段不会跟着改写**。日志第一帧仍记录旧值，而实际生效的是新组合，于是"记录"和"所见"不一致，很容易把排查引向错误方向。判断依据以**运行时工具表**为准，不要以文件头为准。
>
> 装完请**新开一个会话**，在模式选择器里选 **「DSH 智能体工坊」**。

**验证安装**：

```sh
node bin/verify.mjs         # 挂载检查（能不能组合）
node bin/lint-skills.mjs    # 五个技能的 frontmatter
node bin/drift-check.mjs    # 与出厂 cordis 预设的偏离报告
```

`bin/verify.mjs` 调用花名册的 `standingKeyFor(id)` 做真实挂载检查——组合每个插件行，但不启动 agent、不启动会话、不启动回合——然后**打印出它自己做不到的那一步**（工具面确认）供你在真实会话里执行。它刻意区分结局，**绝不把「没检查」说成「检查通过」**：

| 输出 | 含义 | 退出码 |
| --- | --- | --- |
| `MOUNTED OK` | 组合成功：无未激活行、无泄漏到根 realm 的服务 | 0 |
| `MOUNT REJECTED` | 无法组合，并打印确切原因 | 1 |
| `INCONCLUSIVE` | 本机没有可询问的 harness 运行时，**什么都没验证** | 1 |

`MOUNTED OK` **不等于工具可用**——它只证明每个行都激活了。工具面确认脚本做不到，`verify` 会把该做的两步打印给你，原因详见下文「验证状态」。

裸 Cordis 运行时不含 harness 的注册表，所以在普通 shell 里 `verify` 通常返回 `INCONCLUSIVE`。同样的检查也可以在任意会话里手工做：`standingKeyFor('dsh-smith')`，再按下面「验证状态」一节读取真实工具表。

> **`npm run check` 在 harness 之外会以退出码 1 结束，这是设计如此，不是失败。** 它把 `lint` 与 `verify` 串起来跑；`verify` 把「没检查」当作不通过，而裸 shell 里它就是没检查。这正是我想要的语义——**一个没跑成的检查不该长得像通过**。因此本仓库**不适合**直接把 `npm run check` 放进 CI：在 CI 里请只跑 `npm run lint`（纯静态、退出码可靠），把 `verify` 留给真正的部署环境。

## 组成

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

**团队名册也写在人格前缀里**，而不是只放在技能文件中。原因是可观测的失败模式：一个没读过技能的主智能体根本不知道有四位专家，于是所有活都自己干；把名册放进始终加载的前缀，委托才可能发生。技能则承载细节——交接契约、每个角色的输出格式、如何组合新角色。

### 2. 记忆纪律

记忆层**锚定在项目根**，而项目根不一定是当前工作目录；`dsh-memory-chronicle` 给出四级判定顺序，并规定"连标记文件都没有"时不得凭空发明根，而要在工作板上留下未解决标记供下一个会话重新判定。

| 层 | 路径（相对项目根） | 生命周期 |
| --- | --- | --- |
| 指令 | `AGENTS.md`（按目录） | 持久，自动加载 |
| 编年史 | `docs/agent-notes/PROJECT.md` | 持久，就地修订 |
| 决策 | `docs/agent-notes/DECISIONS.md` | **不可变**，只追加 |
| 工作板 | `docs/agent-notes/BOARD.md` | 易变，自由重写 |

`DECISIONS.md` 的条目**完全不可修改**——被推翻的决策由一条**新条目**说明，绝不去改写旧条目。早先的版本允许"只改 Status 行"这一个例外，那与同段的"只追加"自相矛盾，已删除。代价是被推翻的条目在文件里仍读起来像现行结论；补偿是这份文件永不重写，而"当前答案"由 `PROJECT.md` 承载——读者本来就先看那里。

`AGENTS.md` 的加载预算在本预设中从默认 65536 提升到 **196608 字节**，工具结果修剪阈值也从 8192/4096/1024 放宽到 12288/6144/2048。**这两个数字是推断，不是测量出来的**：理由是专家报告与挂载验证输出是本预设的长结果。它们没有被任何真实会话的字节数或 token 读数验证过，而且两者反向耦合——指令预算放大，留给工具结果的上下文就更少。如果你的模型上下文窗口不大，请把它们调回默认值。

单个指令文件超过 **49152 字节会被完全忽略**（不是截断），这是 `agent-instructions` 的语义。一份很长的 `AGENTS.md` 会静默失效，使用者只会觉得"规则没生效"。所以宁可拆分，不要养大。

记忆层的路径都**相对项目根**，而项目根不一定是当前工作目录；`dsh-memory-chronicle` 给出了判定顺序，以及"连标记文件都没有"时该怎么处理。

### 3. 专家团队

四位具名专家，每一位是一条独立的 `@deepseek-ai/dsh-tool-subagent` 行——spawn 提供者声明了 `persona`、`toolFilter`、`depthLimit`、`agentOptions` 能力，所以「角色」就是给某一行一个角色的 persona 和推理预算。

| 工具 | 职责 | 推理预算 | 写权限 | 输出契约 |
| --- | --- | --- | --- | --- |
| `expert_architect` | 架构与设计 | `max` | 有 | 决策 / 边界 / 取舍 / 风险 / 验收 |
| `expert_verifier` | 对抗式验证 | `max` | **按设计不该写**——摘掉 `write`/`edit`，并要求它以文本交回补丁 | 结论 / 发现 / 未被攻破 / 空白 |
| `expert_protocol` | 协议、生态、版本 | 默认 | 无 | 答案 / 证据 / 冲突 / 未知 |
| `expert_chronicler` | 记忆维护 | 默认 | 仅记忆层（靠指示，不靠强制） | 已记录 / 已确立 / 未决 |

关于 `expert_verifier` 的 `write`/`edit` 过滤，**两件事必须分开说**：

- **强制的部分**：这两个工具从子代理的工具表里消失，强制执行也会被拒。
- **没强制的部分**：它**仍然有 `pwsh`**，而 shell 能写文件。所以这**不是**沙箱边界，我也不会把它写成沙箱。它的作用是设计信号——审查**靠论证纠正**（把补丁作为文本交回来），而不是悄悄变成一次没人看见的重写。persona 已如实写明这一点。
- **故意不 deny `pwsh`**：复现缺陷是验证者最有力的证据，一个什么都不能跑的验证者只是校对员。代价是这条约束终究是**行为约束**，不是能力约束。

四者默认后台运行（`backgroundMode: continuable`），因此一条消息可以并行启动全部专家。

**递归上限在全部六条委派行上显式写明 `maxDepth: 2`**——`subagent`、`subagent_fork`，以及四条专家行。前两条一直有；**后四条一直没有**，而"省略"不等于"继承"：`dsh-tool-subagent` 自己的 schema 会补 `.default(3)`，于是四条专家行实际带着 **3** 的预算、又运行在深度 1，**比主智能体自己的工具还能多下一层**——`agent(0) → expert(1) → helper(2) → helper(3)` 是可到达的。这与我曾在一个提交信息里声称的"每一行都写明了"相反，那一版注释还把层级标成了 1/2/3。

正确的计数（读自 `resolveChildDepth`：`childDepth = parent + 1`，只在 `childDepth > maxDepth` 时拒绝；顶层会话头携带 `delegationDepth: 0`）：**从主智能体起是 0、1、2**。六行统一为 2 之后，最深链路是 `agent(0) → expert(1) → helper(2)`，第四层在 `start` 处被拒。

**一条只在两行上成立的界不是界**——这是本仓库自己的教训，记在 `DECISIONS.md` 的 D-10。

**这个团队没有"端到端验证者"。** 名册覆盖设计、对抗审查、外部事实、记忆四件事，但**没有人负责"整条流程真的跑通了吗"**。这正是我构建本预设时犯的错：逐行验证到了 ACTIVE，就以为功能可用。改动跨多个部件时，请你自己跑端到端检查，或明确要求 `subagent` 只做这件事并报告**观测到的结果**而非结论。

### 4. 随行技能

| 技能 | 作用 | 来源 |
| --- | --- | --- |
| `editing-cordis-compositions` | 组合创作与两个平面的判据 | 复制自出厂 `cordis` 预设（MIT） |
| `cordis-plugin-development` | 动态 Cordis 插件开发 | 复制自出厂 `cordis` 预设（MIT） |
| `dsh-runtime-reference` | **本部署的**路径、按平面分组的行清单、实时服务与提示段落名、挂载诊断 | 本仓库原创 |
| `dsh-expert-team` | 团队名册、交接契约、如何组合一个新角色 | 本仓库原创 |
| `dsh-memory-chronicle` | 四层记忆布局、条目格式、维护规则、空仓库如何起步 | 本仓库原创 |

前两个技能**同时**由安装副本和出厂预设目录提供，两者都会被技能发现机制扫描到。技能按名字取胜者，所以不会冲突——但知道这个重复存在有用：读到"技能基目录"落在出厂路径时，那不代表本预设没装好。

另外两个技能是**照抄未改的上游文件**，里面提到 `cordis_mount` / `cordis_unmount`——**本部署没有 `cordis_mount` 这个工具**，实际工具集是 `cordis_define` / `cordis_run` / `cordis_stop` / `cordis_undefine`。我**没有删改它们的正文**（那会让与上游的差分失效），而是在各自开头加了一段**更正横幅**，逐一列出过时名字与正确对应，并写明"与 `cordis_inspect_list` 冲突时以 `cordis_inspect_list` 为准"。

这两个技能教的**方法依然正确**，这正是它们随包分发的原因：复制预设、改副本、挂载验证、绝不碰出厂安装。变的只是工具名。

## 已知限制

### `tool-cordis` 那一行

**这一节记录的是未修好的缺陷与刻意排除的能力，不是设计亮点。** 如果你只需要专家团队、思考协议和记忆层，前两条可以略过；如果你要用本预设开发 Cordis 插件，请先读完。

### 信任边界：这不是沙箱

`cordis_define` + `cordis_run` 会把**模型写的 JavaScript 直接对着实时运行时求值**，而这样定义出来的 Package 会被 `cordis_run` 激活、并被本 agent 写进其它会话将挂载的 preset。所以本预设的会话应当按**等同于 shell 访问**来对待：它能执行代码、能改运行中的进程、能写出别的会话会加载的组合。

那条 `!!js` 门、`isolate` realm、以及所有"平面"规则管的是**归属**，不是**权限**——它们防止配置错误，不防止恶意。`tool-cordis` 一旦激活，本预设就是完全可信代码。请只在你愿意让模型改这台机器的环境上使用它。

### 刻意排除的能力（不是缺陷）

这些包在本部署里存在，但**没有**被组合进来，都是有意的：

- **`@deepseek-ai/dsh-mcp-client`** —— 已安装，且**基础组合与 web-app 组合都没有挂载它**。MCP 服务器支持是一条独立的信任面（外部进程、它自己的凭据与工具面），本预设不替使用者打开它。需要就自行在 profile 补丁层加行。
- **`@deepseek-ai/dsh-tool-subagent-report`** —— 结构化子代理报告。**这个包在本部署里是坏链**：`node_modules` 下的目录是指向安装缓存中不存在目标的 junction，看起来装了、其实导不进来（`lib/` 不存在）。所以它不能作为本预设的依赖；`bin/verify.mjs` 里判断包是否真的存在也必须查内容而不是查名字。

### `tool-cordis` 那一行

#### 两个注册面，作用域完全不同——这是理解一切的前提

`tool-cordis` 的 `apply(ctx)` 做三类事，**它们的作用域不是一回事**（读自 `dsh-tool-cordis/lib/index.js`）：

| 它注册什么 | 用什么 | 作用域 |
| --- | --- | --- |
| 一个提示段落 `tool:cordis` | `ctx.systemPrompt.section` | 挂载它的会话 |
| **四个** Host inspect provider（`Service`、`Event`、`Builtin`、`Tool`） | `ctx.effect(() => ctx.cordisInspect.register(...))` | **进程全局** |
| **七个** 工具（`cordis_inspect_list` / `_query` / `_self` / `define` / `run` / `stop` / `undefine`） | `ctx.tools.register` | 挂载它的会话 |

计数是实测的：该文件里 `ctx.cordisInspect.register` 出现 **1 次**（在一层 `hostInspectProviders(ctx)` 循环里，
迭代四次），`ctx.tools.register(` 出现 **7 次**。

**只有那四个 provider 是进程全局的；七个工具不是。** 工具按 agent scope 注册，所以**一个组合关掉这一行，
它的会话就是没有 `cordis_*` 工具——不管同进程里别的组合注册过什么。**

#### 冲突本身

那四个 provider 注册进 `cordisInspect`，而该注册表的 provider map **按 id 去重且直接 throw**。所以一个进程里
第二个含 `tool-cordis` 的组合会**整体挂载失败**：

```
failed to apply loader entry tool-cordis: Host Cordis inspect provider "Service" is already registered
```

实测的，不是推断：去掉下面那道门，本预设在任何已有其它会话注册过这些 provider 的进程里根本挂不上去。

#### 那道门恒为真，所以本预设永远拿不到这套工具

```yaml
- id: tool-cordis
  name: '@deepseek-ai/dsh-tool-cordis'
  disabled: !!js ctx.get('cordisInspect') !== void 0
```

`ctx.get('cordisInspect')` 问的是「**注册表是否存在**」，不是「**有没有东西注册进去**」。而该注册表由
`DynamicCordisRunnerService` 的**构造函数**创建（`dsh-cordis-host-runner/lib/index.js:1598`），挂在一个
**无条件、永不释放**的 host 行下面。

这不是挂载顺序问题，是**生命周期问题**：`cordisInspect` 在整个进程生命里都存在，所以这道门**恒为真**，
于是 `dsh-smith` 会话**永远没有 `cordis_*` 工具**。重启进程不会改变这一点。

我先前写的「只有当同进程里另有存活的组合已经注册过它们时才拿得到」**是错的**——那句话把工具当成了进程全局，
而它们不是。门带来的唯一好处是：预设能挂上，专家团队、思考协议、记忆层都正常工作。

#### 怎么确认，以及该怎么办

在会话里尝试一次 `cordis_inspect_list`：

- **它回答了** → 你不在这种情况（例如你正在创造模式）；
- **提示工具不存在** → 本次会话没有这套工具，请改用出厂 **「创造模式」** 预设的会话做 Cordis 插件工作。

`dsh-smith` 会话实测就是后者。

#### 真正的修法不在这个仓库里

修复需要**上游的两件事**，缺一不可：

1. 让 `CordisInspectRegistryService.register()` 对**已注册的 provider id 幂等**——返回既有 disposer 而不是 throw；
2. 让一个**只想要工具**的组合能够消费既有的四个 provider，而不重新注册它们。

第 2 件才是本预设真正缺的那一半：现在的 `apply` **同时**注册 provider 与七个工具，所以"跳过 apply 以避免冲突"会连工具一起跳过——正是我们不想要的。这**需要一个新的小插件**，YAML 表达不了「注册工具但跳过 provider 注册」。这是本仓库已知的天花板，不是配置错误。

> **provider 的生命周期应当是"首个注册者拥有，进程内不释放"，不要用引用计数。** 朴素的 refcount 会在最后一个消费者卸载时删除 provider，而 `cordis_inspect_list` / `cordis_inspect_query` 是**调用时**读取注册表的——另一个会话里仍然活着的工具会发现 provider 没了。注册表本身就具有进程生命周期（由构造函数创建、永不释放），四个 manifest 跟着它活到底没有任何额外代价。这条已**决定**并记录在 `DECISIONS.md` 的 D-13，不再是未决项。

## 验证状态

### 已在真实会话里观测到的部分

一个运行在本预设上的会话（`agentPreset` 与安装副本均逐一确认）直接回答了多项此前的缺口：

- **四条专家工具确实到达了模型工具表。** `expert_architect` / `expert_verifier` / `expert_protocol` / `expert_chronicler` 全部在会话的工具 schema 里，`subagent` / `subagent_fork` 同在，而 `subagent_codex` / `subagent_claude_code` **恰好缺席**——与那两行 `disabled: true` 的预测一致。
  > 这项证据**强于**我原先指定的检查方式。`cordis_inspect_query → Tool.listTools` 那个会话里跑不了（`cordis_*` 缺席），而它的实现是 `ctx.tools.schemas(context.agent)`——返回的正是同一张表。**会话自己持有的函数 schema 就是交到模型手上的那张表**，用不着再去自省它。
- **四个人格全部按契约输出**（四次调用，逐一比对终稿的块与 persona 文本）：`expert_architect` → `DECISION / BOUNDARIES / TRADEOFFS / RISKS / ACCEPTANCE`；`expert_chronicler` → `RECORDED / DERIVED / OPEN`；`expert_verifier` → `VERDICT / FINDINGS / SURVIVED / GAPS`；`expert_protocol` → `ANSWER / EVIDENCE / CONFLICTS / UNKNOWN`。
  > **但人格合规不等于报告可信——这是本仓库最值钱的一条教训。** 验证专家的契约完全合规，而它的头号发现是**假的**：它断言 `maxDepth: 2` 存在于全部四条专家行，**并打印出一份与自己的断言相矛盾的 grep**（六个命中，无一在专家行上），引用的是一个提交正文而不是文件，而且那个提交落后 HEAD 两个版本。重新 grep 同一个文件复现了原始审计：四条专家行**根本没有** `maxDepth`，因此各自取 schema 默认值 **3**——与它的断言相反，也与它正在评审的那段注释相反。它的替代深度算术同样是错的，方向还相反。
  >
  > 它照抄的是**推断链的上游**（提交信息、任务描述、我此前的说法），而不是文件本身。已据此强化 persona 的证据标准：每条发现必须**逐字引用**读到的文本并给出路径与行号、引用前**重跑**那条命令、并声明**所检查的版本**；无法这样支撑的发现只能作为 `GAPS` 里的未证实项。
- **`package.json` 在 npm 下有效**：`npm pack --dry-run` 退出码 0；加了 `files` 允许列表后为 14 个文件、58.1 kB，四个 bin 目标齐备，记忆层与 `.gitignore`/`.gitattributes` 均被排除。
- **README 徽章可解析**：HTTP 200，SVG 标注 `topics: DeepSeek Harness Plugins`。

### 已用真实挂载验证的部分

（`agentPresets.standingKeyFor('dsh-smith')`，在同一进程内多次复验）

- 挂载通过——无未激活行，无泄漏到根 realm 的服务；
- `compositionInventory()` 报告 **33 行全部组合，29 行 `ACTIVE`**；
- 恰好 4 行按设计关闭：`tool-bash`（Windows 平台门）、`tool-cordis`（上述条件门）、`tool-subagent-codex` 与 `tool-subagent-claude-code`（未安装的可选产品提供者）；
- **去掉 `tool-cordis` 那道门会整体挂载失败**——做过的对照实验，不是推断。

### 两条最后的缺口：已闭合

这两条曾长期列为未验证。一次在 `dsh-smith` 会话里发出的 `expert_verifier` 委托同时给出了答案，三条判据全部可观测：

1. **`write`/`edit` 过滤确实被强制。** 子代理的 `TOOLS` 列表里没有这两个名字；强制调用返回 `Error: unknown tool "write"` / `"edit"`，探针路径 `Test-Path` 为 false——没有创建任何文件。
   **而且排除了替代解释**：一个**同深度、同 provider、同 `applyChildComposition` 路径**但不带 `toolFilter` 的探针子代理**保留了** `write`/`edit`，而 `pwsh`（该行注释明写故意不 deny）在两者中都存活。唯一声明差异就是 `deny: [write, edit]`。
2. **加强后的证据标准确实改变了行为——证据是它拒绝了，而不是它同意了。** 报告要求全部满足（带行号的逐字引文、在眼前 revision 上重读、粘贴前重跑、写明 revision）。

**最值得记住的一点：它判 `VERDICT unsound`，驳回了 brief 自己的断言。** brief 说"team 组六行全部 `maxDepth: 2`、无其它值"，而组内另有 `tool-subagent-codex` 与 `tool-subagent-claude-code` 取值为 `provider-managed`。那个限定条件上一轮刚被写下，发出 brief 时按本文件逐字照抄又被剥掉了——**verifier 是对的，brief 是错的**。一个只会确认过度断言的验证者只是橡皮图章。

> 作为对照：同一角色、同一任务类型，此前一次报告的头条发现是**假的**（从提交信息推理、grep 自相矛盾）。同角色、同任务、结果相反，唯一变化就是这个标准。

**这条仍未隔离，我们也不声称**：`restrict()` 本身（而非其它有同样可观测效果的机制）造成了拒绝；以及 `toolFilter` 遇到未知名字是否 fail-loud、与 `allow` 如何组合。这两点写在 `docs/agent-notes/DECISIONS.md` 的 D-17。

### 关于 `list_subagent_models`：不是缺陷，是你没开的 opt-in

这一条我先前记错了**两次**——先断言"该设置很可能静默无效"，理由是"本部署的基础组合里没有 `model-selection-settings` 行"。**两点都错**：

- 该行**有**，在 **web-app** bundle 里（`dsh-web-app/cordis.patch.yml`，包 `@deepseek-ai/dsh-tool-subagent/model-selection-settings`）。`dsh-base` 里确实没有——我只查了 base 就下了结论。
- 它也**不是静默失败**的：缺该行会**大声抛错**（`tool-subagent: \`modelSelectionSettings\` requires … in the Host scope`）。真正的行为与"静默无效"相反。

实测的完整链路：服务 `subagentModelSelection` 在本会话可用，返回 `enabled=false, allowedModels=[]`；在 `settings.yaml` 里加上下面的段后，同一服务的读取**热重载为 `true`**，随后已还原。

```yaml
subagent-model-selection:
  enabled: true
  allowedModels:
    - provider: deepseek-official
      model: deepseek-flash
```

所以 `modelSelectionSettings: true` 是**接通且待命**的。`list_subagent_models` 只在策略解析出**非空**路由时才注册（`registerListSubagentModels` 的调用点是 `if (modelSelectionPolicy !== void 0)`），而 `enabled` 的 schema 默认值是 `false`——**这是产品设计上的 opt-in，不是本预设的缺陷**。

**要打开**：Settings 的 Plugins 页，或直接写上面的段。至少给一条路由——`enabled: true` 配空的 `allowedModels` 会被拒绝（"enabled subagent model selection requires at least one allowed model"）。**新会话**生效。

### 已关闭

- **四个人格的输出契约** —— 四次调用，全部合规（见上）。
- **`tool-cordis` 的落点** —— 不再是"取决于挂载顺序"。`disabled` 是**跳过**而非**等待**（`cordis-plugin-loader/lib/index.js:391` 在 `init()` 之前返回），该行没有声明任何 `inject:`，而注册表在**构造函数**里建立且永不释放。**生命周期事实，不是顺序事实**：重启不会改变它。
- **会话头的 `agentPreset` 不能证明会话由哪个预设在服务** —— 它是**创建时提示**。本仓库根会话的头写着 `standard`，而它派生的两个子会话写着 `dsh-smith`，三者工具表相同；出厂 `standard` 组合里根本没有 `expert_*` 行。**挂载后的工具表才是权威。**
4. **`expert_verifier` 的 `write`/`edit` 过滤从未被强制过一次。** 该行确实挂载了、它的工具确实在表里，但"被过滤的工具调用会被拒"这句只有源码支持，没有一次实际尝试。

脚本能做的部分仍受限于动态插件无法把 preset 挂到 agent 上（`ctx.fiber` 被 guard 屏蔽），`bin/verify.mjs` 因此**打印**该做的两步而不是假装检查过。

## 兼容性

针对 DeepSeek Harness **0.1.5-rc.1** 的行名与配置面编写。行名、服务键与配置字段属于部署内部接口，升级后可能移动。

**本 preset 派生自出厂 `cordis` 预设，因此会随上游升级而漂移。** 升级后请重跑：

```sh
node bin/drift-check.mjs   # 与出厂 cordis 逐行比对，报告共有行里哪些配置面变了
node bin/verify.mjs        # 组合还能不能挂
node bin/lint-skills.mjs   # 五个技能是否仍完整
```

`drift-check` **只报告，不自动同步**——本预设刻意改写了它继承的多行（人格、指令预算、修剪阈值、`maxDepth`、`tool-cordis` 的门），一个"体贴地"帮你同步的工具会把这份副本的意义整个抹掉。它列出每个共有行在**包名、`disabled` 行、配置键集合**上的差异；是否跟随上游是设计决定，需要人工改。

一个要知道的边界：**它只比对两份文件都有的行**。本预设独有的六行（`thinking`、`team` 两个 group 与四条专家行）不在比对范围内，所以那四条专家行上的 `maxDepth: 2` 在这里**不会**出现——要检查递归统一性，直接按行审计 `maxDepth` 更可靠。

当前状态（针对 0.1.5-rc.1，实测）：共有 30 行，其中 **6 行有意偏离**——`persona`（suffix 改为整套工作协议）、`agent-instructions`（预算提高）、`tool-result-pruner`（阈值放宽）、`tool-subagent` 与 `tool-subagent-fork`（显式 `maxDepth`）、`tool-cordis`（加条件门）。上游独有 2 行 `planning` / `delegation`，在本副本里对应重命名后的 `thinking` / `team`。

## 许可与来源

MIT。见 [LICENSE](LICENSE)。

`dsh-smith/skills/` 下的 `editing-cordis-compositions` 与 `cordis-plugin-development` 两个技能复制自 DeepSeek Harness 官方发行包 `@deepseek-ai/dsh-agent-presets` 的 `cordis` 预设，遵循其 MIT 许可，版权归 DeepSeek 所有；其余内容为本仓库原创。
