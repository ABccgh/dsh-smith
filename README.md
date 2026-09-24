# DSH Presets · 智能体工坊 / 研发工坊 / CK3 模组工坊 / 短剧工坊 / 剧本工坊

五个 DeepSeek Harness agent preset，一个仓库。每个都是**一个会话挂载的一份组合**，各自强化思考协议、记忆纪律与具名专家团队，各带一套随行技能。

> Five DeepSeek Harness agent presets in one repository: `dsh-smith` builds harness agents and Cordis plugins, `dsh-forge` delivers software, `dsh-ck3-mod` authors Crusader Kings III mods, `dsh-script` writes the screenplay half of a vertical short drama (**选题 → 一句话钩子 → 圣经 → 分集功能表 → 逐集正文**, handed to the user for platform evaluation and revised from the reading), and `dsh-duanju` carries that same line further — a later **stage**, not a fallback for `dsh-script` (neither replaces the other) — through a 28-column storyboard and the 有戏AI production stages.

[![topics](https://img.shields.io/badge/topics-DeepSeek%20Harness%20Plugins-blue)](https://github.com/search?q=topic%3Adeepseek-harness-plugins&type=repositories)

---

## 该用哪个

| | **`dsh-smith`** · 智能体工坊 | **`dsh-forge`** · 研发工坊 | **`dsh-ck3-mod`** · CK3 模组工坊 | **`dsh-duanju`** · 短剧工坊（分镜与成片） | **`dsh-script`** · 剧本工坊 |
| --- | --- | --- | --- | --- | --- |
| 做什么 | 造 DSH 智能体、写 Cordis 插件 | 交付软件：写、改、测、调、审 | **只做 CK3 模组开发**：写得出、校验得了、记忆留得住 | **只做分镜与成片**：读剧本工坊交付的定稿正文 → 28 列分镜表 → 平台可导入 xlsx → 生成 → 成片 → 投稿；**不写也不改正文** | **只做剧本**：选题 → 一句话钩子 → 圣经 → 分集功能表 → 逐集正文 → 交给你在平台上评估 → 按读数改稿；**分镜表与 xlsx 模板不在范围内** |
| 专家 | architect / verifier / protocol / chronicler（4） | architect / verifier / **debugger** / protocol / chronicler（5） | modd / verifier / chronicler（3） | **board / shootability** / verifier / chronicler（4） | script / doctor / dialogue / **continuity**（4） |
| 计划协议 | 组合设计（平面 / realm / 行清单） | 软件工程（改动面 / 接口 / 边界 / 验收） | 模组四段（目标与落点 / 证据清单 / 执行顺序 / 未知与假设） | 短剧四段（目标与落点 / 证据清单 / 执行顺序 / 未知与假设） | 剧本四段（目标与落点 / 证据清单 / 执行顺序 / 未知与假设） |
| 工具呈现 | 原生工具表 | `mode: both`：原生工具表 ＋ `run_code` 的 TypeScript SDK | 原生工具表 | 原生工具表 | 原生工具表 |
| 自省工具 | 含 `tool-cordis` 行（本部署下被门关掉） | 不含该行 | 不含该行 | 不含该行 | 不含该行 |
| 宿主依赖 | 无 | `dsh-web-app` 的 `code-runtime` | **一个插件**：`dsh-ck3-modcheck`（见下） | **无**（HEAD 状态）—— 平台侧那几步是人做的，preset 里没有任何插件行 | **一个插件**：`dsh-duanju-script`（见下）—— 它给的是三件**本机**剧本域工具，宿主平面，**组合里没有它的行** |
| 血统（`drift-check` 比对的上游） | 出厂 `cordis` | 出厂 `standard` | 出厂 `standard` | 出厂 `standard` | 出厂 `standard`（源文件是本仓库的 `dsh-duanju`） |
| 详细文档 | [`docs/dsh-smith.md`](docs/dsh-smith.md) | [`docs/dsh-forge.md`](docs/dsh-forge.md) | [`docs/dsh-ck3-mod.md`](docs/dsh-ck3-mod.md) | （不单开文档：`docs/dsh-duanju.md` 已随这次窄化改名为 [`docs/dsh-script.md`](docs/dsh-script.md)；它的状态就是本表这一列） | [`docs/dsh-script.md`](docs/dsh-script.md) |

**`dsh-duanju` 现在只有分镜与成片那一段。** 剧本那一块（剧本 persona、编剧／剧本医生／台词师三名专家、9 个剧本侧技能）已整体移出，因为 `dsh-script` 已经把它做全 —— 两个预设发布同一套角色就是「同一能力两份实现」。移出之后它仍是一个**完整可用**的预设：它的专家是分镜工程师与可拍性，技能是分镜表、导出、平台投稿与制作链。

**五个都装也可以**：它们互不覆盖，各自的源目录就是各自的 preset 目录，会话启动时由选择器决定用哪个。（`dsh-duanju/` 与 `dsh-script/` 是**同一条短剧链上的两段**：前者从定稿正文往后做到成片，后者只做正文那一段。都装时选择器里会同时出现「短剧工坊 · DSH Duanju」与「剧本工坊 · DSH Script」。）

> ### `dsh-script` 与用户自建的 `dsh-aivideo`
>
> 本机另有一个**用户自建**的 preset `dsh-aivideo`（AI 视频变现工作台，12 个技能，其中 6 个在短剧链上）。它**不在本仓库里**；本仓库的 `dsh-script` 是那个能力面的**窄化版**：一条产品线、一个平台、**只做剧本这一段**（选题 → 逐集正文 → 交给用户评估 → 按读数改稿）。两者并存，互不覆盖；技能同名时**项目本地副本优先**（见 [`docs/dsh-script.md`](docs/dsh-script.md) 的「技能从哪来」一节）。

> ### `dsh-duanju` 与 `dsh-script` 的关系
>
> **同一条短剧链上的两段，不是两代、不是两个产品。** `dsh-script` 只做**正文**那一段：选题 → 圣经 → 分集功能表 → 逐集正文 → 交给用户在平台上评估 → 按读数改稿，**分镜表与平台 xlsx 模板整体出范围**。`dsh-duanju` 从正文往后接：读剧本工坊交付的定稿正文 → **28 列分镜表** → 平台可导入 xlsx → 生成 → 成片 → 投稿，**不写也不改正文**。
>
> **两者之间没有重复的专家、没有重复的技能、没有重复的判据。** 这一条是 2026-09-24 专门做的一次去重：`dsh-duanju` 原先带的剧本 persona、编剧／剧本医生／台词师三名专家、以及 9 个剧本侧技能已整体移出，因为 `dsh-script` 把它们做全了 —— 两个预设发布同一套角色，是「同一能力两份实现」。
>
> **一个必须说清的能力损失：** 分镜侧**已经没有自动判据**了。读列契约、判分镜表形状、比对官方模板的三个工具（`duanju_contract` / `duanju_board` / `duanju_template`）随剧本一起被删，剩下的三件 `duanju_*` 全是剧本域的。所以 `dsh-duanju` 在分镜上靠的是**技能里的权威引用 + 它自己的核对**，而不是机器闸门；它的 `expert_board` 的 persona 里写着「你的检查就是那个检查」。

> ### `dsh-ck3-mod` 还需要一个插件
>
> 与另外几个不同，`dsh-ck3-mod` 的 `tool-ck3-modcheck` 行引用的是**本仓库不发布的宿主平面插件** `dsh-ck3-modcheck`：它按**原版游戏安装**的判据校验模组——`.mod` 与文件夹是否配对、`descriptor.mod` 在不在、路径是否全 ASCII、本地化 `.yml` 是否带 UTF-8 BOM 与 `l_english:` 首行、脚本括号是否配平。
> 它装在 `$DSH_HOME/plugins/` 下、由 profile 的 `cordis.patch.yml` 一行 `insert:` 挂载，**不在本仓库里**（本仓库只发布 preset，见 `AGENTS.md` 规则 7）。
> 没有它，preset 仍然能挂载，但 `ck3_modcheck` 不会出现——而那正是"交付前必跑"这条规矩的执行者。安装步骤在 [`docs/dsh-ck3-mod.md`](docs/dsh-ck3-mod.md)。

> ### `dsh-script` 也需要一个插件，但它的形状与上面那个**不同**
>
> `dsh-script` 用到的三件剧本域工具——`duanju_gate`（结构化闸门，**四态** `PASS`／`FAIL`／`UNAVAILABLE`／`CRASHED`）、`duanju_recall`（一部剧状态的只读投影）、`duanju_checkpoint`（把投影渲进 `项目总览.md` 的受管区块）——由**本仓库不发布**的宿主平面插件 `dsh-duanju-script` 提供，源码在 `D:\dsh-duanju-script\`。
> 它由 profile 的 `cordis.patch.yml` 一行 `insert:`（`id: duanju-script`）挂载，依赖用 `dsh plugin --profile <profile> add D:\dsh-duanju-script` 写进 profile 的依赖图。**与 `dsh-ck3-modcheck` 的差别在这里**：它不在 `$DSH_HOME/plugins/` 下，而是以 `link:` 指向 `D:\dsh-duanju-script\`；相同的是它**不发布任何服务**（`inject = ['fs','tools']`，没有 `provide()`），只把工具注册进宿主的 `ctx.tools`。
> **所以 `dsh-script/agent.cordis.yml` 里没有它的一行** —— preset 只**消费**这三件工具，`dsh-ck3-mod` 则是**点名**它的插件。后果有两条，方向相反：没有插件时 preset **照样挂载**（组合里没有任何一行指向它），但那三件工具**不会出现**，而 persona 与技能都按它们存在来写 —— 这时闸门的结论是**没有结论**，不是通过；反过来，**有插件时这三件工具对每一个会话可见**，包括不跑本 preset 的会话，所以「工具表里有 `duanju_gate`」**不是** `dsh-script` 的身份判据，判据是四位专家名。
> 写这份文档时的读数与目标态有出入，两句都记在这里：插件 `lib/` 今天注册的是**六件**工具（多出 `duanju_board`／`duanju_contract`／`duanju_template`），**剩三件是收缩后的目标态**（组合文件开头的 `THE DEPENDENCY HAS NOT LANDED YET` 一段，`dsh-script/agent.cordis.yml:46-53`，自己记着这一条）。复制 `dsh-script/` 到另一台机器**不会**带上这件插件。

## 快速开始

**前置条件**：已安装 DeepSeek Harness（`dsh`），Node.js ≥ 20。

```sh
git clone https://github.com/ABccgh/dsh-smith.git
cd dsh-smith

node bin/install.mjs                          # dsh-smith（默认）
node bin/install.mjs --preset dsh-forge       # dsh-forge
node bin/install.mjs --preset dsh-ck3-mod     # dsh-ck3-mod（还需要一个插件，见上）
node bin/install.mjs --preset dsh-duanju      # dsh-duanju（回落版）
node bin/install.mjs --preset dsh-script      # dsh-script（也需要一个插件，见上）
```

安装脚本把对应的 preset 目录复制到 `${DSH_HOME:-$HOME/.dsh}/.agent-presets/<id>/`。它**不会覆盖**已存在的同名预设（要替换请加 `--force`）。`--preset` 省略时默认是 `dsh-smith`，所以 `node bin/install.mjs` 的含义与以前完全一致。

脚本会先打印它选定的 home 与目标路径，并在该目录**缺少 harness 常见条目**（`profiles/`、`sessions/`、`storages/`、`settings.yaml`）时给出警告——把预设装进一个永远不会被扫描的目录是**静默失败**：复制成功，预设永远不出现。harness 装在别处就用 `DSH_HOME` 或 `--home <dir>` 指定。

`--force` 是**真正的替换**，不是合并：它先删除目标目录再复制。否则旧版本删掉的技能会留在磁盘上继续被加载，而你以为自己装的是新版本。

> ### ⚠️ 装完必须开一个**新会话**
>
> preset 在**会话启动时**挂载。**已经开着的会话不会获得它**——它继续跑自己启动时那套组合。装完在旧会话里问「怎么没生效」，是这件事最常见的困惑来源。
>
> 更隐蔽的一种：在会话中途切换预设，**会话头里的 `agentPreset` 字段不会跟着改写**，于是「记录」与「所见」不一致，很容易把排查引向错误方向。**判断依据以运行时工具表为准，不要以文件头为准。**
>
> **命令行没有 `--agent-preset` 这样的开关**（`dsh` 的选项族是 `--profile` / `--from-default-profile` / `--patch` / `--dump-config` / `--dump-default-config`）。预设由**会话启动时的选择器**选定，装完新开一个会话，在模式选择器里选「DSH 智能体工坊」「DSH 研发工坊 · DSH Forge」「CK3 模组工坊 · CK3 Mod Forge」「短剧工坊 · DSH Duanju」或「剧本工坊 · DSH Script」。
>
> **不需要重启 harness 进程**：`dsh-agent-presets` 的发现是**不缓存的**——`list()` 与 `resolve()` 每次调用都重读根目录（`lib/index.js:1152-1158` 原文：*"Discovery is unmemoized: `list()` and `resolve()` re-read the roots on every call so a preset authored while the process runs is visible immediately"*，实现见 `:1344-1346`）。**未实测**的是 GUI 模式选择器那一次刷新的时机。

## 验证状态

**按字面读。** 本仓库区分「已验证」「只做了静态检查」「未验证」，而**唯一算数的挂载检查有一个硬前提**。

### 挂载检查为什么需要出厂 `cordis` 预设的会话

动态插件探针（`cordis_define` + `cordis_run`）是唯一能在活着的 harness 进程里问到 `agentPresets.standingKeyFor(id)` 的路子，而它需要 `cordis_*` 工具。那套工具只在注册了 `tool-cordis` 行的组合里存在——实测的 live Loader 状态：

| 预设 | `tool-cordis` 行 | `cordis_*` |
| --- | --- | --- |
| 出厂 `cordis` | `enabled=true`，`fiberPhase=active` | **有** — 挂载检查在这里跑 |
| `dsh-smith` | `enabled=false`（`!!js` 门） | 无 |
| `dsh-forge` | 不含该行 | 无 |
| `dsh-ck3-mod` | 不含该行 | 无 |
| `dsh-duanju` | 不含该行 | 无 |
| `dsh-script` | 不含该行 | 无 |

原因是那四个 inspect provider 是**进程全局**的，宿主启动时就占用了它们的 id，所以其它组合必须把这一行关掉，否则整体挂载失败。

> **`node bin/verify.mjs` 不是那条挂载检查，而且换会话也救不了它。** 它自己 `new cordis.Context()` 起一个**裸 Cordis 运行时**，按定义不含 harness 注册表，所以 `agentPresets` 永远缺席，它**从任何会话都会打印 `INCONCLUSIVE`**——实测两次、输出逐字相同：一次在普通 shell，一次就在那个 `cordis_*` 齐全的出厂 `cordis` 会话里。它的头注释现在这么写着，它自己也会这么告诉你。**它是诊断工具，不是挂载判定。**

### 五个预设的验证结果

| | `dsh-smith` | `dsh-forge` | `dsh-ck3-mod` | `dsh-duanju`（回落版，HEAD） | `dsh-script` |
| --- | --- | --- | --- | --- | --- |
| 挂载（`standingKeyFor`） | **通过** | **通过** —— `MOUNTED OK` | **通过** —— `MOUNT OK`（出厂 `cordis` 会话，见下） | **通过** —— `mounted OK`（2026-09-21，出厂 `cordis` 会话；25 条目、24 行全 `ACTIVE`） | **未验证** —— **没有跑过**。（旧 preset 那次 `mounted OK` 是 `dsh-duanju` 的读数，**不是**这一版的：两个 composition 的行清单不同，所以它在这儿一个字都不证明） |
| 组合清单 | 36 行全部组合，**29 行 ACTIVE**，4 行按设计关闭 | 38 具名 = 3 group ＋ **35 叶**，其中 **31 激活**、2 `conditional`、2 关闭 | 27 具名 = 3 group ＋ **24 叶**，其中 **23 行 ACTIVE**、1 行 `disabled` 无 fiber | 28 具名 = 3 group ＋ **25 叶**（`preflight` 与 `drift-check` 都读到 28 行），**未做挂载清单** | `preflight --preset` 读到 **27 行**；**24 叶 ＋ 3 group 是按行差算出来的**（删 3 加 1，`tool-jobs` 保留），不是数出来的；**未做挂载清单** |
| 未激活／无贡献的行 | 无 | 无 | **无未激活行**：24 个叶行中 23 行 `fiberState = 2`（`ACTIVE`）、1 行 `disabled`；**贡献仍无读数** | **无读数** | **无 fiber 读数**；静态上 2 行按平台表达式 `disabled`（`tool-bash` 在 win32、`tool-pwsh` 不在 win32） |
| 静态预检（`preflight.mjs`） | `validated: 21   skipped: 10   failed: 0` | `validated: 24   skipped: 10   failed: 0` | **无法在 CI 跑** —— 见下（本机实测**通过**：`validated: 16   skipped: 9   failed: 0`，因为这台机器装了那个插件） | `validated: 17   skipped: 9   failed: 0`（HEAD-state 读数） | **通过** —— `rows: 27`、`validated: 16   skipped: 9   failed: 0`，退出码 0（`node bin/preflight.mjs --preset dsh-script`；这个 id 是写这份文档期间才补进注册表与 `package.json` 的，见下） |
| 技能 lint | 5 个全 clean | 4 个全 clean | 3 个全 clean | 8 个全 clean | **11/11 clean**（`node bin/lint-skills.mjs --preset dsh-script`，退出码 0）—— **但决定的技能数是 12**：盘上是 11 条，差的那一条见 [`docs/dsh-script.md`](docs/dsh-script.md) 第三节 |
| 工具到达模型 | 四条专家 ＋ 两条委派工具在表内，两条产品行缺席 | **32 项**，`run_code` 在，两条产品行缺席 | **未验证** | **用户转述的一次读数**：四位专家 ＋ `subagent_fork` 在表内，`workflow`/`ralph`/`subagent`/`tool-goal` 缺席；**无机器可读台账**，故按转述记名 | **未验证** —— 没有任何读数。（`dsh-duanju` 那一格是旧 preset 的转述读数，不能搬过来；而且这一版**没有** `subagent_fork`，判别键不同） |
| 只读角色过滤 | `expert_verifier` 强制生效（含差分对照） | `expert_verifier` 与 `expert_debugger` 强制生效；**在 PTC 下是「绑定不存在」而非「被拒绝」** | 设计上对 `expert_verifier` 用 `deny: [write, edit]`，未验证 | 设计上对 `expert_verifier` 用 `deny: [write, edit]`，未验证 | **不适用** —— 全表**没有** `toolFilter`：带 `deny: [write, edit]` 的 `expert_verifier` 行已被删除，其余三行刻意不加 |
| PTC / `tools:sdk` | 不适用（原生模式） | **可调用** —— 子代理 `await tools.glob(...)` 成功返回 15 条路径 | 不适用（原生模式） | 不适用（原生模式） | 不适用（原生模式） |

**`dsh-ck3-mod` 为什么这一列几乎全是「未验证」，而不是一句「已通过」：**

1. **它的挂载检查已经跑了（实测，在一个出厂 `cordis` 预设的会话里）——但这一列仍不写「已通过」。** `standingKeyFor('dsh-ck3-mod')` 正常返回（`MOUNT OK`），同一次 `compositionInventory()` 给出 **24 个叶行**、`broken: none`、**23 行 `fiberState = 2`**（`ACTIVE`）；唯一没有 fiber 的是因平台表达式而 `disabled` 的 `tool-bash`。**它证明的是「没抛错、每个启用行都 ACTIVE」，不是「每一行都贡献了模型可见的东西」**（D-40）——`tool-ck3-modcheck` 的 fiber 是 ACTIVE，**不等于** `ck3_modcheck` 出现在该预设的工具表里，所以「工具到达模型」那一格仍是**未验证**。逐条读数见 [`docs/dsh-ck3-mod.md`](docs/dsh-ck3-mod.md)。
2. **它的 `preflight` 不能在 CI 跑，因为 `tool-ck3-modcheck` 那一行引用的是本仓库不发布的插件。** `dsh-ck3-modcheck` 是宿主平面插件，从 profile 的 `node_modules` 解析；装了的机器上通过，没有 profile 的 runner 上必然 `Cannot find package`。按 `.github/workflows/checks.yml` 自己的规矩（**不能变绿的步骤要排除并写明理由，不许用 `continue-on-error` 糊过去**），这一条被排除，CI 里留给它的是 `lint-skills` 与 tarball 清单核对。
3. **`preflight` 对那一个插件的 config 其实也不做校验。** 实测 `bin/preflight.mjs:178` 只在 `typeof Config === 'function'` 时才读 schema，而该插件（与 `dsh-ima-kb` 同一写法）导出的是**普通对象**形式的 Standard Schema，所以它打印 `skip <id> (exports no usable Config schema)` 然后**跳过**。配置校验因此落在插件自己的 `test/falsify.mjs` 里——那一份是**实测通过**的：**121/121 断言**、**39 个检查 code**，6 类植入缺陷逐个点名，且对真实原版本地化文件零误报。这一点写清楚，比让读者以为 preflight 验过了要好。

**`dsh-script` 的读数：静态那一半有，挂载那一半没有。** 它的每一行都从**出厂包**解析 —— 那件 `dsh-duanju-script` 插件是**宿主面**的，组合里没有它的行 —— 所以 `node bin/preflight.mjs --preset dsh-script` 通过：`rows: 27`、`validated: 16   skipped: 9   failed: 0`、退出码 0。**挂载判定 `standingKeyFor('dsh-script')` 没有跑过** —— 它需要一次跑在出厂 `cordis` preset 上的会话，而写这份文档的会话做不到（没有 `cordis_*` 工具），所以「挂载」与「工具到达模型」两格都写**未验证**。挂载检查回答四个不同的问题，`ACTIVE` 只决定其中一格：

| 问题 | 判据 | `ACTIVE` 蕴含它吗 |
| --- | --- | --- |
| 这一行**能不能挂上** | `standingKeyFor` 不抛（`dsh-agent-presets/lib/index.js:1763-1800`） | —（那就是它自己） |
| 这一行**尝试过注册且没抛** | `ctx.tools.register(...)` 抛不抛（`dsh-tools/lib/index.js:2773-2782`；重名 `:2538`；投影 `:2937`） | **是** —— 抛了就是 `FAILED(3)` |
| 这一行**真的注册了** | `mount(provider)` 是否跑过 | **否** |
| 这个工具**在当前 scope 可见** | `tools.get(name, scope)` / `view(scope).visible`（`dsh-tools/lib/index.js:2854-2880`） | **否** |

**`ACTIVE` 与「注册了什么」之间没有蕴含关系**，而这两格在库代码里都能直接读到：`register` 的调用点
（`dsh-tool-subagent/lib/index.js:398`）在一个**闭包** `mount(provider)` 里，而 `mount` 只在 `:574`
（provider 已在场）与 `:566`（provider 后来出现）被调用 —— **provider 缺席时它不跑，`:575` 只记一条 `info`，
`apply` 正常返回**；`:568-572` 还会在 provider 被移除时 `disposeTool()`；`:579` 那段提示是活状态的函数，
当 `mounted === void 0` **或** `tools.get(toolName, context.scope) === void 0` 时返回空串 ——
**「没注册」与「注册了但这个 scope 看不见」是库自己并列的两个状态**。
所以**「一行可以挂上而什么都不注册」是对的**（D-105 更正了 D-104 第 2 条曾判它「时序上不成立」的说法，
而那条错落在危险的一侧：把一条真实的假通过通道写成了已排除）。「工具到达模型」问的是后两格，
`ACTIVE` 与 `standingKeyFor` 都不回答它们。

**为什么不能把旧 preset 的那次读数搬过来：** 2026-09-21 的 `mounted OK`、以及随之而来的 `compositionInventory`（25 条目、24 行 `fiberState: 2`、`tool-bash` 无 fiber）是在 **`dsh-duanju`** 上跑的 —— 另一个 composition，行清单与专家都不同。它证明的是**旧 preset 挂得上**，对 `dsh-script` 一个字都不证明。要拿到同样的东西，得在新 preset 上重跑一次探针。

**2026-09-21 之后收到一次用户转述的读数**（一个 `dsh-duanju` 会话）：工具表里有 `expert_script` / `expert_board` / `expert_verifier` / `expert_chronicler` / `subagent_fork`，且没有 `workflow` / `ralph` / `subagent` / `tool-goal`。**那是旧 preset 的验收判别键，不是 `dsh-script` 的** —— 后者的判别键是 `expert_script` / `expert_doctor` / `expert_dialogue` / `expert_continuity`，且**没有** `subagent_fork`（该行已从这个 preset 里删掉）。`dsh-script` **没有任何工具表读数**，转述的也没有。那条旧读数按转述记名（本机没有该会话的机器可读台账）；它证明**可达性**，不证明**逐行贡献**（某个工具被委派后真的跑起来），后者仍是 D-40 留的那一格。

> **一条结构性后果：** 真正能回答可达性的活读 —— `Tool.listTools`，返回「本 agent 当前可调用的每个工具」（`dsh-tool-cordis/lib/index.js:9038-9052`）—— 只存在于装了 `tool-cordis` 的会话，而 `dsh-duanju` 与 `dsh-script` **恰恰都没有**那一行。**两个短剧 preset 都无法自验自己的工具表**；`dsh-duanju` 的读数来自另开一个会话、或由用户看一次，而 **`dsh-script` 连那样的读数也还没有**。而 `preflight` 通过只说明「每一行都解析得到、每个能读的 config 都过了它自己的 schema」，它自己会告诉你它看不见什么：**激活了但什么都没贡献的行、泄漏到根 realm 的服务、以及写在 `apply()` 而不是 schema 里的校验**。步骤与探针源码在 [`docs/dsh-script.md`](docs/dsh-script.md)。

**详细依据与逐条读数**在各预设自己的文档里：[`docs/dsh-smith.md`](docs/dsh-smith.md#验证状态)、[`docs/dsh-forge.md`](docs/dsh-forge.md#验证状态)、[`docs/dsh-ck3-mod.md`](docs/dsh-ck3-mod.md)、[`docs/dsh-script.md`](docs/dsh-script.md#验证状态)。（`dsh-duanju` 的旧文档已随这次窄化改名为 `docs/dsh-script.md`，它现在记的是窄化版；回落版的读数就留在上面这张表的它那一列里。）

### 未验证，且不声称

- **冷进程**里的挂载是否同样干净——推断（`!!js` 门读 `process.platform` 与 `cordisInspect`，冷进程同值），未实测：实测它要另起一个 harness 进程。
- **`expert_verifier` 在 `dsh-forge` 下未单独委派**——它与 `expert_debugger` 的 `toolFilter` / `provider` / `maxDepth` / `backgroundMode` 逐字对等，所以「测一条覆盖两条」是**由配置对等推出**，不是实测。
- **`restrict()` 本身**造成了拒绝（而非其它同效机制）；**`toolFilter` 遇到未知名字是否 fail-loud**、与 `allow` 如何组合。
- **`dsh-forge` 的 `repeat-tool-reminder` 行与宿主的同名行共存**是否会让提醒出现两次——未测。
- ~~**`dsh-duanju` 的挂载**~~ —— **2026-09-21 已实测通过**（`mounted OK`），见上表。**它上方的「工具到达模型」已收到一次用户转述的读数**（四位专家 ＋ `subagent_fork` 在表内、四条按设计缺席的行不在），见上；**仍未测**的是同族的一条：`dsh-duanju` 也会与宿主的 `repeat-tool-reminder` 行共存，是否双提醒。**并且「读数存在」不等于「它可复现」：** 承载该读数的会话自己的头写着 `agentPreset: "standard"` —— 会话文件只有 200 字节、仅一行 header（本机实测：`zstdDecompressSync` 解出 `{"type":"session","version":3,…,"agentPreset":"standard"}`，无任何 turn／工具调用记录）。**会话头不是挂载结果**，所以这条读数的判据只能是工具表本身，别的都算不上。
- **`dsh-script` 的挂载与工具表**——**两条都没有读数**：`standingKeyFor('dsh-script')` 没有跑过，它的工具表也没有被任何会话看过。上面 `dsh-duanju` 那两格是**另一个 composition** 的读数，`dsh-script` 不继承它。同族的未测一条：`dsh-script` 也会与宿主的 `repeat-tool-reminder` 行共存，是否双提醒。
- **那三件 `duanju_*` 工具是否真的到达模型**——未验证：它们的注册在**宿主面插件**里，组合里没有它们的行，所以 `preflight` 对它们**什么都不说**。而且插件今天注册的是**六件**、目标态是**三件**，这个差要等插件收缩落地后才读得准。
- **GUI 模式选择器何时反映一个新装的 preset**——源码只证明 `list()` 不缓存，界面侧的刷新时机未实测。
- **有戏AI 的私有 HTTP 接口在给定凭证下是否真的可用**——工作区里没有任何凭证，也**没有发出过任何请求**。枚举出来的端点全部是**读前端产物**得到的，不是调用验证。

## 仓库结构

```
bin/                 九个文件，五个预设共用
  presets.mjs        唯一的预设登记表：id、源目录、上游预设、预期工具
  install.mjs        安装（--preset / --force / --home）
  preflight.mjs      静态检查：解析每一行的包 + 用插件自己的 schema 验证配置
  verify.mjs         诊断：本机 CLI 能否触及 harness 运行时（不是挂载判定）
  lint-skills.mjs    技能 frontmatter
  drift-check.mjs    与各自的出厂上游逐行比对（只报告，不同步）
  check-pack.mjs     读**打包产物**（不是工作树）：唯一能看穿 files 白名单遗漏的检查
  push-api*.ps1      走 REST 推送（本机 git 的 TLS 层不通，见 AGENTS.md）
dsh-smith/           preset 源目录（组合 + preset.yml + 5 个技能）
dsh-forge/           preset 源目录（组合 + preset.yml + 4 个技能）
dsh-ck3-mod/         preset 源目录（组合 + preset.yml + 3 个技能）
dsh-duanju/          preset 源目录（组合 + preset.yml + 6 个技能：分镜与成片那一段）
dsh-script/          preset 源目录（组合 + preset.yml + 11 个技能 —— 实测数，`lint-skills` 报 11）
docs/
  dsh-smith.md       逐预设文档
  dsh-forge.md
  dsh-ck3-mod.md
  dsh-script.md
  agent-notes/       本仓库自己的记忆层：PROJECT / DECISIONS / BOARD
AGENTS.md            给 agent 的工作区规则（自动加载）
```

**`dsh-ck3-mod` 的那一个插件不在这个仓库里。** `dsh-ck3-modcheck` 装在 `$DSH_HOME/plugins/` 下、由 profile 的 `cordis.patch.yml` 一行 `insert:` 挂载——这是本仓库既有的模式（同 `dsh-account-balance`、`dsh-ima-kb`、`dsh-desktop`），也是 `AGENTS.md` 规则 7 的边界：本仓库只发布 preset，Cordis 插件由 `dsh plugin --profile <profile> add <path>` 写入 profile 的依赖图。复制 `dsh-ck3-mod/` 到另一台机器**不会**带上它。**`dsh-script` 的那一件（`dsh-duanju-script`）同理**，差别是它从 `D:\dsh-duanju-script\` 以 `link:` 挂进 profile，不在 `$DSH_HOME/plugins/` 下——见上面的插件小节。

**两个短剧 preset 与插件的关系，一节说清，因为它们方向相反。** `dsh-script` **需要**那件宿主面插件才有三件剧本域工具，但它的组合里**没有**那一行（preset 只消费、不提供）；`dsh-duanju`（回落版，HEAD）**不带任何插件行**，因为它的平台侧步骤（登录、剧本粘贴、分镜表导入、生成、发起评估、发布）**只能由人在网页上做**——有戏AI 没有 CLI、没有公开 API，工作区里也没有它的凭证，所以那个 preset 里没有任何一行引用插件、也没有任何配置键写着一个 token。**但要注意那三件 `duanju_*` 工具对每一个会话可见**（宿主面注册进 `ctx.tools`），所以它们既不是 `dsh-script` 的身份判据、也不意味着 `dsh-duanju` 有了平台能力。逐条见 [`docs/dsh-script.md`](docs/dsh-script.md)。

## 仓库之外的插件

本仓库只发布 preset（规则 7）。下面**四个**是**独立仓库**（`dsh-duanju-script` 是本地 git 仓库、没有远端），各自单独克隆与安装，**都不在本仓库的 tarball 里**。
**这几个不是全部** —— `$DSH_HOME/plugins/` 下还有 `dsh-ima-kb`，同样带 `.git`、
同样不属本仓库（实测 2026-09-24：该目录 **7** 个插件里有 **4** 个带 `.git` —— `dsh-account-balance`、
`dsh-agent-memory`、`dsh-ck3-modcheck`、`dsh-ima-kb`；未列于此表是因为它们与任何 preset 的能力面无关）。
**`dsh-inbox`（待办收件箱）已于 2026-09-24 移除** —— 插件目录（含它自己的 `.git`）、profile 依赖、
那一行 `insert:`、以及五处把它当作交付机制的提示词引用，一并删除。它的接口面、它同时是
`ask_user_question` 持久通道这件事、以及重建时省事的三条实测理由，见 `docs/agent-notes/DECISIONS.md` **D-115**：

| 插件 | 做什么 | 承载它的 preset |
| --- | --- | --- |
| [`dsh-ck3-modcheck`](https://github.com/ABccgh/dsh-ck3-modcheck) | 按**原版游戏安装**的判据校验 CK3 模组：`.mod` 与文件夹配对、`descriptor.mod`、路径全 ASCII、本地化 BOM 与 `l_english:` 首行、脚本括号配平；另读启动器 playset 与运行时日志 | `dsh-ck3-mod`（宿主平面一行 `insert:` **点名**它） |
| `dsh-duanju-script` | 剧本域三件工具：`duanju_gate`（结构化闸门四态）、`duanju_recall`（只读状态投影）、`duanju_checkpoint`（受管区块）。住在本地 `D:\dsh-duanju-script\`，以 `link:` 挂进 profile，**不在** `$DSH_HOME/plugins/` 下 | `dsh-script`（宿主平面一行 `insert:`，**但组合里没有引用它的行**） |
| [`dsh-agent-memory`](https://github.com/ABccgh/dsh-agent-memory) | **经验层**：把记录下来的教训蒸馏进 `~/.dsh/AGENTS.md` 里一个受管区块，该区块**每个会话每一轮自动加载** | 与 preset 无关（宿主平面，因此五个 preset 都获得它） |
| [`dsh-account-balance`](https://github.com/ABccgh/dsh-account-balance) | Web GUI 的余额徽标（宿主侧 `GET /api/balance` ＋ 浏览器侧 sidebar 徽标） | 与 preset 无关 |

**`dsh-agent-memory` 的边界值得写下来，因为它最容易被高估**：它**不是学习**——本部署没有权重更新路径。它做的是**保证检索**：凡是写进 `LESSONS.md` 的，都会出现在每个会话的每一轮里。对**没有人记录过的**教训它一无所知。另外，**在沙箱会话里它只生成、不落盘**：插件写文件走的是被沙箱包住的 `fs` 接缝，`workspace-write` 会拒绝写 `~/.dsh`——这是保护在起作用（agent 不该能悄悄改掉那份指导每个会话的文件），不是缺陷。

**`bin/preflight.mjs` 通过不等于能挂载**，它自己会这么说。它看不见的三类恰好是最要命的：激活了但什么都没贡献的行、泄漏到根 realm 的服务、以及写在 `apply()` 而不是 schema 里的校验。另外它**不拒绝未知配置键**（schemastery 对多余的键不报错），所以把键名敲错但必需字段仍在的情况它看不见。

**`npm run check` 在 harness 之外会以退出码 1 结束，这是设计如此。** 它把 `lint`、`preflight`、`verify` 串起来跑，而 `verify` 把「没检查」当作不通过。所以本仓库**不适合**直接把 `npm run check` 放进 CI：CI 里请只跑 `node bin/lint-skills.mjs && node bin/preflight.mjs`（纯静态、退出码可靠）。`npm run check:all` 覆盖 `dsh-smith` 与 `dsh-forge`；`dsh-ck3-mod` **故意不在其中**，因为它的 preflight 依赖那个本仓库不发布的插件（原因见上面的验证状态一节 —— **本机实测它通过**：`validated: 16   skipped: 9   failed: 0`、退出码 0，而这与「CI 里不能跑」并不矛盾：这台机器装了那件插件，runner 上没有 profile）。`dsh-duanju` 与 `dsh-script` 的 preflight **都能在 CI 跑**：前者每一行都从出厂包解析；后者同样，因为它的插件是**宿主面**的、组合里**没有引用它的行**，所以 runner 上不会缺包。`.github/workflows/checks.yml` 里已经给 `dsh-duanju` 配了那两步，**也给 `dsh-script` 配了同样的两步** —— 后者按 id 就能跑，因为 `bin/presets.mjs` 与 `package.json` 的 `dsh.presets` 在写这份文档期间都补上了这个 id（两处都改，缺一处这两条命令就按 id 报 `unknown preset`）。

## 许可与来源

MIT。见 [LICENSE](LICENSE)。

`dsh-smith/skills/` 下的 `editing-cordis-compositions` 与 `cordis-plugin-development` 复制自 DeepSeek Harness 官方发行包 `@deepseek-ai/dsh-agent-presets` 的 `cordis` 预设，遵循其 MIT 许可，版权归 DeepSeek 所有。`dsh-ck3-mod/skills/` 下的 `dsh-runtime-reference` 同样复制自 `dsh-smith`，属本仓库原创内容。

`dsh-duanju/skills/` 里有三个技能（`dramaturgy`、`hook-ladder`、`shotlist`）源自本机的**用户自建 preset** `dsh-aivideo`，该 preset 不在本仓库内、也不由本仓库发布；复制是单向的，`dsh-aivideo` 从未被本仓库修改。其中 `shotlist` **不是逐字复制**：它被按代码校正（25 列 → **28 列**）并记录了一次方向搞反的「更正」。其余内容（含 `dsh-forge` 的四个技能、`dsh-ck3-mod` 的另外两个技能，以及 `dsh-duanju` 的另外五个技能）为本仓库原创。

`dsh-script/skills/` 里只有**两个**技能（`dramaturgy`、`hook-ladder`）源自 `dsh-aivideo`，同样是单向复制。源文件里第三个来自它的技能 `shotlist` **不随这一版** —— 分镜表与列契约整体出了范围，一份说着「28 列」的技能留在这里只会是一条会静默过期的契约；`dsh-runtime-reference` 也不随这一版。新加的两个技能（`script-rules`、`script-review`）与其余内容为本仓库原创。**注意上面那条 28 列的更正记录仍然属于 `dsh-duanju`（它还在仓库里、还是那个列契约的持有者），不属于 `dsh-script`。**

**本仓库不分发、不缓存任何游戏、wiki 或平台语料。** `dsh-ck3-mod` 只携带**方法**——`.mod` 布局、本地化编码、脚本语法、交付前必须跑 `ck3_modcheck`——而每一条判据要么来自运行时的校验插件对**用户本机原版安装**的读取，要么来自模型的 `web_fetch` 现场抓取的 CK3 Wiki 页面（该站页脚声明其内容为 **CC BY-SA 3.0**，版权归其各自作者）。`tools/ck3wiki/` 是上一轮取消的镜像项目留下的工具，**不在本仓库发布的 tarball 里**（见 `AGENTS.md` 规则 7）。

`dsh-duanju` 同理：它不分发、不缓存有戏AI 的任何前端产物。它携带的是**方法**与**引用**——三份官方模板的**列名**（列名是接口契约，不是创作内容）、闸门条件与评级映射的**引文及其出处**、28 列本地表的字段定义。凡是引自平台的地方都标了出处与读法。

`dsh-script` 比它更窄，同一条承诺成立：**平台模板与 28 列分镜表已整体移出范围**，所以它携带的只有**方法**与**带出处的引文**（闸门条件与评级映射的原文），以及本工作台自己的篇幅实测（2 526 字 → D 55.7；20 554 字 → A 82.6）。凡是引自平台的地方都标了出处与读法。
