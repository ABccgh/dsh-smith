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

四者默认后台运行（`backgroundMode: continuable`），因此一条消息可以并行启动全部专家。递归上限由**每一行显式写明的 `maxDepth: 2`** 界定为「主智能体 → 专家 → 专家的助手」——包括 `subagent_fork`：该行原先省略了 `maxDepth`，而省略并不会继承兄弟行的值，工具 schema 会补 `.default(3)`，于是 fork 链能比其它行多下一层。现已统一。

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

另外两个技能里**有已知过时的 API 名**（它们提到 `cordis_mount` / `cordis_unmount`，而本部署的工具集是 `cordis_define` / `cordis_run` / `cordis_stop` / `cordis_undefine`，没有任何 `cordis_mount`）。它们是照抄未改的上游文件。**以 `cordis_inspect_list` 返回的清单为准**，不要以这两个文件里的工具名为准。

## 已知限制

### `tool-cordis` 那一行

**这一节记录的是未修好的缺陷与刻意排除的能力，不是设计亮点。** 如果你只需要专家团队、思考协议和记忆层，前两条可以略过；如果你要用本预设开发 Cordis 插件，请先读完。

### 信任边界：这不是沙箱

`cordis_define` + `cordis_run` 会把**模型写的 JavaScript 直接对着实时运行时求值**，而 `cordis_mount` 的产物会成为**其它会话挂载的 preset**。所以本预设的会话应当按**等同于 shell 访问**来对待：它能执行代码、能改运行中的进程、能写出别的会话会加载的组合。

那条 `!!js` 门、`isolate` realm、以及所有"平面"规则管的是**归属**，不是**权限**——它们防止配置错误，不防止恶意。`tool-cordis` 一旦激活，本预设就是完全可信代码。请只在你愿意让模型改这台机器的环境上使用它。

### 刻意排除的能力（不是缺陷）

这些包在本部署里存在，但**没有**被组合进来，都是有意的：

- **`@deepseek-ai/dsh-mcp-client`** —— 已安装，且**基础组合与 web-app 组合都没有挂载它**。MCP 服务器支持是一条独立的信任面（外部进程、它自己的凭据与工具面），本预设不替使用者打开它。需要就自行在 profile 补丁层加行。
- **`@deepseek-ai/dsh-tool-subagent-report`** —— 结构化子代理报告。**这个包在本部署里是坏链**：`node_modules` 下的目录是指向安装缓存中不存在目标的 junction，看起来装了、其实导不进来（`lib/` 不存在）。所以它不能作为本预设的依赖；`bin/verify.mjs` 里判断包是否真的存在也必须查内容而不是查名字。

### `tool-cordis` 那一行

### 冲突本身

`tool-cordis` 在 apply 时把四个 Host inspect provider（`Service`、`Event`、`Builtin`、`Tool`）注册进 `cordisInspect`，而该注册表的 provider map **按 id 去重且直接 throw**。行按花名册顺序加载，所以**一个进程里第一个**声称这些 id 的组合获胜，之后每一个含该行的组合都会**整体挂载失败**：

```
failed to apply loader entry tool-cordis: Host Cordis inspect provider "Service" is already registered
```

这是实测的，不是推断的：把下面那道门去掉，本预设在任何已有其它会话注册过这些 provider 的进程里**根本挂不上去**。

### 那道门是两害相权，而且它不像我先前写的那样工作

```yaml
- id: tool-cordis
  name: '@deepseek-ai/dsh-tool-cordis'
  disabled: !!js ctx.get('cordisInspect') !== void 0
```

`ctx.get('cordisInspect')` 回答的是「**注册表是否存在**」，不是「**有没有东西注册进去了**」。而该注册表由 `@deepseek-ai/dsh-cordis-host-runner` 在其构造函数里**急切创建**（web profile 把它挂在 host plane），所以在类似本部署的环境里这道门**恒为真**。后果：

- **dsh-smith 会话不会自己拿到 `cordis_*` 工具。** 只有当同一进程里另有存活的组合已经注册过它们时才拿得到——而这取决于挂载顺序和其它会话的存活期；
- 门带来的好处只是：预设能挂上，专家团队、思考协议、记忆层都正常工作；
- 门带来的代价是：插件创作工具可能缺席，且行为不可预测。

用 `ctx.get()` 而不是 `ctx.cordisInspect`：`!!js` 门在 Loader 上下文求值，Cordis guard 会拒绝未经声明的属性访问。

### 怎么判断你处在哪种情况

在会话里调用一次 `cordis_inspect_list`：

- **它回答了** → 工具是活的，可以正常开发插件；
- **提示工具不存在** → 本次会话没有这套工具，请改用出厂 **「创造模式」** 预设的会话来做 Cordis 插件工作。

### 真正的修法不在这个仓库里

应当把 `CordisInspectRegistryService.register()` 改成**幂等**——对已注册的 provider id 返回既有 disposer，而不是 throw。一个 preset 用 YAML 表达不了这件事，所以本仓库只能记录限制并保持可用。

## 验证状态

**已用真实挂载验证的部分**（`agentPresets.standingKeyFor('dsh-smith')`，在同一进程内多次复验）：

- 挂载通过——无未激活行，无泄漏到根 realm 的服务；
- `compositionInventory()` 报告 **33 行全部组合，32 行 `ACTIVE`**；
- 恰好 4 行按设计关闭：`tool-bash`（Windows 平台门）、`tool-cordis`（上述条件门）、`tool-subagent-codex` 与 `tool-subagent-claude-code`（未安装的可选产品提供者）；
- 四条专家行 `tool-expert-architect / verifier / protocol / chronicler` 全部 `ACTIVE`；
- **去掉 `tool-cordis` 那道门会整体挂载失败**——这是做过的对照实验，不是推断。

**仍然存在的验证缺口，逐条列出。** 上面每一条都只证明「行组合成功且处于 ACTIVE」，**不证明任何工具真的到了模型手上**——行激活与工具可用是两件事，把它们混为一谈是构建本预设时最主要的错误。

1. **四条专家行是否注册出模型可见的 `expert_*` 工具、子代理创建路径是否可用** —— 本仓库交付时**无端到端观测**，而且**脚本做不到这件事**。我试过三条路，全部走不通，记录在此以免有人重走：
   - `tools.schemas(standingKey)` 返回空数组——这是**预期行为**，工具按 agent scope 解析，标准挂载的 scope 不是 agent scope；
   - 低层 `ctx.agents.create({ sessionId })` 能造出 agent，但它**完全没有挂载任何 preset**（实测：工具表里连 `write` 都没有），所以它的工具面对本预设毫无说明力；
   - 真正会把 preset 挂上去的工厂 `ctx.agentLoop.createAgent()` **动态插件用不了**：它读 `ctx.fiber`，而 Host guard 按设计屏蔽框架内部（`sandbox ctx does not expose "fiber"`）。

   所以这项断言只能由**真实会话**完成。`bin/verify.mjs` 现在会**打印出那两条确切调用**而不是假装检查过：在新会话里跑 `cordis_inspect_query`（host / provider `Tool` / method `listTools`），确认那四个名字在表里。
2. **`tool-cordis` 在目标部署落在哪种情况** —— 取决于挂载顺序与其它会话的存活期，见上一节。
3. **`modelSelectionSettings: true` 很可能静默无效** —— 该设置依赖宿主挂载 `@deepseek-ai/dsh-tool-subagent/model-selection-settings` 行，本部署的基础组合里没有它，因此 `list_subagent_models` 很可能永远不会出现，而这个配置键不会报错。第 1 项的那次工具表读取会同时暴露它。

## 兼容性

针对 DeepSeek Harness **0.1.5-rc.1** 的行名与配置面编写。行名、服务键与配置字段属于部署内部接口，升级后可能移动。

**本 preset 派生自出厂 `cordis` 预设，因此会随上游升级而漂移。** 升级后请重跑：

```sh
node bin/drift-check.mjs   # 与出厂 cordis 逐行比对，报告共有行里哪些配置面变了
node bin/verify.mjs        # 组合还能不能挂
node bin/lint-skills.mjs   # 五个技能是否仍完整
```

`drift-check` **只报告，不自动同步**——本预设刻意改写了它继承的多行（人格、指令预算、修剪阈值、`maxDepth`、`tool-cordis` 的门），一个"体贴地"帮你同步的工具会把这份副本的意义整个抹掉。它列出每个共有行在**包名、`disabled` 行、配置键集合**上的差异；是否跟随上游是设计决定，需要人工改。

当前状态（针对 0.1.5-rc.1，实测）：共有 30 行，其中 **6 行有意偏离**——`persona`（suffix 改为整套工作协议）、`agent-instructions`（预算提高）、`tool-result-pruner`（阈值放宽）、`tool-subagent` 与 `tool-subagent-fork`（显式 `maxDepth`）、`tool-cordis`（加条件门）。上游独有 2 行 `planning` / `delegation`，在本副本里对应重命名后的 `thinking` / `team`。

## 许可与来源

MIT。见 [LICENSE](LICENSE)。

`dsh-smith/skills/` 下的 `editing-cordis-compositions` 与 `cordis-plugin-development` 两个技能复制自 DeepSeek Harness 官方发行包 `@deepseek-ai/dsh-agent-presets` 的 `cordis` 预设，遵循其 MIT 许可，版权归 DeepSeek 所有；其余内容为本仓库原创。
