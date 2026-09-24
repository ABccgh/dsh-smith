# `dsh-script` · 剧本工坊 · DSH Script

一个 DeepSeek Harness agent preset：**竖屏短剧的剧本**，从选题到改稿。

它做**剧本这一段**，不做一条产品线：

```
① 选题 → 一句话钩子 → 圣经 → 分集功能表（智能体）
      ↓
② 逐集正文（智能体）        每集 1 600–1 900 字；平台硬上限 2 000 字/集、全集 ≤10 万字
      ↓  交付 products\<剧名>\script\可导入-<剧名>-全N集.txt
③ 平台评估（你）            有戏AI：登录 → 粘贴剧本 → 生成剧集 → 立即发起评估
      ↓  把读数带回来
④ 读数回填与改稿（智能体）  追加进 评估报告-回填.json 的 readings[]，并报出与上一次读数的差；只改正文
      ↓
⑤ 你说「满意」              ← 到这里为止，没有下一步
```

**③ 是硬闸门。** 智能体在 ② 之后**结束回合**，直到你把平台的读数带回来；而 **④ 不会自己开始** ——
改稿的触发条件是**你带回的读数**或你明说的「不满意」，不是智能体自己的判断
（persona 的 `suffix` 里写着这一条）。

本地闸门 `duanju_gate` 的 `PASS` 是**手艺**判据，平台的评级是**内容**判决，两者不可互换：
本项目实测过一份本地断言全绿的剧本被平台判 **D 55.7**，同一个故事改写后判 **A 82.6**。

---

## 一、它是什么，以及它明确不是什么

**这是一次范围收缩，不是新设计。** 源文件是本仓库的 `dsh-duanju/agent.cordis.yml`，它的回路是
「选题 → 圣经 → 逐集正文 → 28 列分镜表 → 有戏AI 出片 → 平台评估/投稿」；`dsh-script` 把手交
之后的那一段整块切掉。被切掉的那一类是**分镜表（28 列故事板）与平台的 xlsx 导入模板**。

理由不是「那些东西没用」，是**本 preset 里没有任何一行能生成、读取或判定它们**
（组合文件开头 `WHAT WAS CUT IS A DIFFERENT ARTIFACT CLASS` 一段，`:9-13`）。源文件两样都带，
是因为它把「剧本 → 分镜表 → 平台评估」当**一个产品**；这一版在**交付处**结束，
所以在这里写出的分镜表会是一件**本 preset 无人能验**的东西。

| | `dsh-script`（本文档描述的这一版） | `dsh-duanju`（同一条链上的**下一段**） |
| --- | --- | --- |
| 回路 | 选题 → 逐集正文 → 交给用户评估 → 按读数改稿 | 读定稿正文 → 28 列分镜表 → 平台可导入 xlsx → 生成 → 成片 → 投稿 |
| 具名行 | **27** | 28 |
| 专家 | script / doctor / dialogue / continuity（4） | **board** / **shootability** / verifier / chronicler（4） |
| 剧本域工具 | 三件，由**宿主面插件**提供（见第四节末） | 那三件对它仍然可见（宿主平面），但它**没有**教它用的技能 |
| 分镜表与 xlsx 模板 | **不在范围内** | **主产物** |
| 正文 | **它写** | **它不写也不改**（改了就是在别人仍会改的那份文件上盖第二个权威） |

两者是**同一条短剧链上的两段，不是两代**：2026-09-24 做过一次去重 —— `dsh-duanju` 原先带的剧本
persona、编剧／剧本医生／台词师三名专家、以及 9 个剧本侧技能已整体移出，因为本 preset 把它们做全了。
**两者的专家名交集为空、技能目录名交集为空**，所以「跑的是哪一个」有一个无歧义的判据。
本文档只写 `dsh-script`。

### 与用户自建的 `dsh-aivideo` 的关系

本机另有一个**用户自建** preset `dsh-aivideo`（AI 视频变现工作台：接单、报价、多种变现方式）。
`dsh-script` 是那个能力面的**窄化版**：只留剧本这一段。

| | `dsh-aivideo`（用户自建，不在本仓库） | `dsh-script`（本仓库） |
| --- | --- | --- |
| 人格 | 视频制作流程负责人，按单交付 | 剧本工坊，按**平台评估**推进 |
| 技能 | 12 个（含接单、报价、旅游宣传片、信息流） | 12 个（决定的数目；盘上 11 个，全部在剧本链上，见第三节） |
| 出片通道 | 即梦 CLI 为主 | **无** —— 平台上的生成与评估都是人在网页上做 |
| 委派 | 整个 delegation 组已删 | 四位具名专家（**没有** `subagent_fork`） |

**两者并存，不互相覆盖。** 本仓库从未修改 `dsh-aivideo`。

---

## 二、它不能做什么（这条要写在最前面）

**有戏AI 的登录、剧本粘贴、生成、立即发起评估、发布 —— 这五步只能由人在网页上做。**

这不是权限设置，是**能力边界**，实测的（这套读数由源文件记录，本 preset 沿用同一平台事实）：

- 这个平台**没有 CLI**（`D:\AIVideo\tools\` 下没有任何脚本会联系平台）；
- **没有公开 API**（`/openapi.json` 与 `/swagger` 都 404；`docs.` / `open.` / `api.` / `developer.` 子域全 NXDOMAIN）；
- 它的私有 app API 可以从它的前端产物里枚举出来（30 多个端点），但**每一个调用都要从已登录浏览器的 `localStorage` 读 `token`**；
- **本工作区里没有任何凭证** —— 全树递归搜 `.env*` / `*token*` / `*cookie*` / `*credential*` / `*secret*` → **0 个文件**。

所以 `dsh-script` 里**没有**任何一行组合平台，也**没有**任何配置键写着 token
（组合文件末尾 `NOT A ROW, AND WORTH SAYING OUT LOUD` 一节，`:893-900`）。把这些步骤包装成工具会是在
假装一个有戏AI 不提供的接口 —— 那比不做更糟，因为流程看起来在往前走，而实际上它在等人。

> **注意它和第四节那三件工具的区别，两者很容易被读成一回事：**
> 三件工具（`duanju_gate` / `duanju_recall` / `duanju_checkpoint`）**不碰平台**：跑的是**本机**的
> 闸门脚本、读的是**本机**的剧目录、写的是**本机**的 `项目总览.md`。它们不含凭证，也不发出任何平台请求。
> 「平台侧只能由人做」这条边界与它们的存不存在无关。

> 要让其中一部分变成可驱动的，需要你提供一个凭证（`localStorage` 里的 token 与 channel）。
> 那是**你拥有**的决定，不是一次 preset 编辑 —— 源文件把它列为「本次不做」的 Phase 2。

---

## 三、12 个随行技能

**这一节有两份不同的东西，分开写：「决定里的名录」与「磁盘上的现状」。后者是读数，前者不是。**

### 决定里的名录（12 个；**未在磁盘上核对**）

| 技能 | 状态 | 装什么 |
| --- | --- | --- |
| `dramaturgy` | 保留/更新 | 编剧方法论：选题、一句话钩子、人物、12 集结构、分集功能表 |
| `hook-ladder` | 保留/更新 | 钩子工程：每集前 3 秒、集尾悬念可接住性、付费卡点 |
| `episode-engineering` | 保留/更新 | 分集工程：一集一个功能、集尾驱动下一集的第一镜 |
| `drama-project-memory` | 保留/更新 | 四层记忆纪律：编年 / 只追加的决策 / 台账 / 读数层 |
| `drama-workspace` | 保留/更新 | `D:\AIVideo` 的目录与脚本契约、并发写锁、硬编码路径 |
| `script-delivery` | 保留/更新 | 工序与交付契约：四条硬约束、三态纪律与退出码、评估回环 |
| `drama-supplements` | 保留/重写 | 剧本链的补充手艺 |
| `script-tools` | 保留/重写 | 三件 `duanju_*` 工具的用法与四态纪律 |
| `script-rules` | 新增 | 这个 preset 自己的规矩（篇幅、分集标记、回合边界） |
| `script-review` | 新增 | 送评前的自检清单：形态与评估两条法怎么落到一份正文上 |
| `youxi-platform` | 保留/更新 | 平台边界与读数纪律：闸门、报告字段与评级映射、读数陷阱 |

**`youxi-platform` 不在最初给的那份名单里，但它有独立依据**：组合文件的 `web` 一节写着
「`fetch` 保留的理由，就是**平台技能存在的理由**」（`:819-820`，原文 *"`fetch` is kept for the reason
the platform skills exist at all"*）—— 没有一份平台技能，那条理由就没有主语。其余十条来自本次窄化的决定本身。

> **一处对不上，留在这里而不是抹平。** 决定里**点名**的是 10 个
> （上表去掉 `youxi-platform`），另加两个**删除**（`shotlist`、`dsh-runtime-reference`）；
> 而「12 个」是既定的数目。10 ＋ 1（`youxi-platform`）= 11，**仍差一条**。
> 差的那一条**没有被猜出来，也没有被编一个名字填上**。

### 磁盘上的现状（读数，2026-09-24）

```sh
Get-ChildItem dsh-script/skills -Directory | Select-Object -ExpandProperty Name
node bin/lint-skills.mjs --preset dsh-script
```

两条命令当时的输出：目录列出 **11** 个 —— `drama-project-memory`、`drama-supplements`、`drama-workspace`、
`dramaturgy`、`episode-engineering`、`hook-ladder`、`script-delivery`、`script-review`、`script-rules`、
`script-tools`、`youxi-platform`；lint 印 `all 11 skill(s) lint clean`，退出码 **0**。

**11 与「12」这两个数字都成立，因为它们说的是两件事**：11 是**盘上此刻的读数**，12 是**决定的数目**。
多出来的那条名额不在上面这 11 个里（上表已列全）—— **以写完后的目录列举为准**，不要按这份文档补一条名字。

> 组合文件**刻意不在注释里列技能清单**（`:317-322`，原文：*"this comment deliberately carries NO SKILL
> INVENTORY"*）：一份写在注释里的文件清单会静默过期，而「文档落后代码、没有任何测试变红」这个形状
> 本工作台已经吃过一次亏。

### 技能从哪来

`dramaturgy` 与 `hook-ladder` 两个源自 `dsh-aivideo`，**单向复制**，`dsh-aivideo` 从未被本仓库修改。
源文件里第三个来自 `dsh-aivideo` 的技能是 `shotlist`（28 列分镜表的字段定义与逐列映射）——
它**不随这一版**：分镜表整体出了范围，而一份说着「28 列」的技能留在这里只会是一条过期的契约。

`dsh-runtime-reference`（源文件里复制自本仓库 `dsh-ck3-mod`）同样**不随这一版**。
其余为本仓库原创。

### 技能遮蔽：工作区可以单方面覆盖它们

`dsh-skill-filesystem` 的根与优先级（`lib/index.js:21-25` 的五个常量、`:150-184` 组装；
比较是**升序**，所以数字小的赢）：

| 根 | rank | 依赖 cwd？ |
| --- | --- | --- |
| `<项目根>\.dsh\skills` | 100 | **是** |
| `<项目根>\.agents\skills` | 200 | 是 |
| preset 的 `customSkillDirs`（本 preset 的 `skills\`） | 300 | 否 |
| `~\.dsh\skills` | 400 | 否 |
| `~\.agents\skills` | 500 | 否 |
| bundled 根（`BUNDLED_SKILL_RANK`，来自 `@deepseek-ai/dsh-skill`） | 600 | 否 |

**所以：把新版本放到 `D:\AIVideo\.dsh\skills\<名字>\SKILL.md`，它会覆盖本 preset 里的同名技能**
（重复只记警告，不报错）。这是「两个 preset 各存一份手艺技能」这一代价的减损通道：契约要更新时，
工作区自己就能改，不需要编辑 preset。

反过来，**技能放在 preset 内而不是只放工作区**，是因为项目本地根**依赖 cwd**：
会话在 `D:\AIVideo` 之外起，就**静默丢掉全部短剧技能**，没有任何报错。

---

## 四、组合：27 个具名行

> **定位方式先说清楚：** `dsh-script/agent.cordis.yml` 在写这份文档期间**被改过两次**（26 行 → 27 行，
> 行号整体位移），所以下面给的定位以**节名与行 id**为主、行号为辅，行号是**某一刻的快照值**；
> 文件的快照（行数 / 字节数 / mtime）记在第六节。组合文件一动，第六节那一格就要重跑。

用 `node bin/preflight.mjs --preset dsh-script` 复读，实测（2026-09-24）：

```
rows:        27
...
validated: 16   skipped: 9   failed: 0

PREFLIGHT PASSED — every row resolved, and every config this script could read
validated against its own plugin schema.
```

27 行 = **24 个叶行 ＋ 3 个 group**（`planning` / `compaction` / `team`）。相对源文件的 29 行，
这次的差是**删 3 加 1**：删 `tool-subagent-fork`、`tool-expert-verifier`、`tool-expert-chronicler`，
加 `tool-expert-continuity`；**`tool-jobs` 保留**（它差点被删掉，见下面「刻意不装的行」之后的说明）。
**24/27 这个说法是按行差算出来的，不是数出来的** —— 它是与上面 `rows: 27` 的一致性检查，
不是两次独立读数。

**发布 0 个服务。** 三个 `isolate` realm 都在 preset 内、寿命与会话一致（三处 `isolate:` 分别在
`:354-355`、`:399-401`、`:476-477`）：

| group | realm | 谁发布 |
| --- | --- | --- |
| `planning` | `planMode` | `plan-mode` |
| `compaction` | `compaction` + `toolResultPruner` | `compaction-basic` / `tool-result-pruner`（消费者与提供者必须同 realm） |
| `team` | `workflowEngine` | **今天无人发布** —— 照抄同族已验证形状；日后加工作流必须**同时**加回 `workflow-worker-thread` 与消费者 |

其余一切（`tools` / `systemPrompt` / `skills` / `subagents` / `fs` / `shell` / `web` / `userQuestions`）
都从**宿主**解析，因此这些行**必须待在 realm 之外**。

### 四位专家

| 工具名 | 角色 | 特别之处 |
| --- | --- | --- |
| `expert_script` | 编剧 | `agentOptions.reasoningEffort: max` —— 唯一写正文的角色，错误代价是乘性的 |
| `expert_doctor` | 剧本医生 | 只诊断**手艺**（结构／节奏／人物弧／爽点／跨集一致／钩子可接住性），**不写正文** |
| `expert_dialogue` | 台词师 | 句子级：施压／掩饰／反击、对白密度、静止解释禁令、语域一致 |
| `expert_continuity` | 连续性官 | **跨集**尺度的矛盾：声音漂移、埋了不还的钩子、道具／伤势／时间线、因果断裂、「他还不可能知道这件事」 |

**四个专家行逐行写 `maxDepth: 2`**（`:494`、`:552`、`:613`、`:685` 四个 `tool-expert-*` 行）——
省略会解析成 schema 默认 3，专家在深度 1 于是能比 lead 自己挖得更深；深度链因此是
agent(0) → expert(1) → helper(2)。

**两条与源文件不同的角色决策，写下来免得被当成遗漏：**

- **`expert_verifier`（守门人）与 `expert_chronicler`（史官）已删。** 前者带走的不只是一个人格，
  还有全表唯一一处 `toolFilter`（`deny: [write, edit]`）—— 现在**没有任何一行写 `toolFilter`**。
  后者带走的是「谁维护记忆层」：这一版由 **lead 自己**维护 `D:\AIVideo\{PROJECT,DECISIONS,INVENTORY}.md`
  与受管的 `products\<剧名>\项目总览.md`（persona 里写着）。
- **`tool-subagent-fork` 没有组合。** 本 preset 的委派都是**自足简报型**：角色拿到的是**它自己**要读的
  文件，而不是 lead 已经读过的上下文（`:878-879`，`DELIBERATELY ABSENT` 一节的 `tool-subagent-fork` 条）。

### 刻意不装的行（`:853-891`，即组合文件末尾的 `DELIBERATELY ABSENT` 一节）

`command-goal`/`tool-goal`（长程状态已有主：`D:\AIVideo\` 下的记忆层与评估转录）、
`tool-ralph`（每次迭代之间隔着一次**你**去做、并且要付费的平台往返）、
`tool-workflow`/`workflow-worker-thread`、通用 `tool-subagent`、`tool-subagent-fork`、
两条产品提供者行（`codex`/`claude-code`）、`tool-presentation`、`tool-cordis`。
每条的理由都写在组合文件里，不在这里复述。

> **`tool-jobs` 差点在这份名单里，最后被反向决定了 —— 这一条值得单独说。** 它第一轮被删掉，
> 然后**恢复成一行**，理由是**结构性的、并且是量出来的**：作业**完成通知**不是「一行只是读取」
> 的宿主服务属性，而是**由这一行生产**的 —— `dsh-tool-jobs/lib/index.js:206` 注册
> `ctx.jobs.onJobDone((snapshot, owner) => …)`，它构造一条 `form: "notice"` 的 user message 并交给
> `owner.followup` / `owner.inject`；而作业服务只向**已注册的监听者**扇出，`dsh-subagent` 一个都不注册。
> 所以这一行缺席时，**每一次后台委派都会静默落定**：四个专家默认就是后台的
> （`backgroundMode: continuable`），lead 永远不会被告知它们跑完了。它**不是功能，是委派的回传通道**
> （组合文件的 `background jobs` 一节，`:768-788`）。
> 组合文件把这段推理**留在原地**，并注明它曾被从「刻意缺席」名单里划掉（`:856-857`）——
> 后来读这份文档的人不该去盘上找它是不是又坏了。

**`tool-ask-user` 保留了**（与 `dsh-ck3-mod` 相反，差异是刻意的）：往哪个平台交、走哪条产品线、
是否为积分花钱，是**你拥有、读文件读不出来**的选择 —— 而**等一次评估读数故意不是它的活**：
那个等待比一个会话活得久，所以走持久信箱（`inbox_add`），不是卡住回合的问题
（组合文件的 `user questions` 一节，`:800-812`）。

### 剧本域的三件工具**不在**这个组合里

`dsh-script` **消费**三个 `duanju_*` 工具，它**不提供**它们：那是一件**宿主面** Cordis 插件
（`dsh-duanju-script`，源码在 `D:\dsh-duanju-script\`，本仓库不发布），由 web profile 自己的
`cordis.patch.yml` 一行 `insert:` 挂载，方式和 `dsh-ck3-modcheck`、`dsh-ima-kb` 一样。
它**不发布任何服务**（`inject = ['fs','tools']`，没有 `provide()`），只把工具注册进宿主的 `ctx.tools` ——
**所以这里没有它的一行**：在这个 composition 里为它写一行，要么解析不了，要么把工具重复注册进一个
按名字做键的注册表（组合文件末尾最后一节，`:902-906`）。

三件工具是：`duanju_gate`（跑本机闸门并返回**结构化四态** `PASS` / `FAIL` / `UNAVAILABLE` / `CRASHED`）、
`duanju_recall`（一部剧状态的**只读**投影）、`duanju_checkpoint`（把投影渲进 `项目总览.md` 的**受管区块**，
标记不成对时**拒绝**写入）。

> **「只剩三件」是收缩后的目标态，不是今天的读数。** 组合文件自己留了这条（`:46-53`，
> `THE DEPENDENCY HAS NOT LANDED YET` 一段）：
> 写那份文件时 `D:\dsh-duanju-script\lib\` 注册的是**六件** —— 上面三件，加被移除的三件
> （`duanju_board` 逐行分镜表判定、`duanju_contract` 28 列列契约、`duanju_template` 官方 xlsx 模板对照）。
> **移除是决定，不是故障**；在盘上读到六件时不要以为哪里坏了。

---

## 五、安装

```sh
node bin/install.mjs --preset dsh-script
```

装到 `${DSH_HOME:-$HOME/.dsh}/.agent-presets/dsh-script/`。**不需要重启 harness 进程**
（`dsh-agent-presets` 的发现不缓存：`lib/index.js:1152-1158`），但**必须开一个新会话** —— preset 在会话启动时挂载。
在模式选择器里选「**剧本工坊 · DSH Script**」。

**另外要一件东西：那三件工具。** 它们由宿主面插件提供，装法不在本仓库里：

```sh
dsh plugin --profile <profile> add D:\dsh-duanju-script
```

没有它，preset 照样挂载（组合里没有任何一行指向它），**但 `duanju_gate` / `duanju_recall` /
`duanju_checkpoint` 不会出现** —— 而 persona 与技能都按它们存在来写。这时候闸门的结论是
**没有结论**，不是通过：「读不到」必须与「没有问题」在输出上分开。

---

## 六、验证状态

**按字面读。** 这一节的每一格要么带一条读数（命令 ＋ 输出），要么写 **未验证**。
时间：2026-09-24。

| 项 | 读数 |
| --- | --- |
| 组合行数 | **27** —— `node bin/preflight.mjs --preset dsh-script` 印出 `rows: 27` |
| 静态预检 | **PREFLIGHT PASSED** —— `validated: 16   skipped: 9   failed: 0`，退出码 **0** |
| 技能 lint | **11/11 clean** —— `node bin/lint-skills.mjs --preset dsh-script` → `all 11 skill(s) lint clean`，退出码 **0**。**但这不是「12 个的读数」**：盘上 11 个，决定的数目是 12（第三节把两份名单分开写了）。严格说，第 12 条技能存在之前的这一格是**未验证**，已跑的是它那 11 个 |
| 与出厂上游的差异（`drift-check`） | **读到 2026-09-24**（退出码 0）：共享 **21** 行、其中 **4** 行有差异（`persona`、`agent-instructions`、`skill-filesystem`、`tool-result-pruner`）；本 preset 独有 **6** 行（`team`、四个专家行、`repeat-tool-reminder`）；上游独有 **10** 行。该脚本自己写着「有差异不等于缺陷」 —— **逐条是否该跟，是一次人工判断** |
| 挂载（`standingKeyFor`） | **未验证** —— **没有跑过**，见下 |
| 工具到达模型 | **未验证** |
| 三件 `duanju_*` 工具是否真的可见 | **未验证** |
| 只读角色过滤（`toolFilter`） | **不适用** —— 全表**没有** `toolFilter`：带 `deny: [write, edit]` 的 `expert_verifier` 行已被删除，其余三行刻意不加 |
| 平台接口可用性 | **未验证** —— 无凭证，**没有发出过任何请求** |

**上面每一格都是按 id 复读的，而这个 id 是写这份文档期间才补上的。** 第一次跑的时候 `bin/presets.mjs`
的 `PRESETS` 里还没有 `dsh-script`，两条命令都以
`unknown preset "dsh-script": this repository ships dsh-smith, dsh-ck3-mod, dsh-forge, dsh-duanju`、
**退出码 1** 结束；现在注册表（`bin/presets.mjs`）与 `package.json` 的 `dsh.presets` 都有了这一项，
读数才成为可能。这一点值得留着，因为**一个新 preset 是两处编辑**（`AGENTS.md` 原话），
而任何一处漏掉，代价是这两条命令都按 id 报错 —— 那时可以用 `--path <组合文件>` 绕过 id 解析拿到
**同一段代码、同一个组合文件**的静态读数，只是它不做「这个 id 在注册表里」这件事。

**组合文件一动，「组合行数」那一格就要重跑**，而它是一行命令。读数时
`dsh-script/agent.cordis.yml` 是 **906 行 / 67 725 字节**（mtime `2026-09-24 20:32:42`）——
写这份文档的过程中它就变过一次：`tool-jobs` 被**加回来**，行数从 26 变成 27（理由见第四节）。
**这一类变化只会让 `rows:` 那一行变，文档不会自己跟着变。**

### 挂载检查怎么跑（一件**没做**的事）

`agentPresets.standingKeyFor('dsh-script')` 是**唯一算数**的挂载检查，它**没有在这个 preset 上跑过**。
它需要一个跑在**出厂 `cordis` preset** 上的会话：`cordis_*` 工具只在那里注册
（`dsh-smith` 把它们 `disabled`；`dsh-forge`、`dsh-ck3-mod`、`dsh-duanju`、`dsh-script` 都不含那一行）。

> **不要把旧读数搬过来。** 2026-09-21 有过一次 `mounted OK`，但那是 **`dsh-duanju`（旧 preset）**
> 的读数，不是在 `dsh-script` 上跑的。两个 composition 的行清单不同（**27** 对 28/29、专家不同、
> 少一条 fork 行），**所以那条读数对此处一个字都不证明。**

**`node bin/verify.mjs` 不是这条检查** —— 它自己 `new cordis.Context()` 起裸运行时，`agentPresets` 按定义缺席，
从任何会话都会打印 `INCONCLUSIVE`（实测两次、输出逐字相同）。

在那个会话里，用动态插件探针（`cordis_define` + `cordis_run`）跑这段，然后调用它注册出来的 `preset_check`：

```js
return {
  name: 'preset-tools',
  inject: ['agentPresets', 'tools'],
  apply(ctx) {
    harness.registerTool(ctx, harness.defineTool({
      name: 'preset_check',
      description: 'Mount-validate one preset by id.',
      parameters: { id: { type: 'string', required: true } },
      output: { schema: { type: 'string' }, render(_a, v) { return [{ type: 'text', text: v }] } },
      async execute(args) {
        try {
          await ctx.agentPresets.standingKeyFor(args.id)
          return 'mounted OK'
        } catch (error) {
          return error.message
        }
      },
    }))
  },
}
```

**期望**（**不是**读数）：`preset_check { id: 'dsh-script' }` 返回 `mounted OK`。
被拒时的消息会点名 offending 行与服务（`N row(s) did not activate: <id>: waiting for <service>` /
`row(s) published process-global service(s) [<name>]` / `service "<name>" has been registered at <Owner>`）。
探针是探针，用完 `cordis_undefine` 收掉。

> **这条检查改完组合之后可以重跑，而且重跑是有意义的。** `ensureStanding`
> （`dsh-agent-presets/lib/index.js:1767-1800`）每次调用都重新取一次戳，戳变了就丢掉这条 standing
> 并**重新 compose**；戳是 `agent.cordis.yml` 的 `mtimeMs + size`（`:1807-1821`）。
> 所以：**改动组合文件 → 重跑 = 一次真正的重新挂载**；而**只改 `skills/**` 的技能正文 → 戳不变、
> 挂载被复用 → 重跑证明不了技能内容**（那要开一个真会话，或看技能 provider 的活读）。

### 挂载检查证明了什么、没证明什么（按库代码读，不是按印象）

`ACTIVE` 既**不是**「什么都证明不了」，也**不是**「这一行能用」。把这三种东西分开要靠库代码：

| 问题 | 判据 | `ACTIVE` 蕴含它吗 |
| --- | --- | --- |
| 这一行**能不能挂上** | `standingKeyFor` 不抛 | —（那就是它自己） |
| 这一行**尝试过注册且没抛** | `ctx.tools.register(...)` 抛不抛 | **是** —— 抛了就是 `FAILED(3)` |
| 这一行**真的注册了** | `mount(provider)` 是否跑过 | **否** |
| 这个工具**在当前 scope 可见** | `tools.get(name, scope)` / `view(scope).visible` | **否** |

后两格不是修辞，是库代码里可以直接读到的两个状态：

1. **注册是抛错的。** `ToolRuntime.register`（`dsh-tools/lib/index.js:2773-2782`）在插入前就校验
   `output` 形状、`output.schema`、`timeoutMs`、保留名 `run_code`；重名由 `NamedEntries` 的工厂抛
   （`:2538`），`tools.schemas()` 在投影参数 schema 时抛（`:2937`）。抛了 → `FAILED(3)`。
2. **但 `register` 的调用点在一个闭包里，而且是有条件的。** 它只在
   `dsh-tool-subagent/lib/index.js:398` 的 `mount(subagentProvider)` 里被调用，而 `mount` 的调用点只有两处：
   `:574`（`if (present !== void 0) mount(present)` —— provider 已在场）与 `:566`（`provider-added` 事件）。
   **provider 缺席时 `mount` 根本不跑**，`:575` 只记一条 `info`（原文：*"…not registered yet; the tool will
   register when it appears"*），而 `apply` **正常返回**。所以 `ACTIVE` 与「注册了什么」之间没有蕴含关系。
3. **注册过的还会被撤掉。** `:568-572` 的 `provider-removed` 处理器调 `mounted.disposeTool()` 并把
   `mounted` 置空 —— 这一行仍然 `ACTIVE`，工具已经不在。
4. **「注册了但这个 scope 看不见」是库自己承认的状态。** `:579` 那段提示的 `text` 是一个**活状态的函数**：
   当 `mounted === void 0` **或** `runtimeCtx.tools.get(toolName, context.scope) === void 0` 时它返回空串。
   活读的路子是 `ToolRuntime.schemas(scope)`（`dsh-tools/lib/index.js:2918`）。

**这条读法对本 preset 的四个专家行成立**：每行是**固定名的 `ToolDefinition`**（`toolName` 在组合里写死），
`modelSelectionSettings` 未启用，所以不走「按 agent 分别 `installScoped`」那条按 agent 注册路径 ——
那些工具注册在**该 preset 的 context 层**，preset 上的每个 agent 都继承得到。

> **一条结构性后果，比缺一次读数更值得记：** 那条真正能回答可达性的活读（`Tool.listTools`，
> 返回「本 agent 当前可调用的每个工具」，`dsh-tool-cordis/lib/index.js:9038-9052`）**只能在一个装了
> `tool-cordis` 的会话里跑**。`dsh-script` 刻意不含那一行，**所以它无法自验自己的工具表** ——
> 关于它的工具表，到今天为止**没有任何读数**。

### 验收的判别键是**具名专家**

| 在**新会话**的工具表里看到 | 结论 |
| --- | --- |
| `expert_script` ＋ `expert_doctor` ＋ `expert_dialogue` ＋ `expert_continuity`，且**没有** `subagent_fork` / `workflow` / `ralph` / `subagent` / `tool-goal` | 是 `dsh-script` |
| 那四个里少了任何一个，而 `expert_board`／`expert_verifier`／`expert_chronicler` 在表内 | 那是旧的 `dsh-duanju`，不是这一版 |
| `expert_architect` / `expert_protocol` 那一族 | 还在 `dsh-smith`，会话没换 preset |

**不要用会话头里的 `agentPreset` 判断** —— 它是创建期提示，不是挂载结果；**工具表才是权威**。
**也不要用 `duanju_gate` 在不在表里判断**：那三件工具是宿主面的，对**每一个**会话可见，
所以它们证明的是**宿主行挂上了**，不证明这个会话跑的是 `dsh-script`（`:40-44`）。

---

## 七、已知的边界与未做的事

- **不声称**（四条都**没有**读数）：`dsh-script` 的挂载、它的工具到达模型、那三件 `duanju_*` 工具
  在任何会话里可见、以及**GUI 模式选择器何时反映一个新装的 preset**（源码只证明 `list()` 不缓存，
  界面侧的刷新时机未实测）。
- **规则文件不由本 preset 创建，今天也确实不存在。** `agent-instructions` 的候选文件是
  `AGENTS.md` / `CLAUDE.md` / `DRAMA.md`（本地版 `AGENTS.local.md` / `DRAMA.local.md`），项目根标记是
  `.git` / `AGENTS.md` / `DRAMA.md`（组合文件的 `durable workspace instructions` 一节，`:268-294`）。
  **实测 2026-09-24：`D:\AIVideo` 下这五个候选全为 `False`，只有 `.git` 存在** —— 所以从那里起的会话
  **读不到工作区规则层**，本 preset 全靠自己的技能运转。你建了其中任何一个，下一次读取就会带上它
  （**不需要重启**）。—— 注意 `maxSourceBytes: 49152`：超过这个大小的规则文件会被**整份忽略且不留任何标记**，
  所以要让规则文件保持可分片。
- **一个剧目录同时只能有一个写者。** `dsh-aivideo`、`dsh-duanju` 与 `dsh-script` 都可能写同一个
  `products\<剧名>\`；preset 挡不住，所以它是一条写进人格的纪律（工作区 D-10 记过这类事故）。
- **平台的评级只有平台能给。** 工具、技能与专家都**不许预测评级**；读数来自你在会话里的**转述**
  （本机没有该平台的登录态），所以记录时必须标注「本次读数为用户转述」，不要升格成实测。
- **Phase 2（本次没做）**：把共享手艺技能迁到 `D:\AIVideo\.dsh\skills\` 只存一份。
  只有所有会话都从那棵树里起才划算，否则会丢掉 cwd 之外的技能。
- **源文件里的 Phase 2 已经落地了一半，写在这里免得读者去别处找**：闸门与状态投影**现在**是一件
  宿主面插件（`dsh-duanju-script`；目标态三件工具，盘上今天六件 —— 见第四节末）。源文件把它列为
  「等 pwsh 调用真的开始出错再做」；它做出来了，而 `board-to-xlsx` 一类**不再需要** —— 分镜表出了范围。

---

## 八、来源与许可

本 preset 的 `dramaturgy` 与 `hook-ladder` 两个技能源自本机的**用户自建** preset `dsh-aivideo`
（该 preset 不在本仓库内、也不由本仓库发布）。复制是**单向**的，`dsh-aivideo` 从未被本仓库修改。
其余技能为本仓库原创；源文件里另外两个（`shotlist`、`dsh-runtime-reference`）**不随这一版**。

`dsh-script` **不分发、不缓存有戏AI 的任何前端产物**。这一版比源文件更窄：平台模板与分镜表已整体出范围，
所以它携带的只有**方法**与**带出处的引文**（闸门条件与评级映射的原文），以及本工作台自己的篇幅实测
（2 526 字 → D 55.7；20 554 字 → A 82.6）。

许可：MIT，见 [LICENSE](../LICENSE)。
