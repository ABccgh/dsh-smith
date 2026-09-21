# `dsh-duanju` · 短剧工坊 · DSH Duanju

一个 DeepSeek Harness agent preset：**竖屏短剧生产**，从选题到可投稿。

它做一条产品线，不是一类业务：

```
① 编剧(智能体)  正文 2000 字/集以内，1600–1900 字为目标
      ↓  交付 products\<剧名>\script\可导入-<剧名>-全N集.txt
② 平台评估(你)  有戏AI：登录 → 粘贴剧本 → 生成剧集 → 立即发起评估
      ↓  把读数带回来
③ 读数回填(智能体) 写进 评估报告-回填.json 的 readings[]，跑 E19b，报差值
      ↓
④ 你说「满意」
      ↓
⑤ 分镜表(智能体)  28 列 CSV → 平台可导入的 xlsx
      ↓
⑥ 出片与投稿(你)  生成故事板/剧集、填发布表单、提交
```

**② 和 ④ 是硬闸门。** 智能体在 ① 之后结束回合，在 ③ 之后再次停下 —— 直到你说满意。
**它绝不在你说满意之前写分镜表**：本地闸门的 `PASS` 是**手艺**判据，平台的评级是**内容**判决，
而本项目实测过一份本地断言全绿的剧本被平台判 **D 55.7**。

---

## 一、它不是通用视频工作台

本机另有一个**用户自建** preset `dsh-aivideo`（AI 视频变现工作台：接单、报价、多种变现方式，12 个技能）。
`dsh-duanju` 是那个能力面的**窄化版**：一条产品线、一个平台、一条流水线。

| | `dsh-aivideo`（用户自建，不在本仓库） | `dsh-duanju`（本仓库） |
| --- | --- | --- |
| 人格 | 视频制作流程负责人，按单交付 | 短剧工坊，按**平台评估闸门**推进 |
| 技能 | 12 个（含接单、报价、旅游宣传片、信息流） | 8 个（全部在短剧链上） |
| 出片通道 | 即梦 CLI 为主 | **有戏AI 平台**（人在网页上做） |
| 委派 | 整个 delegation 组已删 | 四位具名专家 ＋ `subagent_fork` |

**两者并存，不互相覆盖。** 本仓库从未修改 `dsh-aivideo`。

---

## 二、它不能做什么（这条要写在最前面）

**有戏AI 的登录、剧本粘贴、分镜表导入、生成、发起评估、发布 —— 这六步只能由人在网页上做。**

这不是权限设置，是**能力边界**，实测的：

- 这个平台**没有 CLI**（`D:\AIVideo\tools\` 下没有任何脚本会联系平台）；
- **没有公开 API**（`/openapi.json` 与 `/swagger` 都 404；`docs.` / `open.` / `api.` / `developer.` 子域全 NXDOMAIN）；
- 它的私有 app API 可以从它的前端产物里枚举出来（30 多个端点），但**每一个调用都要从已登录浏览器的 `localStorage` 读 `token`**；
- **本工作区里没有任何凭证** —— 全树递归搜 `.env*` / `*token*` / `*cookie*` / `*credential*` / `*secret*` → **0 个文件**。

所以 `dsh-duanju` 里**没有**一行引用插件，也**没有**任何配置键写着 token。
把这些步骤包装成工具会是在假装一个有戏AI 不提供的接口 —— 那比不做更糟，因为流程看起来在往前走，而实际上它在等人。

> 要让其中一部分变成可驱动的，需要你提供一个凭证（`localStorage` 里的 token 与 channel）。
> 那是**你拥有**的决定，不是一次 preset 编辑 —— 计划里把它列为「本次不做」的 Phase 2。

---

## 三、8 个随行技能

| 技能 | 装什么 |
| --- | --- |
| `dramaturgy` | 编剧方法论：选题、一句话钩子、人物、12 集结构、分集功能表 |
| `hook-ladder` | 钩子工程：每集前 3 秒、集尾悬念可接住性、付费卡点 |
| `script-delivery` | **工序与交付契约**：编与烧分离、四条硬约束、三态纪律与退出码、评估回环的四步 |
| `youxi-platform` | **平台边界**：六道发布闸门＋表单五条、三份模板真实表头、报告字段与评级映射、三个读数陷阱 |
| `shotlist` | 28 列分镜表的字段定义与逐列映射、`@[主体]` 语法、镜头词表、可拍性自查 |
| `drama-workspace` | `D:\AIVideo` 的目录与脚本契约、并发写锁、硬编码路径、素材侧硬规则 |
| `drama-project-memory` | 四层记忆纪律：编年 / 只追加的决策 / 台账 / 读数层 |
| `dsh-runtime-reference` | 本部署的路径、双平面、校验命令 |

### 技能从哪来

`dramaturgy`、`hook-ladder`、`shotlist` 三个源自 `dsh-aivideo`。**`shotlist` 不是逐字复制** ——
它被按代码校正并留痕：

| 位置 | 说的 | 性质 |
| --- | --- | --- |
| `D:\AIVideo\tools\script-gate.mjs:85-116` 的 `REQUIRED_COLUMNS` | **28** | **权威** |
| `script-gate.mjs:28,33` 自己的注释 | 20 | 陈旧 |
| `board-to-xlsx.mjs:3` | 25 | 陈旧 |
| `dsh-aivideo\skills\shotlist` 前身 | 25 | 陈旧，且自称唯一权威表 |
| 盘上产物 `第NN_15列_平台导入.xlsx` | 15 | 正确 —— 那是**平台模板**的列数 |

同一份技能里还有一次**方向搞反的「更正」**：它**先写对了**（13 列的「参考生视频」模板删掉的是「站位」与「镜头图片提示词」），
随后「更正」成「也删掉了『分镜描述』」—— **实测解出的 xlsx 证明先写的那句才对、那次更正才是错的**：
真实表头里有 `分镜描述`，没有 `站位`、也没有 `镜头图片提示词`。
（顺带一条同源的：`script-gate.mjs:22-25` 至今仍是反的那一版 —— 它说删的是「站位」与「分镜描述」，
而它自己紧接着印出的表头里就有 `分镜描述`。**那个文件是技能被要求信任的对象，它这句是错的。**）
本仓库的副本按正确方向重写，并把这次漂移写进技能正文本身。
**技能的立场是：列契约以代码为准，不要引用任何文档里的数字，包括技能自己。**

### 技能遮蔽：工作区可以单方面覆盖它们

`dsh-skill-filesystem` 的根与优先级（`lib/index.js:21-25,150-165`；比较是**升序**，所以数字小的赢）：

| 根 | rank | 依赖 cwd？ |
| --- | --- | --- |
| `<项目根>\.dsh\skills` | 100 | **是** |
| `<项目根>\.agents\skills` | 200 | 是 |
| preset 的 `customSkillDirs`（本 preset 的 `skills\`） | 300 | 否 |
| `~\.dsh\skills` | 400 | 否 |

**所以：把新版本放到 `D:\AIVideo\.dsh\skills\<名字>\SKILL.md`，它会覆盖本 preset 里的同名技能**（重复只记警告，不报错）。
这正是「两个 preset 各存一份手艺技能」这一代价的减损通道：契约要更新时，工作区自己就能改，不需要编辑 preset。
本 preset 的技能刻意与 `dsh-aivideo` 的同名（`dramaturgy`、`hook-ladder`、`shotlist`），就是为了让这条通道可用。

反过来，**技能放在 preset 内而不是只放工作区**，是因为项目本地根**依赖 cwd**：
会话在 `D:\AIVideo` 之外起，就**静默丢掉全部短剧技能**，没有任何报错。

---

## 四、组合：28 个具名行

25 个叶行 ＋ 3 个 group。用 `node bin/preflight.mjs --preset dsh-duanju` 复读，实测：

```
rows: 28      validated: 17   skipped: 9   failed: 0      PREFLIGHT PASSED
```

**发布 0 个服务。** 三个 `isolate` realm 都在 preset 内、寿命与会话一致：

| group | realm | 谁发布 |
| --- | --- | --- |
| `planning` | `planMode` | `plan-mode` |
| `compaction` | `compaction` + `toolResultPruner` | `compaction-basic` / `tool-result-pruner`（消费者与提供者必须同 realm） |
| `team` | `workflowEngine` | **今天无人发布** —— 这是照抄同族已验证形状；日后加工作流必须**同时**加回 `workflow-worker-thread` 与消费者 |

其余一切（`tools` / `systemPrompt` / `skills` / `subagents` / `jobs` / `fs` / `shell` / `web` / `userQuestions`）
都从**宿主**解析，因此这些行**必须待在 realm 之外**。

### 四位专家

| 工具名 | 角色 | 特别之处 |
| --- | --- | --- |
| `expert_script` | 编剧 | `agentOptions.reasoningEffort: max` —— 唯一钉推理档的角色，因为它的错误代价是乘性的 |
| `expert_board` | 分镜与出片 | 列契约只从 `REQUIRED_COLUMNS` 读 |
| `expert_verifier` | 对抗性复核 | `toolFilter: { deny: [write, edit] }`，保留 `pwsh`（自己跑闸门是它的方法） |
| `expert_chronicler` | 史官 | 维护 `D:\AIVideo` 的四层记忆 |

外加 `subagent_fork`。**五个委派行逐行写 `maxDepth: 2`** —— 省略会解析成 schema 默认 3，
专家在深度 1 于是能比 lead 自己挖得更深；深度链因此是 agent(0) → expert(1) → helper(2)。

### 刻意不装的行

`tool-goal`/`command-goal`（长程状态已有归宿，再加一条会造第二份真相）、
`tool-ralph`（每一次迭代之间隔着一次你要付费的生成和一次平台判决，看不见对话的新 agent 无从判断该不该继续花钱）、
`tool-workflow`/`workflow-worker-thread`、通用 `tool-subagent`、
两条产品提供者行（`codex`/`claude-code`）、`tool-presentation`、`tool-cordis`。
每条的理由写在 `agent.cordis.yml` 末尾的 `DELIBERATELY ABSENT` 段。

**`tool-ask-user` 保留了**（与 `dsh-ck3-mod` 相反）：投哪家平台是**你拥有、读文件读不出来**的选择
——工作区的平台对照记录着腾讯与快手星芒**各自排他**，不能同时投。

---

## 五、安装

```sh
node bin/install.mjs --preset dsh-duanju
```

装到 `${DSH_HOME:-$HOME/.dsh}/.agent-presets/dsh-duanju/`。**不需要重启 harness 进程**
（`dsh-agent-presets` 的发现不缓存：`lib/index.js:1152-1158`），但**必须开一个新会话** —— preset 在会话启动时挂载。
在模式选择器里选「**短剧工坊 · DSH Duanju**」。

---

## 六、验证状态

**按字面读。**

| 项 | 读数 |
| --- | --- |
| 技能 lint | **8/8 clean**（`node bin/lint-skills.mjs --preset dsh-duanju`） |
| 静态预检 | **PREFLIGHT PASSED** —— `rows: 28`，`validated: 17   skipped: 9   failed: 0` |
| 与出厂上游的差异 | `node bin/drift-check.mjs --preset dsh-duanju`：共享 22 行（5 行有差异）、本 preset 独有 6 行、上游独有 9 行 —— **差异逐条即设计** |
| 打包面 | `node bin/check-pack.mjs` → **PACK OK**，`dsh-duanju` **10/10 文件**、**8 个技能**在 tarball 里 |
| 安装一致性 | `agent.cordis.yml` SHA256 仓库副本与安装副本**逐字节相同** |
| CI | 本 preset **有** `lint-skills` 与 `preflight` 两步（它的每一行都从出厂包解析，runner 上能过） |
| **挂载（`standingKeyFor`）** | **`mounted OK`** —— 2026-09-21 实测，出厂 `cordis` preset 的会话内；25 条目 / 24 个 enabled 行全 `ACTIVE`。见下 |
| **工具到达模型** | **用户转述的一次读数成立**（2026-09-21 之后的一个 `dsh-duanju` 会话）：`expert_script` / `expert_board` / `expert_verifier` / `expert_chronicler` / `subagent_fork` 在表内，`workflow` / `ralph` / `subagent` / `tool-goal` 缺席。**本机没有该会话的机器可读台账**，故按转述记名——来源见下 |
| **有戏AI 私有接口可用性** | **未验证** —— 无凭证，**没有发出过任何请求** |

### 挂载检查怎么跑（`bin/` 里的脚本做不到，出厂 `cordis` 的会话可以 —— 2026-09-21 已跑通）

`agentPresets.standingKeyFor('dsh-duanju')` 是**唯一算数**的挂载检查，而它需要一个跑在**出厂 `cordis` preset** 上的会话：
`cordis_*` 工具只在那里注册（`dsh-smith` 把它们 `disabled`、`dsh-forge` 与 `dsh-duanju` 根本不含那一行）。

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

期望：`preset_check { id: 'dsh-duanju' }` 返回 `mounted OK`。
被拒时的消息会点名 offending 行与服务（`N row(s) did not activate: <id>: waiting for <service>` /
`row(s) published process-global service(s) [<name>]` / `service "<name>" has been registered at <Owner>`）。
探针是探针，用完 `cordis_undefine` 收掉。

**实测（2026-09-21，出厂 `cordis` preset 的会话 —— 工具表里有整套 `cordis_*`）。**

- `preset_check { id: 'dsh-duanju' }` → **`mounted OK (standing key: object)`**。四种被拒形态一个都没出现。
- `compositionInventory` 从 **live Loader entries** 回答（不是文件解析）：`trust: user`、`broken: null`、
  **25 个条目**，其中 **24 个 `enabled: true` 的行全部 `fiberState: 2`**，`tool-bash` 是
  `enabled: false` + `fiberState: none`。`2` = `FiberState.ACTIVE`
  （`@deepseek-ai/cordis/lib/types/fiber.d.ts:67-74`）—— **这个数要先解码再报**，2 与 3 之差正好是成与败。
- **25 与静态预检的 `rows: 28` 不矛盾**：文件里 28 条 `- id:`，其中 3 条是 `cordis:group` 结构行
  （`planning` / `compaction` / `team`），只以子行出现；28 − 3 = 25，逐条对得上。
- 安装一致性复核成立：仓库副本与安装副本 SHA256 同为
  `BA818BC0EF188BDE6366D9DD8EF27C08EC537FC38BD810B105A87A378D823DB3`。
- **哪一半没闭合：** 挂载检查不回答「工具到达模型」。`ACTIVE` 不等于「这一行能用」，
  也**不**等于「它什么都没注册」—— 它排除的是**尝试注册并抛错**（那会 `FAILED(3)`），
  而注册本身在一个**有条件的闭包**里（见下一小节）：provider 缺席时它不跑，被移除时它被撤掉。

> **这条检查改完组合之后可以重跑，而且重跑是有意义的。** `ensureStanding`
> （`dsh-agent-presets/lib/index.js:1767-1800`）每次调用都重新取一次戳，戳变了就丢掉这条 standing
> 并**重新 compose**；戳是 `agent.cordis.yml` 的 `mtimeMs + size`（`:1807-1821`）。
> 所以：**改动组合文件 → 重跑 = 一次真正的重新挂载**；而**只改 `skills/**` 的技能正文 → 戳不变、
> 挂载被复用 → 重跑证明不了技能内容**（那要开一个真会话，或看技能 provider 的活读）。
> 探针用完记得 `cordis_undefine`。

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
   当 `mounted === void 0` **或** `runtimeCtx.tools.get(toolName, context.scope) === void 0` 时它返回空串 ——
   两个析取项正好就是上面最后两格。`view(scope)` 沿 scope 链把各层并起来并逐层过 `admits`
   （`dsh-tools/lib/index.js:2854-2880`）。活读的路子是 `ToolRuntime.schemas(scope)`
   （`dsh-tools/lib/index.js:2918`，声明 `schemas(scope?: ScopeKey): ToolSchema[]`）。

**这条读法对本 preset 的四个专家行成立**：每行是**固定名的 `ToolDefinition`**（`toolName` 在组合里写死），
`modelSelectionSettings` 未启用（`grep` 全文 0 命中），所以不走 `:588-644` 那条「按 agent 分别
`installScoped`、在 `agent/created` 上 reconcile」的按 agent 注册路径 —— 那些工具注册在**该 preset 的
context 层**，preset 上的每个 agent 都继承得到（`view` 把链上每一层都并进来）。

> **一条结构性后果，比缺一次读数更值得记：** 那条真正能回答可达性的活读（`Tool.listTools`，
> 返回「本 agent 当前可调用的每个工具」）**只能在一个装了 `tool-cordis` 的会话里跑**
> （`dsh-tool-cordis/lib/index.js:9038-9052`），而 `dsh-duanju` **恰恰没有**那一行
> （见下方「刻意不装的行」）。所以 **duanju 会话永远无法自己验自己**，除非另加探针。
> 给它加探针不在本次范围内 —— 记在这里，因为「另一条会话替我验了一遍」与「它能自验」是两回事。

### 验收的判别键是**具名专家**

| 在**新会话**的工具表里看到 | 结论 |
| --- | --- |
| `expert_script` ＋ `expert_board` ＋ `expert_verifier` ＋ `expert_chronicler` ＋ `subagent_fork`，且**没有** `workflow` / `ralph` / `subagent` / `tool-goal` | 是 `dsh-duanju` |
| `expert_architect` / `expert_protocol` 那一族 | 还在 `dsh-smith`，会话没换 preset |

**不要用会话头里的 `agentPreset` 判断** —— 它是创建期提示，不是挂载结果；**工具表才是权威**。

---

## 七、已知的边界与未做的事

- **不声称**：GUI 模式选择器何时刷新、有戏AI 私有接口可用 —— **这两条仍未测过**。
  （「preset 挂得上」2026-09-21 已实测为 `mounted OK`；「工具到达模型」已收到一次用户转述的读数，
  记在第六节的表里 —— 它证明的是**可达性**，不是逐行贡献，也不是「委派真的能跑起来」。）
- **不写 `D:\AIVideo` 里的任何文件。** `agent-instructions` 已把 `.git` 与 `AGENTS.md` 列为项目根标记、
  候选文件是 `AGENTS.md` / `CLAUDE.md` / `DRAMA.md`；**今天这三个都不存在**，所以从那里起的会话读不到工作区规则层，
  本 preset 靠自己的技能运转。你建了其中任何一个，下一次读取就会带上它（**不需要重启**）。
  —— 注意 `maxSourceBytes: 49152`：超过这个大小的规则文件会被**整份忽略且不留任何标记**，所以要让规则文件保持可分片。
- **一个剧目录同时只能有一个写者。** `dsh-aivideo` 与 `dsh-duanju` 都在时，两个会话可能写同一个
  `products\<剧名>\`；preset 挡不住，所以它是一条写进人格的纪律（工作区 D-10 记过这类事故）。
- **Phase 2（本次没做）**：把 `script-gate` / `episode-build` / `board-to-xlsx` 包成宿主平面插件。
  触发条件是 pwsh 调用真的开始出错。约束已经查明：插件必须 `inject` 宿主 `shell` 而不是 `child_process`，
  且必须坐在任何 realm **之外**，否则就是绕过宿主沙箱与审批 —— 那是 preset 绝不能做的事。
- **Phase 2（本次没做）**：把共享手艺技能迁到 `D:\AIVideo\.dsh\skills\` 只存一份。
  只有所有会话都从那棵树里起才划算，否则会丢掉 cwd 之外的技能。

---

## 八、来源与许可

本 preset 的 `dramaturgy`、`hook-ladder`、`shotlist` 三个技能源自本机的**用户自建** preset `dsh-aivideo`
（该 preset 不在本仓库内、也不由本仓库发布）。复制是**单向**的，`dsh-aivideo` 从未被本仓库修改。
`dsh-runtime-reference` 复制自本仓库 `dsh-ck3-mod`。其余五个技能为本仓库原创。
`dsh-duanju` **不分发、不缓存有戏AI 的任何前端产物**：它携带的是方法，以及**带出处的引文**
（三份官方模板的列名、闸门条件与评级映射的原文）。

许可：MIT，见 [LICENSE](../LICENSE)。
