# CK3 模组工坊 · CK3 Mod Forge

专门用于 **Crusader Kings III 模组开发** 的 DeepSeek Harness agent preset：一个游戏、一件事——写能加载的 mod。语法与格式主张一律锚定在 CK3 Wiki 的 modding 页面（经 `web_fetch` 读取，带 revid）或本机原版安装的真实文件上；交付前必须跑 `ck3_modcheck` 并把输出逐字写进答案；三层项目记忆由常驻史官维护。

> A DeepSeek Harness agent preset for **Crusader Kings III mod development only**: every syntax and layout claim anchored in a CK3 Wiki modding page read through `web_fetch` or in a file of the real vanilla installation, `ck3_modcheck` run before every delivery with its output quoted verbatim, and a three-layer project memory kept by a resident chronicler.

**这是窄化后的预设。** 它取代的 `dsh-ck3` 同时服务「战局咨询」与「模组开发」两种模式，语料取自 ima 知识库；用户要求收窄到只做模组开发后，本预设只保留后一半：检索行（`tool-ck3-*`）、知识库通道、以及三条咨询类专家行（机制／史实／战略）都不再组合。前身目录由 lead 删除；本文件与 `dsh-ck3-mod/` 才是当前定义。

| | |
| --- | --- |
| 预设 id | `dsh-ck3-mod` |
| 显示名 | CK3 模组工坊 · CK3 Mod Forge |
| 安装路径 | `${DSH_HOME:-$HOME/.dsh}/.agent-presets/dsh-ck3-mod/` |
| 血统 | 出厂 `standard` 预设 ＋ 本文件三大支柱（与 `dsh-forge` 同为 `standard` 派生，**不是**从 `dsh-smith` 派生） |
| 宿主依赖 | 只有一个**仓库外** Cordis 插件：`$DSH_HOME/plugins/dsh-ck3-modcheck`（宿主平面，按包名消费） |

## 与 `dsh-smith` / `dsh-forge` 的分工

同一个仓库里现在有**四个**预设；本表只比其中三个（`dsh-duanju` 见 [`docs/dsh-duanju.md`](dsh-duanju.md)），定位不同，互不覆盖：

| | `dsh-smith` | `dsh-forge` | `dsh-ck3-mod` |
| --- | --- | --- | --- |
| 做什么 | 造 DSH 智能体、写 Cordis 插件 | 交付软件 | **只写 CK3 mod** |
| 事实来源 | 安装包与运行时 | 代码与运行时 | **CK3 Wiki modding 页面（`web_fetch` ＋ revid）或本机原版安装的文件** |
| 交付前检查 | 无固定门 | 跑测试 | **`ck3_modcheck` 必跑，输出逐字进答案** |
| 专家角色 | 架构 / 验证 / 平台 / 编年 | 架构 / 验证 / 调试 / 平台 / 编年 | **模组作者 / 验证者 / 史官**（三条） |
| 计划协议 | 组合设计（平面 / realm / 行清单） | 软件工程（改动面 / 接口 / 边界 / 验收） | **四段**，第 ② 段是逐条标注 `verified`／`unread` 的证据清单 |
| 记忆层 | `AGENTS.md` ＋ `docs/agent-notes/` 三层 | 同上，另加 `RUNBOOK.md` | `MODDING.md` ＋ `docs\mod-notes\` 三层；**游戏机制结论不进记忆层** |
| 自省工具 | `tool-cordis` 行（本部署下恒关） | 不含该行 | 不含该行 |

## 安装与使用

### 两个前置条件（缺一个，工具或预设都不出现）

**① 宿主依赖：唯一一个插件，在仓库外。** 本机**已经装好**——实测 `profiles/web/package.json` 有
`"dsh-ck3-modcheck": "link:C:/Users/曦曦/.dsh/plugins/dsh-ck3-modcheck"`，`cordis.patch.yml` 里有对应的
`ck3-modcheck` 行（带 `modDir: 'D:\CK3Mods'`）。在一台还没装的机器上这一步是：

```sh
dsh plugin --profile web add "$DSH_HOME/plugins/dsh-ck3-modcheck"
```

这一步只改 profile 的依赖图。**必须重启 Host**，因为那一行是宿主组合在启动时挂载的；不重启，`ck3_modcheck` 工具不存在，本预设的交付律就没有执行者。**本机已完成过重启**（见「验证状态」挂载检查一节）；插件代码**再次改动之后仍需要下一次重启**——这一点工具自己会在每次报告末尾打印「代码回执」（PID、启动时间、`lib/*.js` 的 mtime），据此判断运行中的是哪一版。

**② 预设本体。** 装它：

```sh
cd dsh-smith
node bin/install.mjs --preset dsh-ck3-mod
```

或在模式选择器里选 **「CK3 模组工坊 · CK3 Mod Forge」**。

> ### ⚠️ 必须开一个**新会话**
>
> preset 在**会话启动时**挂载，已经开着的会话不会获得它——包括正开着的那一个。装完请新开一个会话。`dsh` 的选项族是 `--profile` / `--from-default-profile` / `--patch` / `--dump-config` / `--dump-default-config`，`dsh web` 的是 `--host` / `--no-open` / `--port` / `--trusted-host`，`@deepseek-ai/**` 里**没有任何包**含 `--agent-preset` 这个字符串：没有命令行开关可以选预设。

## 三大支柱

### 1. 写对：格式律

一个 mod 的典型失败**不是报错，而是在磁盘上成功、被游戏静默忽略**。`.mod` 文件与文件夹不同名、本地化文件没有 UTF-8 BOM、脚本花括号不配对——这三件事在任何地方都不报错：游戏读它读到的，对跳过的东西一言不发。

所以 persona 的 `prefix` 把每条语法／布局主张钉在两个来源之一：

- 本次会话经 `web_fetch` 读过的 CK3 模组页面——`Mod structure`、`Scripting`、`Localization`、`Mod troubleshooting`、`Mod compatibility`；
- 本机原版安装里的真实文件：`D:\Program Files (x86)\Steam\steamapps\common\Crusader Kings III`。

**没读过的标 `unread`，不断言。** 每条规则要能引到页面或文件路径。Wiki 的版本横幅记录的是"上次核对时游戏是哪个版本"，不是"现在游戏怎么跑"——本次实测：`Mod structure` 页停在 **1.1**（revid 18579），`Localization` 页停在 **1.4**（revid 32485），而本机安装的 `launcher-settings.json` 写的是 **1.19.0.6 (Scribe)**。一个页面可以看起来很权威而落后八年。

### 2. 交付前检查：`ck3_modcheck`

**每一次交付前必须跑 `ck3_modcheck`。** 它的输出是答案的一部分，**逐字**——确切的命令、它打印的内容、以及它**没有**检查的东西。

一个没被检查的文件要报成**未检查**，不能当成能用来交付。检查跑不起来就明说，并说清留下了什么未验证。

它校验的是**磁盘上的格式、路径、编码、标识符与花括号配对**（`lib/rules.mjs` 的 `CODES` 有 **36** 个 code）：两个 `.mod` 文件与命名；`.mod` 的**必需键**（`version`/`name`/`path`，wiki 的 Required 表）与**空值**；`supported_version` 缺失（仅同级文件，`descriptor.mod` 里 wiki 明说非必需）；`descriptor.mod` 与同级文件在 `version`/`supported_version` 上**是否一致**；`path` 指向是否存在、是否全 ASCII、**是否就是这个 mod 自己的文件夹**、以及值**有没有加引号**；`replace_path` 是否指向原版存在的目录（不存在=error，存在=说明它会**不加载**该目录下的原版文件）；**同名同路径覆盖原版文件**（会**替换整个文件**，而 `common\holdings`／`common\traits` 这类单文件数据库是 error）；每个本地化 `.yml` 的 BOM、`l_<语言>:` 首行、条目形状、**同一文件内重复键**、以及是否落在语言目录里（含 wiki 记录的 `localization/replace/<lang>/` 与 `localization/<lang>/replace/` 两种覆盖写法）；脚本 `.txt` 的**花括号平衡**、**不能带 BOM**（本地化必须带、脚本必须不带）、以及**必须是合法 UTF-8**（UTF-16 或 Windows-1252 单独报）；`events\` 文件**是否声明 `namespace`**、事件 id 前缀是否等于它、id 是否 ≤9999、以及是否根本没有事件；`common\` 子目录是否有原版对应物（拼写提示）；顶层目录**大小写**是否与原版一致（Windows 能跑、Linux 会全灭）；脚本目录下**无扩展名或其他非脚本后缀**的文件。

**另外三个工具**（同一个插件注册，都不发布服务）：

| 工具 | 做什么 |
| --- | --- |
| `ck3_mod_init` | 从零生成一个最小但**可加载**的 mod 骨架（两个 `.mod` ＋ 带 BOM 的本地化 ＋ 按 `systems` 的 events／decisions 样例），**生成后立刻用 `ck3_modcheck` 自证**并把报告附上；默认**绝不覆盖**已存在文件（`ifExists="overwrite"` 才重写），支持 `dryRun`，并拒绝非 ASCII 的 mod 名 |
| `ck3_mod_status` | 只读启动器的 `launcher-v2.sqlite`（用内置 `node:sqlite`，无依赖、无子进程），报告启动器眼中的模组状态与当前 playset 的 `enabled`／`position`（**position 就是加载顺序**——wiki：playset 里靠下的覆盖靠上的），并与磁盘交叉判定「死条目」与「启动器自己判定为坏」的模组 |
| `ck3_mod_evidence` | 读 CK3 的**运行时日志**，给出静态检查**结构上给不了**的那一面：**引用但从不触发的事件**（`event_log.csv` 逐事件记录被检查次数，`checked=0` 即在说没有任何东西调用它）。严格区分三态：目录不存在／存在但全 0 字节（尚未 flush，**不等于没有错误**）／有内容（**也不等于有问题**） |

**`ck3_mod_evidence` 为什么必须谨慎**：游戏**不启用任何 mod** 启动时，`setup.log` 里就已经有 **512 条原版自身的 W 级告警**（实测，例如 `provincetemplate.cpp: Province 10186 has no pixels!`），wiki 也明说 *"the log will report errors even in an unmodded game"*。所以这个工具**只统计与报告，绝不把「日志非空」当成缺陷**；唯一产生 finding 的是事件可达性——那一条关于**你自己的内容**。日志行格式（`[HH:MM:SS][级别][源:行]: 消息`）同样是实测的，解析不出来的行会被**计数**而不是丢弃：格式变了必须看得见。

**`ck3_mod_status` 为什么值得单独一个工具**：静态检查**永远回答不了** mod 作者真正会问的三个问题——*启动器到底认不认这个 mod？它在 playset 里启用了吗？它排在谁后面？*——而这三个答案**已经在磁盘上**（启动器的数据库里），只是没人读。启动器自己的 `status` 列比本工具算出的任何结论都更有权威，因为它是拿真实游戏数据校验的。

**它不能证明游戏会加载这个 mod**，这是最重要的限制，写在它的报告收尾处，persona 的 `prefix` 与 `suffix` 也复述了。

**`path=` 的格式不再是未知项。** wiki 的 `Mod structure` 页给出三种写法并说明基准：`path="mod/my_mod"` 是「相对，任何系统」且**相对用户文件夹**（不是游戏主目录），完整绝对路径也可用；其 Tips 还专门提醒引号是必需的。所以本条限制已**撤销**——原先「格式未验证」的措辞是在只读了页面一部分时写下的，现已被同一页的 Keys 表推翻。

**真正剩下的运行时盲区（本机现在有一部分可读了，而且第一次读数就推翻了「启动器说了算」这个假设）**：CK3 会把运行时证据写进 `Documents\Paradox Interactive\Crusader Kings III\logs\`，游戏在本机已经启动过多次，`logs\` 里现在有 **18** 个文件。三条实测：

1. **日志是「每次运行」的**——下一次启动会把它们重写。D-75 那次 `event_queue` 的现场已经不在当前 `debug.log` 里了，所以任何跨运行的归因都不成立；`ck3_mod_evidence` 现在会在报告顶部标出本次运行的起点，并在每次调用末尾附「代码回执」。（唯一的例外是 `console_history.txt`，它跨运行累积。）
2. **`event_log.csv` 仍然不存在**，而且现在知道它在本 build 里不会被创建（`event_queue` 跑通了、只写 `debug.log`、不写文件）。所以「引用但从不触发的事件」这条检查是**已实现、已测试、未在真实数据上触发过**——缺能力，不是通过。
3. **「启动器说了算」是错的**——这是最新、也最重要的一条。同一次运行里，游戏自己的 `debug.log` 列出一张 mod 表并写出它**实际挂载**了什么：`Mounted Data: D:/CK3Mods/jtdx`，随后 `>=== NAMESPACE > 'jtdx' is set to #3520000` 与 `Loaded [6] events from 'events/jtdx_events.txt'`。也就是说**本工坊真的产出过一个被游戏加载、事件被注册的 mod**（那是这个工作区里已有的 jtdx mod，而它现在已不在 `D:\CK3Mods`，目录已空）——而它的 `.mod` 文件名 `mod/jtdx.mod` 在**启动器数据库里没有对应行**，`dlc_load.json` 的 `enabled_mods` 里也没有它。同一份日志里，七个 workshop mod 只有两个标 `Enabled`，而 `dlc_load.json` 列了七个、启动器 playset 七个全 `enabled=1`。**三个来源互相矛盾，而权威的那个是游戏自己那份带时间戳的单次运行日志**——`ck3_mod_status` 读的是启动器数据库，属于较弱的一侧，其报告已经改成把「读到 0 条」与「没有模组」分开陈述。

### 3. 记住项目：三层记忆，机制结论除外

| 层 | 文件 | 生命周期 |
| --- | --- | --- |
| 规则 | `MODDING.md`（自动加载） | 持久，**由用户在自己的工作区维护**；本预设的指令候选列表把它纳入了发现范围 |
| 编年 | `docs\mod-notes\PROJECT.md` | 持久，就地编辑；每行带来源 |
| 决策 | `docs\mod-notes\DECISIONS.md` | **只追加**；一条一决定，含否决方案与推翻条件 |
| 工作板 | `docs\mod-notes\BOARD.md` | 易变，随意重写 |

`agent-instructions` 行把 `instructionFileCandidates` 设为 `AGENTS.md` / `CLAUDE.md` / `MODDING.md`，本地覆盖候选为 `AGENTS.local.md` / `MODDING.local.md`。**这些候选是在会话的工作目录树里发现的**（`dsh-agent-instructions/lib/index.js:578`：`for (const dir of ancestorChain(projectRoot, cwd))`），项目根由 cwd 向上找到第一个含根标记的目录。所以把一份 `MODDING.md` 拷进预设目录**永远不会被加载，而且不会报错**——预设目录不是任何会话 cwd 的祖先。`MODDING.md` 缺失是要告诉用户的事，不是靠拷贝去"修"的事。

`CK3.md` **故意不在候选里**：它是前身预设的规则层，咨询那一半没了，它就没有可管的东西。

**为什么不把机制结论写进记忆层。** 一个 modifier 干什么、一个事件要什么条件、一个 scope 怎么解析——这些属于 Wiki，必须以引用（页面 URL ＋ revid）旅行。把它们冻结进 `PROJECT.md`，就是在往一个会被下个补丁悄悄作废的文件里，写死某个补丁的答案；那份记忆于是做了与职责相反的事：让下一个会话**自信地错**，而不是仅仅不知道。判据一句话：**如果这句话在数值不同的游戏里仍然成立，它属于记忆层；如果它带着一个数字、一个 scope 或一个键名，它属于 Wiki，并且带着 URL。**

## 行清单

**27 行具名** = 3 个 group 容器 ＋ **24 行叶子**。这个数是数出来的，不是估的：顶层 17 行 ＋ `thinking` 组 1 行 ＋ `compaction` 组 3 行 ＋ `team` 组 6 行。按职责分组来看：

| 平面 | 行 |
| --- | --- |
| 身份与指令 | `persona`、`agent-instructions`、`skill-filesystem`、`tool-skill` |
| CK3 工具（宿主插件） | `tool-ck3-modcheck` |
| 计划（realm `planMode`） | group `thinking` → `plan-mode` |
| 压缩（realm `compaction`、`toolResultPruner`） | group `compaction` → `compaction-basic`、`command-compact`、`tool-result-pruner` |
| 团队（realm `workflowEngine`） | group `team` → `tool-subagent-control`、`tool-subagent-list-agents`、`tool-subagent-fork`、三条专家行 |
| 宿主服务消费 | `tool-bash`、`tool-pwsh`、`tool-fs`、`tool-fs-search`、`tool-jobs`、`tool-todo`、`tool-web`、`repeat-tool-reminder`、`present` |

**realm 规则**：宿主已提供的服务（`tools`、`systemPrompt`、`skills`、`subagents`、`jobs`、`fs`、`shell`、`tokenMeter`）**一律从宿主消费、不进任何 realm**；只有预设自己拥有、且 agent 之外无人读的服务才进 realm。三处 realm 是 `planMode`、`compaction`＋`toolResultPruner`、`workflowEngine`；`compaction-basic` 经 `ctx.get` 读 `toolResultPruner`，所以那一对**必须同 realm**——消费者留在 realm 外会解析到宿主注册表，而宿主没有，于是"挂载成功但压缩静默不生效"。

**`tool-ck3-modcheck` 为什么不进 realm**：它只往宿主 `tools` 注册表注册一个工具、**不发布任何服务**（`dsh-ck3-modcheck/lib/index.js:65` 的 `inject = ['fs']` 就是它消费的全部）。发布不了东西的行不会泄漏到根 realm；而只消费宿主注册表的行**必须**待在 realm 外，包起来就会解析到本预设从未填充的注册表。它按**包名**从 profile 目录的 `node_modules` 解析，和 `dsh-ima-kb` 完全一样。

**`team` 组为什么还留着 `workflowEngine` realm**：今天没有 workflow 行，那个 realm 里装着一个没人消费的服务。留着是因为 realm 是"这个组拥有它"的声明，而不是"今天有人在用"；把行加回来时应该是改一行，而不是改两个文件。

**刻意排除的能力（不是缺陷）**：

- **`tool-goal` / `command-goal`**：一个 mod 是**一口气交付**的——写文件、跑检查、交回输出。跨回合存活的目标是给"活过一次对话"的客观目标用的，在这里会变成一行没人读的状态。`tool-todo` 覆盖了真正多步的那部分。目标**服务**与会话驱动仍留在宿主平面，只是这两条模型可见的行不给这个 agent。
- **`tool-ask-user`**：可查的事实靠读。Wiki 页面、原版文件、`ck3_modcheck` 的输出回答了这个 agent 真正会有的问题；一条鼓励"先问再读"的行，对一套以引用为准的工作流是错误的默认值。人仍然通过 plan mode 的批准来掌舵。
- **`tool-workflow` / `workflow-worker-thread`**：多 agent 编排引擎是给"几十个独立小件扇出"用的。一个 mod 就是几个文件加一次检查，引擎是负担而不是能力。
- **`tool-ralph`**：对单一不变目标做全新 agent 迭代。一个 mod 的目标会随着用户看到结果而变，那正是这个工具假设不会发生的事。
- **`tool-presentation`**：PTC 的 `run_code` 传输，需要一个宿主 `codeRuntime`；它的价值是把"调查 → 改 → 测"的长链压成一步，而这个 agent 的循环是"写一个文件、检查它、报告"，中间隔着人的决定。
- **`tool-cordis`**：harness 自我修改。这个 agent 是写 mod 的；而且这一行在本部署下只有出厂 `cordis` 预设能开，加进来就是一行永不激活的死行。
- **`tool-subagent-codex` / `tool-subagent-claude-code`**：可选产品提供者，生产 `dsh` 两个都没装。一行 `disabled: true` 是注释而不是能力；用户真的要那个产品时，在 Profile 里装对应 Bundle 再加行。
- **全部检索行**：`ck3_search` / `ck3_read` / `ck3_cache` / `ck3_freshness` 这四条 wiki 检索行、以及一切通往知识库的东西，都随前身的咨询那一半一起删除；三条咨询类专家行（机制／史实／战略）同样不再组合。这个 agent 经 `tool-web` 的 `fetch` 读 wiki，经 `tool-fs` 读原版安装。

## 三位专家

| 工具 | 角色 | 可写 | `agentOptions` | 什么时候叫 | 输出块 |
| --- | --- | --- | --- | --- | --- |
| `expert_modd` | 模组作者 | **是**（`write` / `edit` / `pwsh`，**必须**跑 `ck3_modcheck`） | `reasoningEffort: max` | 有东西必须落到磁盘上并且加载得起来 | 文件 / 改动 / 自检结果 / 未验证 |
| `expert_verifier` | 对抗性验证 | **否**（`toolFilter: { deny: [write, edit] }`） | 不写（继承主 agent 的 effort） | 一个 mod、一个计划、或一条主张需要被攻击 | 结论 / 发现 / 未攻破 / 缺口 |
| `expert_chronicler` | 编年与记忆 | 是（按指令只写记忆层） | 不写（继承主 agent 的 effort） | 里程碑完成或决定落定之后 | 记录 / 结论 / 开放问题 |

**为什么只有 `expert_modd` 钉 `max`。** 两个兄弟预设把研究类角色留在继承的 effort 上，只给"错了最贵"的角色钉上限；这个预设里那个角色是**作者**，因为一个在磁盘上写错的 mod 是**静默**错的，代价由用户在游戏里支付。`agentOptions` 是**覆盖**在父级路由之上的，所以写出来的 `reasoningEffort` 在你在 GUI 里换模型时**仍然保留**（`resolveChildAgentOptions` 的删除规则只在行**没写** effort 时才触发）。验证者与史官**故意不写**：复核与记录不是那个最贵的角色，继承 effort 就是对的预算，钉 `max` 只会让它在主 agent 换模型时无谓地跟着走。

**`deny: [write, edit]` 是什么、不是什么。** 它把这两个工具从子代理的可见集合里移除——这部分是强制的。它**不是**沙箱边界：子代理保留 `pwsh`，而 shell 能写文件。它是**设计信号**：验证者靠**论证**纠正——把补丁作为文本交回来——而不是悄悄变成一次主 agent 没看过的重写。也**故意不 deny `pwsh`**：**自己**跑 `ck3_modcheck` 而不是读别人贴的报告，是这个角色的全部方法。

**三条 persona 的第一句都是同一件事**：你是全新子代理，看不到主 agent 的对话；在断言任何 mod 语法之前，把主张锚定在 wiki 的 modding 页面或一个真实原版文件上，而不是回忆。这句话不是客套——一个不知道自己看不见上下文的专家，会用训练数据作答，并把那个答案当成"本次会话的发现"交回来。

**递归上界是数出来的。** `resolveChildDepth` 算 `childDepth = 父级 delegationDepth + 1`，只在 `childDepth > maxDepth` 时拒绝；顶层 agent 的 `delegationDepth` 是 0，所以层级是 0、1、2……**不是** 1、2、3。本预设**每一条委派行都显式写出 `maxDepth: 2`**（`tool-subagent-fork` ＋ 三条专家行）。漏写会取 schema 默认值 **3**（`maxDepth: z.union([...]).default(3)`，不是"继承兄弟行"），那样专家子树会比主 agent 自己的工具多一层。

**没有通用 `subagent` 行，这是有意的。** 匹配不上任何具名角色的委派在这个预设里足够罕见，一个具名角色或一次 fork 覆盖得了——而少一种委派方式，就是少一种把活委派坏的方式。

**`subagent_fork` 故意不写 `modelSelectionSettings`**，让 provider/model 与父级一致、保住继承历史的 KV Cache 复用。一个 mod 会话继承的历史恰恰是它已经读过的东西——那页 wiki、那个原版文件、这个 mod 自己的文件——正是 fork 不该付钱重发的内容。

## 技能

三个技能随预设发布（`name` 必须等于目录名，否则静默掉出目录）：

| 技能 | 什么时候加载 | 来源 |
| --- | --- | --- |
| `ck3-mod-authoring` | 写、改或校验一个 mod 之前 | 源自前身预设的技能，**本预设内已修改**：本地化计数器一节改成「可选、缺了不是缺陷（实测 25,431 条不带）」并标明非零语义**未在本机验证**；`key=value` 的收紧空格从「要求」降级为「惯例」（原版数百个文件用紧凑写法）。前身预设目录已删除，所以旧的「逐字节相同 / SHA256 `3376E807…`」说法**不再成立，也不再可复核** |
| `mod-project-memory` | 记录或恢复项目状态、决定刚落定、判断一条结论该不该进记忆文件时 | 由前身的 `ck3-campaign-memory` 改写：留下分层、只追加、机制结论除外；战局／存档概念全部移除，规则文件改为 `MODDING.md`，项目层改为 `docs\mod-notes\`。本次另加两条：项目根是**最近的**标记目录（不是最外层），以及「运行时日志读数必须标注是哪一次运行」 |
| `dsh-runtime-reference` | 定位包、确认平面归属、查插件 config 面、诊断"挂了但没贡献"的一次行时 | 与 `dsh-smith/skills/dsh-runtime-reference/SKILL.md` **逐字节相同**（SHA256 `7512B611…`，两处均已复核） |

## 验证状态

**这一节区分「已通过（静态）」「已跑（运行时读数）」「未验证」，请按字面读。**

### 已通过的检查（静态）

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 技能 frontmatter | `node bin/lint-skills.mjs --path "D:\DeepSeek Harness\dsh-ck3-mod"` | 3 个技能全部 `ok`，`all 3 skill(s) lint clean`，退出码 0 |
| 静态预检 | `node bin/preflight.mjs --path "D:\DeepSeek Harness\dsh-ck3-mod\agent.cordis.yml"` | 27 行；**`validated: 16   skipped: 9   failed: 0`**（另有 2 行 disabled 不参与检查），**`PREFLIGHT PASSED`**，退出码 0 |
| YAML 解析 | 用 `bin/preflight.mjs` 同一个 `yaml` 包（`C:\Users\曦曦\.dsh\profiles\node_modules\yaml\dist\index.js`，带 `!!js` → `{ __jsExpr }` 自定义标签）解析 | `is array: true`；顶层 17 项；具名行 27；group 容器 3（`thinking` / `compaction` / `team`）；组内行数 1 / 3 / 6；专家行 3 条；无解析错误 |
| persona 模板变量 | `grep -n '{{' dsh-ck3-mod/agent.cordis.yml` | 只有 `{{model}}` 与 `{{cwd}}` 两种名字；`prefix` 内 1 个 `{{model}}`，`suffix` 内 1 个 `{{cwd}}`，另 2 处在解释这条规则的注释里（含 `dsh-forge` 同款写法）。无第三个变量名。**行号不写在这里**——`agent.cordis.yml` 每次改动都会让行号失效，要引用就用 `grep -n` 现场取（本节曾把 `{{cwd}}` 写成第 184 行、把 `!!js` 写成第 240 行，两处都随文件增长而失效） |
| 禁用内容 | 对整个预设目录 grep 检索名／知识库／战役类词 | 6 处命中，**全部在 `agent.cordis.yml` 的第 11–16、257、806 行**——即文件头说明"被删除的是什么"的血统注释，与 `plan-mode` 注释里说明"为什么从六段变四段"的一句。没有一处是行、config 键或 persona 正文 |
| 二进制同一性 | `Get-FileHash` 对比「逐字复制」的技能 | `dsh-runtime-reference` 8445 B `7512B611…` 与 `dsh-smith/skills/dsh-runtime-reference/SKILL.md` **仍逐字节相同**；`ck3-mod-authoring` 与 `mod-project-memory` **已被本预设修改**（修改后分别为 `89BE546E…` / `85801768…`），不再有「与源相同」这回事——前身预设目录也已被删除，两个旧哈希`3376E807…`/`940D2415…`只作为历史留在这里 |

### 那条**预期**失败已经消失（因为插件已经装上了）

写这个预设时，`tool-ck3-modcheck` 的包 `dsh-ck3-modcheck` 还没进 profile，静态预检报 `Cannot find package: dsh-ck3-modcheck`——**这正是这一行按包名解析、而非被本仓库 shipping 的直接后果**，也正是 `dsh-ima-kb` 的形状。**该前置条件随后被满足**：本机 `profiles/web/package.json` 现在有 `"dsh-ck3-modcheck": "link:C:/Users/曦曦/.dsh/plugins/dsh-ck3-modcheck"`，`cordis.patch.yml` 里有对应的 `ck3-modcheck` 行（带 `modDir: 'D:\CK3Mods'`）。所以上表里那一次预检是**唯一一次** `failed: 0` 的运行，**这也意味着「装插件」这个前置条件不再阻塞**——但**仍需重启 Host** 才能让宿主挂载那一行（该重启已完成，见 `docs/agent-notes/BOARD.md`），而本节里那条真正的挂载检查**当时**还没跑——它已在后续一次出厂 `cordis` 会话里跑过，读数见下面的「挂载检查」一节。

要按字面读的是这一句：**每一条具名行都解析成功**。9 行"跳过"不等于通过，它们逐类是：3 个 group 容器（`thinking`、`compaction`、`team`，无包可解析）、1 行 config 含未求值 `!!js` 表达式（`skill-filesystem` 的 `customSkillDirs[0]`，行号用 `grep -n '!!js' agent.cordis.yml` 现场取）、5 行不导出**函数式** `Config` schema 的包（`plan-mode`、`command-compact`、`tool-subagent-control`、`tool-subagent-control/list-agents`，以及 `dsh-ck3-modcheck` 自己）。另有 2 行（`tool-bash`、`tool-pwsh`）因 `disabled` 是未求值的平台表达式而不参与检查——其中恰好只有一行会在任何给定平台上激活。

### 插件自己的检查（153/153）

`dsh-ck3-modcheck` 的 config 面**不被本仓库任何脚本读过**：它导出的是**普通对象** Standard Schema（与 `dsh-ima-kb` 一致），而 `bin/preflight.mjs:178` 只在 `Config` 导出是**函数**时才用它（`typeof Schema !== 'function'` → 打印 `skip … (exports no usable Config schema)`）。它的 config 来自 profile 那一行（本机写的是 `modDir: 'D:\CK3Mods'`），而**校验这些字段的代码只住在插件自己的测试里**。实测：

```text
node "$DSH_HOME/plugins/dsh-ck3-modcheck/test/falsify.mjs"
→ 153/153 assertions passed
→ FALSIFICATION PASSED
```

跑的时候它自己报告的三条，都是本文件其它地方引用的依据：六个植入缺陷**逐个被点名**（不是"有错"而是"错在哪"）；`vanilla probe: a real vanilla localization file produces ZERO findings`；`vanilla probe: the real file really does start with the UTF-8 BOM / first bytes: ef bb bf`。本次另外单独实测：`game\localization\english` 下 **122 个 `.yml`，122 个以 `EF BB BF` 开头**，第一个文件是 `achievements_l_english.yml`；同一批 122 个文件里 `checkLocalizationFile` 报 **0 findings**，**25,431** 条条目不带版本计数器（条目样行共 **75,936** 条）。

**同一个套件里另有两条读数，说明「测试通过」不等于「读数可信」**（D-64/D-81 的来源）：本地化的旧 pattern 曾把**原版自己的 742 条条目**报成缺陷（修好后同一批文件 0 findings）；日志去重曾把 **1,780 条 E 行折叠成 43 条「不同错误」**，而其中 1,562 条是同一句外壳 `Script system error!`，真实内容在下一行——所以现在外壳会与其续行合并，并显式报告「把 N 条折叠成了 M 条」。

### 挂载检查（**已经跑过** —— 在一个出厂 `cordis` 会话里，实测）

**真正的挂载检查是 `agentPresets.standingKeyFor('dsh-ck3-mod')`。它已经跑过了，读数如下。** 它需要一个活的 harness 进程，而进入一个活进程的实用路线是动态插件（`cordis_define` + `cordis_run`），那需要 `cordis_*` 工具；那套工具只在**一个出厂 `cordis` 预设的会话**里注册（`dsh-tool-cordis` 注册四个**进程全局**的 inspect provider，宿主在启动时就占用了那些 id，第二个含该行的组合会让**整个挂载**失败）。做法与预期的观察方式一致：

```text
需要：一个出厂 `cordis` 预设的会话
做法：动态插件探针调 agentPresets.standingKeyFor('dsh-ck3-mod')
观察：返回即为挂载成功（standing scope key 已 ensure）
```

**实测读数（同一次探针调用）**：`standingKeyFor('dsh-ck3-mod')` **正常返回 ⇒ `MOUNT OK`**；随后同一次调用里的 `compositionInventory()` 对该 preset 报 **24 个叶行**（＝本文档别处记的 `27 具名行 − 3 个 group 容器`，两条计数路径都跳过容器）、`broken` 为 `none`、**23 行 `fiberState = 2`**，唯一的 `(none)` 是 `tool-bash`（它的 `disabled` 是未求值的平台表达式，本平台激活的是 `tool-pwsh` 那一行）。`FiberState` 的数值表读自 `@deepseek-ai/cordis/lib/types/fiber.d.ts:70`：`PENDING=0 / LOADING=1 / ACTIVE=2 / FAILED=3 / DISPOSED=4 / UNLOADING=5` ⇒ **没有一行停在 `PENDING`（等待服务）或 `FAILED`**，其中包括来自仓库外的那一行 `tool-ck3-modcheck`。

`node bin/verify.mjs` **不是**那条检查，换会话也救不了它：它自己 `new cordis.Context()` 起裸运行时，`agentPresets` 按定义缺席，从任何会话都会打印 `INCONCLUSIVE`。`bin/preflight.mjs` 通过的也不是它。

> **`preflight` PASSED 不等于能挂载，`standingKeyFor` 干净也不等于"这个预设能用"。** 静态预检看不到的三类恰好最要命：**激活了但什么都没贡献的行**（消费者与提供者不在同一 realm）、**泄漏到根 realm 的服务**、以及**写在 `apply()` 而不是 schema 里的校验**。而且它**不拒绝未知配置键**。`standingKeyFor` 证明的是"它没抛异常"——组合可用、standing 挂载键已 ensure——**不是**任何单行有贡献。逐行贡献目前没有标准流程（D-40）。

### 仍未验证的东西

1. **`standingKeyFor` 已经跑过并正常返回（`MOUNT OK`，读数见上一节），但本文件仍然不写「这个预设已验证通过」。** 理由是上一节末尾与 D-40：挂载通过证明的是**没有抛错**，逐行贡献没有标准流程；而 `ck3_modcheck` 是否进入会话工具表，仍取决于下面第 2 条。
2. **`ck3_modcheck` 工具是否真的出现在这个预设的会话里未验证。** 插件已经装进 `web` profile（本文件「安装与使用」的 ① 已实测），但宿主是在**启动时**挂载那一行的，而 `ck3_modcheck` 是否已在一个活会话的工具表里，只有一次真会话能证明。

   > ### ⚠️ 但「工具表里有 `ck3_*`」**证明不了那是 CK3 会话**
   >
   > 这四个 `ck3_*` 在**宿主平面**（`profiles\web\cordis.patch.yml` 那一行），注册进宿主的
   > `ctx.tools`，所以**每一个会话都看得见它**，包括根本不是 CK3 的会话。按 `ck3_*` 判断
   > 「我打开的是不是模组工坊」是一条**恒真**的检查。
   >
   > 判别键在 **preset 平面**：看到 `expert_modd` ＋ `expert_verifier` ＋ `expert_chronicler`
   > 且**没有** `expert_architect`，才说明这个会话由 `dsh-ck3-mod` 服务。实测佐证：在一个
   > `dsh-smith` 会话里，四个 `ck3_*` 照样在表里，而专家是
   > `expert_architect`／`expert_protocol`／`expert_verifier`／`expert_chronicler`。
   >
   > 另外「工具在表里」与「工具能返回真数据」也是两件事——后者已实测过
   > （2026-09-17 从新代码直接驱动四个工具：`ck3_mod_status` 读出 openbeta 库的 **7 个 mod ＋ 7 行 playset**，
   > `ck3_mod_evidence` 读出本次运行起点 `23:16:57` 与 18 个日志文件，`ck3_modcheck` 对空的 `D:\CK3Mods`
   > 报「**no check ran**」而不是「every check that ran passed」）。
3. **`ck3_modcheck` 在真会话里的行为未实测**：它的报告格式、`fix: true` 路径的行为、以及在真实 mod 目录上的输出——全部取决于插件自己的实现与测试（上面 153/153 那一节）。**本节曾把这里写成 105/105，而同一文件另一处写 51/51 与 51/51，三处数字互不一致**；现在统一为插件套件的实测读数，改这个数要重跑 `node "$DSH_HOME/plugins/dsh-ck3-modcheck/test/falsify.mjs"`。
4. **三条 persona 真的到达子代理、`deny: [write, edit]` 在运行时成立**——这需要在真会话里委派一次并读回工具表，本仓库做不到。
5. **`path=` 的格式已不再是未知项**，这一条在本次会话被**推翻**：wiki 的 `Mod structure` 页 Keys 表给出三种写法并写明基准——`path="mod/my_mod"` 是「相对，任何系统」、相对**用户文件夹**（不是游戏主目录），完整绝对路径亦可，且 Tips 专门提醒引号必需。所以预设的 persona 现在**允许**引用这三种写法。仍然不允许的是声称**启动器接受了**某个值——那是启动器的行为，不是文件的属性，只有一次真实启动能判定。
6. **`agent-instructions` 的三个候选真的会在用户工作区里被找到**——机制读自 `dsh-agent-instructions/lib/index.js:578`（root-to-cwd 链上逐目录探测），但没有在用户的实际工作区里端到端验证过。
7. **本预设的技能是否真的被 `skill-filesystem` 加载**：`customSkillDirs` 用 `!!js` 表达式在运行时求值，静态预检因此跳过该行；它只可能由真会话的工具表证明。**2026-09-17 拿到一条更强的证据，但仍不是端到端**：用真包（`cordis-plugin-include` 的 schema、`cordis-plugin-loader` 的 `interpolate`、一个带 `baseUrl` 的真实 `cordis` Context）实测该表达式求值为 `…\.agent-presets\dsh-ck3-mod\skills\`，目录存在且三个技能都在；没有 `baseUrl` 时抛 `ReferenceError`——**失败是响的，不是静默的**。缺的只是「活会话的技能目录里确实列出它们」。
8. **`tool-ck3-modcheck` 那一行的 config 面从未被本仓库的任何脚本读过**——即使它现在能解析：它导出的是普通对象 Standard Schema，`bin/preflight.mjs:178` 的 `typeof Schema !== 'function'` 分支把它报成 `skip … (exports no usable Config schema)`。它的 config 校验只住在插件自己的 `test/falsify.mjs` 里（上面 153/153 那一节）。
9. **插件代码改动必须重启宿主才生效，而工具现在会自己说这件事**：每个报告末尾有一段**代码回执**（PID、本进程启动时间、`lib/index.js` 与 `lib/rules.mjs` 的 mtime）。它是**回执而不是判词**——不写「代码已陈旧」这种推断，只把两个时间摆出来让人自己比。当前服务本 GUI 的宿主是 **PID 16872，启动于 2026-09-17 19:08:13**，早于本轮插件改动，所以在宿主重启之前，新会话里调这四个工具拿到的仍是旧代码的输出。

## 升级后

```sh
node bin/lint-skills.mjs --path "D:\DeepSeek Harness\dsh-ck3-mod"
node bin/preflight.mjs  --path "D:\DeepSeek Harness\dsh-ck3-mod\agent.cordis.yml"
```

两条都用 `--path`，因为 `--preset <id>` 分支要求 id 已在 `bin/presets.mjs` 里注册（`bin/lint-skills.mjs:42` 与 `bin/preflight.mjs:68` 都在脚本顶层调用 `presetFromArgv(...)`，未注册的 id 抛 `UnknownPresetError` 并以退出码 1 结束）。注册由 lead 完成；`--path` 分支连注册都不需要，是针对任何目录的那条路。

`drift-check` 比对的上游应是**出厂 `standard`**，不是 `cordis`：这个预设与 `dsh-forge` 同为 `standard` 派生，比错上游会把每一行的合法差异都报成漂移。

## 许可

MIT。见 [LICENSE](../LICENSE)。本预设的 `mod-project-memory` 技能为原创改写；`ck3-mod-authoring` 复制自同仓库前身预设的原创技能，`dsh-runtime-reference` 复制自 `dsh-smith/skills/` 下取自官方发行包的技能，来源见主 [README](../README.md#许可与来源)。
