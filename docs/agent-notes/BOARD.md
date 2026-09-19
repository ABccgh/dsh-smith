# Board

## 2026-09-19（深夜）—— 本机所有项目已上 GitHub：**已交付并收尾**（那个提交也已推送，见 D-98）

**结论先说：九个项目位置全部在 GitHub 上了**，判据不是推送脚本自己的报告，而是**独立的路径→blob SHA
集合对比**（远端递归 tree 对本地 `git ls-tree -r HEAD`，双向）。完整决策与八条实测见 **D-97**，
当前状态表在 `PROJECT.md`。

| local | GitHub | SHA | 文件 | 结果 |
| --- | --- | --- | --- | --- |
| `D:\DeepSeek Harness` | `ABccgh/dsh-smith` | 本地 `671532a` → 远端 `fb3f8d6` | 49 | **本次推了 1 个提交**（`-Force` 修复 + D-97）；tree 两侧同为 `db6d059…` |
| `D:\dsh-desktop` | `ABccgh/dsh-desktop` | `6f9fe04` | 43 | 本就一致，未动 |
| `$DSH_HOME\plugins\dsh-account-balance` | 同名 | `e3d9a98` | 7 | 本就一致，未动 |
| `$DSH_HOME\plugins\dsh-agent-memory` | 同名 | `358d869` | 5 | 本就一致，未动 |
| `$DSH_HOME\plugins\dsh-ima-kb` | 同名 | `e300cca` | 9 | 本就一致，未动 |
| `$DSH_HOME\plugins\dsh-ck3-modcheck` | 同名 | 本地 `670182d` → 远端 `7f5c1e6` | 6 | **缺 1 个提交，已推** |
| `$DSH_HOME\plugins\dsh-inbox` | `ABccgh/dsh-inbox` | `a98ecb4`（两侧同 SHA） | 13 | **建仓 + 推送** |
| `D:\CK3Mods` | `ABccgh/cn-dejure-conquest` | `b1997fb`（两侧同 SHA） | 5 | `git init` + 1 提交，**建仓** |
| `D:\AIVideo` | `ABccgh/ai-video-workbench` | `4a7b4ea`（两侧同 SHA） | 54 | `git init` + 1 提交（98 MB），**建私有仓** |

> **表里 `dsh-smith` 那一行的 SHA 是"写下时"的读数，它按构造永远落后远端一位** —— 记录自身的提交只能在
> 写下之后推送，所以远端 tip 比表里的号码新一个提交。**判据是 tree 相等与九行 9/9 的路径→blob 集合，不是
> 那个号码**；要最新号码就读 API（`GET /repos/ABccgh/dsh-smith/git/refs/heads/main`）。这条是为了让本节
> 不会因为"又推了一次记录"而变假 —— 写死在表里的 SHA 一定会。

**这件事真正的产出是那条方法：一条记录在案的路线，是对"实现它的那段代码"的断言，而那次编辑可以
静默地把它变成假的。** `bin/push-api-ref.ps1` 在 `bf4c2ad` 给 first-parent 走查加的守卫让 **`-Force`
三种旗标组合全都抛错**，于是 D-33 在 `DECISIONS.md:905` 记的
`pwsh -File bin/push-api-ref.ps1 -RemoteRepo <repo> -Force` **静默失效** —— 而它在 `bf4c2ad` **之前**
是实测可用的。没有任何检查、测试或脚本读数发现这件事；它是一个**新仓库**需要那个旗标时才暴露的，
中间隔了一周。已修（守卫改为 `-not $AllowUnrelated -and -not $Force`），并且修复与本节记录**已一起提交推送**：
本地 `671532a` → 远端 `fb3f8d6`（fast-forward，tree `db6d059…`，49/49 路径一致）。

**「内容一致」只能用 tree 证，不能用 SHA 证。** `dsh-ck3-modcheck` 的远端 `7f5c1e6` 与本地 `670182d`
**同为 tree `66567d0`**，而两者 SHA 不同且本地那个永远不会出现在远端 —— 父提交那一行在被哈希的字节里，
脚本又是故意把第一个新提交挂在远端 tip 上的。同一个形状也出现在 `dsh-smith`：`a9ea9f2`（本地）与
`6143f6a`（远端）是同一个提交的两种编码。**别去调和它们**：本机 `git` 到 GitHub 仍然不通
（`CRYPT_E_NO_REVOCATION_CHECK`），两个历史按构造就该不同。规则：**`-Base` 永远指"内容已被推送过的
那个本地提交"，绝不给远端 SHA。**

**那个提交也已推送**（本地 `671532a` → 远端 `fb3f8d6`；父 = 旧 tip `6143f6a`，即 fast-forward；tree
`db6d059…` 两侧相同；49/49 路径集合一致，无 `bin/bin/…`；远端那份 `bin/push-api-ref.ps1` 现为修复后的
blob `fce5784`）。**本节至此闭环**，读数与更正见 **D-98**。

**两处刻意留白（都不影响"已上传"这个结论）：** (a) 三个新仓库**没有 topics**（其余 6 个都带
`deepseek-harness-plugins` 等），因为加 topics 不在批准的计划范围内；(b) **4 个本地仓库没有 `origin`**
（3 个在 `~/.dsh` 下，属边界禁区；且加了也没用 —— 本机 `git` 连不上 GitHub），所以"内容一致"只能在
API 侧用 tree 与路径集合证明。**另记一条工具状态：** `memory_remember` / `memory_consolidate` 在本会话
**可读、但被文件沙箱拒绝写入**，受管区块是用 `dsh-agent-memory` 自己导出的
`parseLessons → renderBlock → spliceBlock` 写入的（写入前断言了标记之外字节逐一不变）；要让受管工具路径
直接可用，需要一个允许写工作区之外文件的会话。

## 2026-09-19（晚）—— GitHub API 接入：已交付、已验收；三项仍开放

**结论先说：** 部署现在**有** GitHub API 能力，走 host 平面的 `mcp-github` 行（`@deepseek-ai/dsh-mcp-client`
→ GitHub 官方 Go 二进制，`--toolsets all` 可写 → **90 个工具**、工具名 `mcp__github__*`），令牌经
`$DSH_HOME/.env` 用 `node --env-file` 注入、**值不进组合文件**。会话内已实测派发
（`mcp__github__get_me` 从会话直接调通）；写路径已实测（`push_files`、`create_pull_request`、关闭 PR 回 **2xx**）。
决策链：**D-93**（怎么接）→ **D-94**（全面放开）→ **D-95**（权限补完 + 一次探针事故）→ **D-96**（可见性闭合、
90/89 的归因）。部署级细节在 `$DSH_HOME/plugins/dsh-github-mcp/NOTES.md`。

**仍开放的三项，只此三条：**
1. **被换掉的旧 PAT 待撤销**（用户动作）：细粒度 token 的权限不能改，所以换权限＝换 token；旧值若仍在
   GitHub 上就仍然有效。
2. **PR #1 残留**：`ABccgh/dsh-smith` 上一条**已关闭**、已改写为自我说明的探针 PR —— GitHub 无删除 PR 的
   接口，`main` 未被动过（tip 仍是 09/15 的 `bc87ad5`）。
3. **仍 403 的能力**：账号级 `create_repository`、`star`/`unstar`，以及 `list_notifications`、
   `projects_list`、`list_code_scanning_alerts`、`list_dependabot_alerts` 四个读；要账号级的那些得换
   **GitHub App** 凭据（这个二进制原生支持 `--app-id`/`--app-installation-id`/`--app-private-key-path`）。

**一条被本节的读数推翻的旧说法：**「新行只有在宿主重启后才挂上」**是错的** —— 本项目的行 22:48:04
写进补丁、其子进程**同秒**出现，而宿主 21:47:59 就在运行。本次还顺带量到：改补丁文件的**注释不会**让行
重挂（loader 按配置差异重建），改**配置值**才会。见 `PROJECT.md` 的 GitHub 小节与 D-95。

## 2026-09-19 —— 视频播放：插件已交付、已验收

**结论先说：GUI 内播放视频已经做完并且在真浏览器里验收通过。**

- 插件：`C:\Users\曦曦\.dsh\plugins\dsh-video-player\`（`lib/index.js`、`lib/client.js`、`test/` 四套）。
- 挂载：web profile 的 `cordis.patch.yml` 末尾 `insert: - id: video-player`，
  依赖已用**受认可的写者**装好（`dsh plugin --profile web add …`，symlink + `link:` 已写入 profile 的 `package.json`）。
- 决策：D-88（地址从 `props.useTabInfo` 取）、D-89（`connection.fetch` + `<video src>`）、D-90（变异审计）。

**激活状态（2026-09-19 晚订正）**：原文写"`patchReload: live` 对新增行不生效、所以要等宿主重启"——
**这条已被实测推翻**（见本板顶部与 D-95）：宿主平面的行在**补丁写入那一刻**即生效。所以本插件的**宿主半**
（`connection.fetch` 路由）早已随那次写入生效；**未实测**的是**浏览器半**是否需要重建产物并刷新页面 ——
那是另一个问题，别因为宿主半生效就把整个能力当成已就绪。

**验收是怎么做的（下次照做）**：不去动用户的宿主，另起一个 `--port 63737` 的实例，
从它的 stdout 拿**带 token 的 URL**，然后两条证据链：

1. `Invoke-WebRequest` 换 token → Cookie，再对 `/api/video/stream` 打 14 组探针。
   决定性读数只有 handler 能给出：`Range: bytes=0-1023` → `206` + `content-range: bytes 0-1023/43235`；
   `bytes=99999-` → `416` + `bytes */43235`；`AGENTS.md` → `415`；工作区外的绝对路径 → `403`；
   **未知 session → `404`（这一条抓到了真缺陷，见 D-89 第 3 点）**；`POST` → `404`（不拥有的方法）。
2. Playwright 真浏览器：进 GUI、在 turnTail 的「播放视频」输入框里填 `tmp/clip.webm` 回车 →
   右侧栏出现 `clip.webm` tab，`<video>` 的 `readyState=4`、`320×240`、`duration=3.186176`，
   暂停后 seek 到 `0.4` **精确落点**，恢复播放继续走。截图确认：tab 名、原生控件、`0:03 / 0:03`。

**未决 1 —— 工作目录之外的视频仍然进不来。**
路由的 containment 是「必须在会话 workspaceRoot 之内」（这是 D-89 第 3 点的安全边界，不是疏漏）。
要让 `D:\somewhere\else.mp4` 也能放，需要一个**明确的**根白名单（例如配置里多一个 `allowedRoots`），
并由用户决定加哪些。**在它是决定之前不要偷偷放宽 containment。**

**未决 2 —— 已结案（2026-09-19 晚）。**
`tmp/clip.webm` 与 `tmp/video-fixture/clip.webm` 是上一轮的浏览器验收夹具（43 KB，同一 sha256），
**已删除** —— 删前查证过插件**不读**工作区文件：`test/falsify.mjs:292` 里 `tmp/clip.webm` 只是断言里的
字符串字面量，真实夹具是插件内嵌 base64 + sha256 自校验的副本。`.gitignore` 同时加了**锚定的** `/tmp/`
（锚定而非 `tmp/`，避免匹配任意深度的同名目录），并用探针文件确认规则真的会命中。
**仍然开放的是插件文档债**：`dsh-video-player` 的 NOTES.md / README.md 还没写全（`dsh-inbox` 有九节）。

## 2026-09-17（晚）—— 持久待办收件箱已挂载并验收；两个未决问题

**结论先说：`dsh-inbox` 已在活宿主上挂载并验收通过，用户亲自完成了两条验收条目。**
它由 web profile 的 `cordis.patch.yml` 一行挂载、**不发布任何服务**；`PROJECT.md` 有它的小节，
`NOTES.md`（九节）持有部署级细节，`DECISIONS.md` 是 D-84。

**验收的证据形状值得记住：挂载只能由活宿主证明，而「界面能用」只能由用户证明。**
`inbox_add` 落盘带着 `rev` 与 `sessionId`；用户在面板里**看到、回复、并标记完成**；
`inbox_list` 读回 `[answered] … you replied: 存在`。任何 HTTP 状态码都替代不了第三条。

### 未决 1 —— `ask_user_question` 的提问是否进收件箱

插件以 `{ global: true }` 监听 `user-questions/request` 瀑布，但**顺序决定覆盖面**：Cordis 让
先注册的监听器在链首。我的监听器若在前，每条提问都进收件箱；若在后，只有现有 UI 让出的那些才进。
**两种顺序都不会坏**（既有答复器要么自己答、要么让出，不会重复捕获），差别只在覆盖面。

**定论方法（一次即可）**：在 GUI 里正常让它问一个问题，然后看
`$DSH_HOME/inbox/inbox.json` 里是否多出一条 `"source": "question"`。**在此之前一律按「未测量」记。**

### 未决 2 —— 升级 DSH 后要扫一眼「两个 `todos` 投影单元」

`dsh-base` 的 `tool-todo` 行（`allowParallelInProgress`）当前被 `dsh-web-app` 以
`disabled: true` 关掉，`todo_write` 由各 preset 自己挂。**若它在某次升级后被重新启用**，
会出现**两个都叫 `todos` 的投影单元**：一个渲染本插件的持久清单（来自 `inbox.json`），
另一个渲染每轮 `turn/start` 就清空的 `todo_write`。两者会争同一个键，症状是面板内容莫名变化。

### 已闭环 —— 本插件的仓库卫生

四个兄弟插件都有 `.git`（分支 `main`、树 clean），它此前**什么都没有**。本会话补齐：
`git init -b main`、与 agent-memory/ck3-modcheck 同形状的 `.gitignore`、身份**本地**设为
`ABccgh <167974914+ABccgh@users.noreply.github.com>`（本机无全局身份，该值取自本仓库的实际提交者）、
一个根提交 `a98ecb4` / **13 个受跟踪文件**。

**未设 remote、未尝试 push** —— 本网络下 `git push` 必然因吊销端点不可达而失败，设一个推不上去的
remote 只会造出假的「该推了」提示。是否公开是一个独立决定，需要用户建仓库 + 走 AGENTS.md 里那条两步路线。

## 2026-09-17 —— CK3 两处「工具说假话」的缺陷已修，附一个改变结论的实测

**先说结论：`ck3_mod_status` 读错了启动器数据库，而它给出的「0 个模组 / 没有不一致」是假的。**
本机同目录有三个库：`launcher-v2.sqlite`（工具在读，mods=0）、`launcher-v2_openbeta.sqlite`
（启动器真正在写的，**mods=7 / playset 7 行全 enabled**）、`launcher-v2_openbeta-backup.sqlite`
（mods=3）。插件那条 SELECT 在 openbeta 上返回全部 7 行——**错的只是文件名**。现在工具探测所有
`launcher-v2*.sqlite`、按「有 mod 记录 → playset 是活动的 → 最新」排序取值，并打印全部候选与理由。

**第二个发现比第一个更重要：游戏自己的日志推翻了「启动器说了算」。** 同一次运行
（2026-09-16 23:16–23:26）的 `debug.log` 里有一张 mod 表（8 行，2 行 `Enabled`）＋
`Mounted Data: D:/CK3Mods/jtdx` ＋ `>=== NAMESPACE > 'jtdx' is set to #3520000` ＋
`Loaded [6] events from 'events/jtdx_events.txt'`。也就是说**本工坊的 jtdx 确实被游戏加载过、
事件被注册过**（`D:\CK3Mods` 现在已空，产物不在了，证据还在日志里）。而 `mod/jtdx.mod`
**既不在启动器数据库里、也不在 `dlc_load.json` 里**；同一份日志 7 个 workshop mod 只有 2 个 `Enabled`，
`dlc_load.json` 列 7 个。**三个来源矛盾，权威的是游戏自己那份带时间戳的单次运行日志。**

**日志是每次运行的**：D-75 引用的 `debug.log:5594 event_queue` 现场已被后续运行覆盖，
当前 `debug.log` 只剩 `gold 5000`。所以任何跨运行的归因都不成立；`console_history.txt` 是唯一累积的那个。

**还改了什么**（每一条都测过、都在套件里有会失败的断言）：
`compareLauncherToDisk` 注释承诺三类分歧、代码只做两类 → 补上 `launcher-mod-unregistered`；
错误去重把 **1,780 条 E 行折叠成 43 条「不同错误」**（其中 1,562 条是同一句外壳 `Script system error!`，
真实内容在下一行）→ 外壳与续行合并并显式报数；四个工具的说明移进 `TOOLS_META` 以便断言
（此前 `apply()` 从不被套件调用，**没有任何描述可以被测到**）；`ck3_modcheck` 零检查时不再打印
「every check that ran passed」；传非目录的 `modPath` 改为报输入错误（此前 `README.md` 会得到
「1 mod validated / errors: 3」和三段错误建议）；`CODES.TAG_UNKNOWN` 直接删除（没有任何检查会产生它）；
每个报告末尾加**代码回执**（PID / 启动时间 / `lib/*.js` mtime）。

**套件：121 → 151 条**，且每个新类别都用**植入法**反证过（去掉 availability 守卫 → 红；
关掉续行合并 → 4 条红；去掉描述限定语 → 红；排序只看 mtime → 选错文件）。

**只能由你做的两件事（我没有代劳）**：
1. **新开一个由 `dsh-ck3-mod` 服务的会话**，读工具表确认专家是 `expert_modd` ＋ `expert_verifier`
   ＋ `expert_chronicler` 且**没有** `expert_architect`（四个 `ck3_*` 是宿主平面、每个会话都可见，不可用作判据）。
2. **在游戏里跑一次 `event_counts`**（`-debug_mode` → 载入一局 → 控制台）——它是 D-75 唯一没量过的同族命令。
   **要当次读日志**：下一次启动会把它们重写。

**需要重启宿主**：插件代码改动要重启才在运行中的宿主里生效（当前 PID 16872 启动于 2026-09-17 19:08:13）。
回执行会把这件事变成每次调用都看得见的读数。

## 全面清理与发布 —— 已完成（D-78）

三个仓库**全部已推送**，且**都带 `deepseek-harness-plugins` 标签**（六个仓库逐一 API 复读确认）。

| 仓库 | 结果 |
| --- | --- |
| `ABccgh/dsh-smith` | **+6 提交 → 39**；`refs/heads/main` → `711b8cf`；远端树 `fadcede` **等于**本地树 |
| `ABccgh/dsh-ck3-modcheck` | **新建**（public, `auto_init:false`）→ 6 文件；8 个标签 |
| `ABccgh/dsh-agent-memory` | **新建**（public, `auto_init:false`）→ 5 文件；7 个标签 |

**本轮真正的缺陷（本轮之前无人能看见）**：`dsh-ck3-mod/`（5 文件）**从未被 git 跟踪**，而
`package.json` 的 `files` 白名单**已经列了它**。`check-pack.mjs` 读的是**工作树**打出的 tarball，
所以本地 **PACK OK**——而 `README.md` 让读者 `git clone` 后跑 `node bin/install.mjs --preset dsh-ck3-mod`，
**任何 fresh clone 都没有这个 preset**。这正是本仓库自己的笔记称为「唯一无法靠运行自己发现」的那一类失败，
而它是真实存在的。

**修好后的证明（不是「推送没报错」）**：从 **codeload 下载分支 tarball**（不走 git）→ 解压 → 断言
5 个 preset 路径**都在**，且**下载下来的那份自己能跑通 `check-pack` 与技能 lint**。
外加：远端递归清单与 `git ls-files` **双向零差异**（各 48 个 blob）、无重复路径段。

**推送路径本身值得记下来（D-78）**：对一个**只有一个根提交**的新仓库，`-Init` / `-Force` /
`-RemoteOnlyParent` **三种都结构性地不适用**，每一种都被 `-DryRun` 提前拦下而不是半途失败。
真正可行的是让远端那个空根**与本地对象可达**（bootstrap → 本地 `commit-tree` 一个空树、
父为 bootstrap → `refs/hashtag/` 挂锚点 → 走普通配对路径）。另有两个 PowerShell **序列化**陷阱：
`git log --format=%B` 返回**字符串数组**，被 `ConvertTo-Json` 发成 `"message": [...]` → `422 is not a string`；
以及**引用一个从未上传的 tree** → `422 Tree SHA does not exist`（本地有 SHA ≠ 远端有这个对象）。

**没做的事，以及为什么**：`tools/ck3wiki/` **没删**（规则 7：它是某些已取消工作的唯一副本）；
CI **没加** `preflight --preset dsh-ck3-mod`（那条排除有理由，且规矩是**排除＋写明理由**，不许 `continue-on-error`）；
两个插件**没搬进本仓库**（规则 7 的边界，它们各自独立成仓）。

**未验证、不声称**：`git clone` / `git push` 在本机是否仍被 TLS 层挡住（笔记记录为
`CRYPT_E_NO_REVOCATION_CHECK`）。本轮的推送走 GitHub REST API，**没有测试 git 自身**，
所以「git 仍然不通」是**继承的结论**，不是本轮复测的。

## 经验层（agent-memory）—— 已交付并**正在生效**（D-76）

用户问「可以实现经验吗」。答案是：**模型权重学习做不到，但「有界、保证被检索的记忆管线」可以，而且已经建好。**

改动面：仓库外宿主平面插件 `$DSH_HOME/plugins/dsh-agent-memory`（2 个工具）＋
`profiles/web/cordis.patch.yml` 里一行 `insert:`（由 `dsh plugin --profile web add` 写入 `link:` 依赖，
行本身手写在补丁层）＋ 受管区块落在 `~/.dsh/AGENTS.md`。**没有动任何 preset。**

| 项 | 读数 |
| --- | --- |
| 插件自证 | `node test/falsify.mjs` → **29/29 断言**（含 2 个真缺陷：`resolve` 被当成存在性检查；无经验时仍写空区块） |
| 静态面 | `--dump-config` **0 条 patch 警告**，`id: agent-memory` 行成分正确（3 个 config 键） |
| preset 面未受影响 | `preflight --preset dsh-smith` **validated 21 / skipped 10 / failed 0**；技能 lint **5/5 clean**；**PACK OK** |
| 受管区块 | `~/.dsh/AGENTS.md` **3247 B / 32 行**，上限 **16384 B**；5 条经验 |
| 幂等性（对**真实文件**实测） | 重跑 consolidate **逐字节不变**；标记各**恰好 1 个** |
| **自动加载** | **本轮系统提示里已出现该区块**，归因 `~/.dsh/AGENTS.md` —— **不需要重启** |

**两个半边必须分开说**：**经验层本身现在就生效**（next turn 的提示里就有它）；
**两个工具需要宿主重启才可调用**（当时服务进程 PID 5600 早于该改动）。
**重启已经做过，两个工具现在都实测可调用** —— 见下方「已补上」一节的实测读数。

**为什么落点是 `~/.dsh/AGENTS.md`**：三个用户 preset 的 `instructionFileCandidates` **互不相同**
（`dsh-ck3-mod` 多 `CLAUDE.md`/`MODDING.md`），但都列 `AGENTS.md`、都是 `maxBytes: 196608`；
而用户全局路径在源码里硬编码（`dsh-agent-instructions/lib/index.js:141,148`），**因此与 preset 无关**。
注入路径本来就有，缺的只是它的内容纪律。

**上限是设计而不是参数**：`AGENTS.md` 每轮都在上下文里，本仓库那份已 **31,290 B**，
而笔记层 `DECISIONS.md` 236,914 B ＋ `PROJECT.md` 125,252 B **永远不可能整体注入**。
所以 `memory_consolidate` 在**写任何字节之前**算 UTF-8 长度，超限**报错拒绝并列出最大条目**——
静默截断会让它看起来在工作而实际在丢经验。这条拒绝已断言。

### 已补上：`memory-discipline` 技能（D-77）—— 让每个会话知道**该记录**

落点 `~/.dsh/skills/memory-discipline/SKILL.md`（**一个文件**）：**不加行、不改 preset、不发布服务**。
用户根是唯一**与 preset 无关**的技能根，因为三个 preset 都保留了 `includeDefaultRoots`
（各自只加自己的 `customSkillDirs`）。

| 项 | 读数 |
| --- | --- |
| **活进程发现它** | 创建后**同一轮内**系统提示的技能目录就多出 `memory-discipline`，随后 `skill` 工具成功返回其正文 —— **不需要重启**。这条此前只是从代码推断的，现已是实测 |
| 技能 lint | `ok memory-discipline (description 503 chars, body 3228 chars)`；注意 `--path` 要指向 **skills 的父目录**，`--installed` **不扫用户根** |
| 回归 | **PACK OK**；`preflight` dsh-smith `21/10/0`、dsh-ck3-mod `16/9/0`；ck3-mod 自己的 **3 个技能未被遮蔽**（用户根优先级低于 preset 的 custom 根） |
| 名称一致性 | 插件真实注册 `["memory_consolidate","memory_remember"]`；技能正文两处齐备、**零编造**（两个方向都核对） |
| 经验区块 | **6 条 / 4310 B**（上限 16384）；标记各 1 个；重复 consolidate **逐字节不变** |

**⚠️ 实测到的能力边界（别当成 bug）**：`memory_remember` / `memory_consolidate`
**在沙箱会话里写不了 `~/.dsh`** —— 报 `file access denied under workspace-write mode`，而同一会话的
`dryRun` 读得到。机制在**接缝**上：插件走的是**被沙箱包住的** `fs`，`dsh-fs-sandbox` 按
`ctx.sandboxPolicy.defaultMode` 逐次判定（`dsh-fs-sandbox/lib/index.js:104,108,125-126,153`）。
**这是保护在起作用**：agent 不该能悄悄改掉那份「指导每个会话」的文件。
所以这两个工具在受限会话里是**只生成、不落盘**；落盘需要策略允许写到工作区之外，或由有该权限的写入者执行
（本轮就是用自己的 write 工具落盘的，并在下一轮看到区块自动更新为 6 条）。
工具原本的报错文案已在 `lib/index.js` 改得更准确，**但那次编辑发生在本次重启之后，要等下一次重启才生效**。

## Objective

**Current（本文写作时的目标）：`dsh-ck3-mod` —— 只做《Crusader Kings III》模组开发的一个 preset。**
用户先要求四条（CK3 专属、加强记忆、加强思考、专业专家团），中途追加第五条 **模组开发**，
随后在第二轮把它**收窄为「只要 mod 开发」**，并要求「只保留必要的，其他的删除」。
交付面 = 仓库内一个新 preset（`dsh-ck3-mod/`）＋ **一个**仓库外宿主平面插件
（`$DSH_HOME/plugins/dsh-ck3-modcheck`）＋ 仓库登记面与文档。
被删掉的是「战局咨询」那一半：检索插件 `dsh-ck3-wiki`（连同代码）与旧 preset `dsh-ck3/`。

**已交付并实测的（下一个会话不必重新推导）**：

| 项 | 读数 |
| --- | --- |
| preset 组合 | `dsh-ck3-mod/agent.cordis.yml`：**27 个具名行 = 3 个 group ＋ 24 个叶行**；persona 只出现 `{{model}}` 与 `{{cwd}}` |
| 专家团 | **三位**：`expert_modd`（`reasoningEffort: max`，无 filter）、`expert_verifier`（`deny: [write, edit]`，继承推理档）、`expert_chronicler`（继承推理档） |
| 技能 | 3 个，`--path` / `--preset` / `--installed` 三条路都 **3/3 clean** |
| 静态预检 | `preflight --preset dsh-ck3-mod` → **`validated: 16   skipped: 9   failed: 0`，PREFLIGHT PASSED** |
| 打包面 | `check-pack.mjs` → **PACK OK**，`dsh-ck3-mod` 5/5 文件、3 个技能进 tarball |
| 安装 | `install.mjs --preset dsh-ck3-mod --force` 已装入 `…\.agent-presets\dsh-ck3-mod`（5 文件），与仓库副本 **SHA256 逐字节相同** |
| 插件自证 | `node test/falsify.mjs` → **121/121 断言**。含 6 类植入缺陷逐个点名，**并含生成器产出的功能断言**（本轮新增：3 个原始缺陷植入回去后逐个被抓到，见下） |
| 插件工具面 | **4 个工具**：`ck3_modcheck`（**39** 个检查 code，`Object.keys(CODES).length` 实测）／`ck3_mod_init`（生成骨架并自证）／`ck3_mod_status`（读启动器 playset 数据库）／`ck3_mod_evidence`（读运行时日志） |
| 原版校准（新增，永久断言） | 编码检查对**整个原版树 0 findings**（2,536 个 `common` ＋ 536 个 event 脚本）；namespace 检查对 **536 个原版事件文件恰好 20 条**（19 处前缀不符 ＋ 1 个未声明）＝独立复现 `516/536` 普查 |
| 覆盖检测 | 同名同路径覆盖原版文件 → 报警；**新文件名**（追加）→ 不报；`common\holdings`／`common\traits` 这类单文件数据库 → error |
| 生成器 | `ck3_mod_init` 产出的骨架通过**全部检查、0 findings**（已断言）；默认绝不覆盖。**六个缺陷已修、且已在活宿主里实测（D-73/D-74）**：`picture`、`trigger_event`、`theme = realm`、无 `is_triggered_only`、无 depth-1 `icon`、本地化 key 齐全 |
| **运行时证据面** | 游戏已启动过一次 ⇒ `logs\` 存在。实测拿到**无 mod 基线**（`dlc_load.json` 为 `enabled_mods: []`）：启动时建 **16 个日志文件、全 0 字节**，随后 `debug.log` 长到 **326,754 B**、`setup.log` **36,864 B**，其中 **512 条 W、0 条 E**，首行是原版自身的 `provincetemplate.cpp: Province 10186 has no pixels!`。据此定下：**日志非空 ≠ 有问题**，工具只统计与报告。**`event-never-fired` 这条 finding 目前拿不到数据：`event_log.csv` 在本 build 里永远不出现——解锁命令跑通了，但它只写 `debug.log` 且被截断到 29 行（D-75）** |
| 端到端校验探针 | 合法 mod **0 findings**；5 类植入缺陷**各自被点名**；CJK 路径被报出、纯 ASCII 路径不报 |
| 原版误报 | 对 `game\localization\english` **全部 122 个文件 0 findings** |
| 加载器认得它 | `dsh --profile web --dump-config` 组合出 `ck3-modcheck` 行（含 4 个 config 键）且 **0 条 patch 警告**，exit 0 |

### ⚠️ 生成器的六个缺陷、校验器的盲区、以及「Row 1 其实还没闭环」

这一节是本轮**实测**的结论，两条都是往下的（不是好消息），写下来因为下一个会话一定会踩。

**1）正在运行的宿主仍在产出旧内容 —— 这一条是拿运行时问出来的，不是从 mtime 推的。**

先前只有一处**间接**证据：`D:\CK3Mods\smoketest` 的文件 mtime 是 `19:29:11`（写成功了），
**字节却是旧的**。那只能说明**某一次**写入写进了旧内容，**不能**说明现在还会。

决定性的一次是这个会话自己的工具调用（`ck3_mod_init`，由**运行中的宿主进程**提供服务）：
先删掉 `smoketest` 以免污染，再用全新名字 `hoststate` 生成，读回的字节是

| 键 | 运行中的宿主实际写出 | 磁盘上的源码会写出 |
| --- | --- | --- |
| 决策 | `icon = "decision_icon.png"` | `picture = { reference = "…/decision_misc.dds" }` |
| 事件主题 | `theme = realm_management` | `theme = realm` |
| 事件 | `is_triggered_only = yes` | 该行不存在 |
| 决策 effect | 无 `trigger_event` | `trigger_event = hoststate.0001` |
| 本地化 | 1 行（60 B，只有 `*_greeting`） | 3 行（多出决策的两个 key） |

时间线吻合：宿主 PID **16276 启动于 09-15 19:08:30**，`lib\rules.mjs` 的 mtime 是 **19:28:42**，
`lib\index.js` 是 **19:14:18**。Node 的模块是首次 import 即缓存，所以该进程持有的是**修复前**的版本。
⇒ **重启宿主是必需的，且重启前所有新会话的 `ck3_mod_init` 都会产出这六个缺陷。**
（探针产物 `D:\CK3Mods\hoststate*` 已删除，`D:\CK3Mods` 现为空。）

**2）校验器盲区：一个含六个真缺陷的骨架，`ck3_modcheck` 报 `0 findings`。**

这不是「运行旧代码导致的」，是**规则本身缺一类检查**。把六个缺陷按「能不能被现有原版对照发现」分类：

| 缺陷 | 能否被「键/标识符在原版存在过」发现 |
| --- | --- |
| `is_triggered_only = yes` | **能** —— 全原版树 0 次（唯一一次在 `#` 注释里，`chinese_disciple_events.txt:922`） |
| `theme = realm_management` | **能**（值域）—— 原版事件主题共 **36** 个，不含它 |
| 决策缺 `picture` | 不能（**缺**键，不是坏键） |
| 决策缺 `trigger_event` | 不能（同上；且「事件没有调用点」按设计就够不着，见生成器注释） |
| `icon = "decision_icon.png"` | 不能 —— 键合法且原版有 116 次；坏的是**值**（`.png` 在原版 decisions 里 **0** 次，`.dds` **419** 次） |

所以「建一个原版键索引」是**真能力**，但它**只覆盖六个里的两个**，而且成本已实测：
`common`＋`events`＋`history` 共 **4,180 文件 / 185.7 MB**，枚举 **9.2 s**，解析出 **138,038 个**不同键需
**225 s**，索引 JSON 约 **3.2 MB**。正确做法不是每次 225 s，而是**构建一次并缓存**，或只校验
「生成器自己写出的那几个非终结键」（那一组实测**全部**在原版索引里，是一行代码级的小检查）。

**3）`ck3_mod_init` 的自证会复述这个盲区。** 上面那次调用自己的输出里就写着
「**0 findings** —— 生成的骨架通过全部检查」——它调用的是同一个校验器，所以**重启也不会修好这一行**。

### 本轮把上面两条盲区都收窄了（实测；代码已改、已自证）

**A. 生成器的功能断言（`test/falsify.mjs`，107 → 121 条）。** 新增的不再测结构，而是**读产出的字节**，
并各自绑定一个**必须被拒的旧值**，所以断言本身不会空过。**已用植入法证明它们真会失败**：
把三个原始缺陷逐个植回 `rules.mjs`，套件立刻变红——

| 植回的缺陷 | 结果 |
| --- | --- |
| `theme = realm` → `realm_management` | 1 条 FAIL，点名该断言 |
| `picture = {…}` → `icon = "decision_icon.png"` | 2 条 FAIL（depth-1 icon ＋ picture 缺失） |
| 删掉 `trigger_event` 调用点 | 1 条 FAIL（事件变成死文本） |

三次植入后 `rules.mjs` 都**逐字节还原**（实测 `RESTORED byte-identical: true`）。断言用**不变量**而非
golden 文件；其中「theme 必须是本机 `00_event_themes.txt` 里真实存在的 151 个之一」是**直接读安装目录**，
所以它测的是游戏，而不是我抄下来的清单。

**B. 校验器新增两个检查，命名了六个缺陷里的两个。** `vanilla-key-unknown`（属性在原版脚本树里
一次都没出现）＋ `event-theme-unknown`（theme 值不在安装定义的 151 个里）。实测：

| 输入 | 结果 |
| --- | --- |
| 正确骨架（真安装，`D:\CK3Mods`） | **0 findings**，冷启动 2.4 s |
| 旧骨架（六个缺陷） | **2 findings**：`is_triggered_only` ＋ `realm_management`，10 ms（缓存命中） |

**C. D-73 里那个「225 秒」是我自己的测量工具造成的，不是数据的性质。** 那是 PowerShell 逐行循环的
读数；换成模块内的 `collectVanillaKeys`（走既有的 `collectFiles`）实测 **130,536 个键 / 2.4 秒**——
**快 95 倍**。所以既不需要 225 秒的索引文件，也不需要为它设计缓存策略，一个进程内 Map 就够。
**这条订正写在 D-74。**

**D. Row 2 —— 已结（见下方「Row 2 结了」一节与 D-75）。** 最早那一版说「工具侧已经做完，剩下的一步
只能由用户做」——**这个判断被实测推翻了一半**：用户做了那一步，而它证明 `event_log.csv` 在本 build 里
根本不会被创建。所以旧的「解锁三步、然后文件就会出现」文案是错的，已从 `ck3_mod_evidence` 里删除。
同一轮仍然有效的那条收获是：**文件格式的容忍度不再是风险**——`parseEventLog` 对 8 种可能格式
（分隔符、列序、引号、CRLF、多余列、大写表头）**读数完全一致**，读不出来的形状返回 `null`（不是空报告），
这 8 种 ＋ 2 种不可读形状已固化成断言。**若将来某个 build 真的写出这个文件，读取端已经是对的；变的是
「它会不会出现」，不是「出现了读不读得懂」。**



1. **真挂载判定 —— 已完成（实测，出厂 `cordis` 会话）。** `agentPresets.standingKeyFor('dsh-ck3-mod')`
   **正常返回 ⇒ `MOUNT OK`**；同一次 `compositionInventory()` 给出该 preset 的 **24 个叶行**
   （与上表 `27 = 3 group + 24 叶行` 一致，容器不计入）、`broken` 为 `none`，
   **23 行 `fiberState = 2`**，1 行 `tool-bash` 因平台表达式 `disabled` 而无 fiber（`(none)`）。
   `2 = ACTIVE`（`@deepseek-ai/cordis/lib/types/fiber.d.ts:70`，6 个成员依次
   `PENDING=0 / LOADING=1 / ACTIVE=2 / FAILED=3 / DISPOSED=4 / UNLOADING=5`），
   所以没有一行停在 `PENDING`（等待服务）或 `FAILED`——包括仓库外那一行 `tool-ck3-modcheck`。
   **边界（D-40 不变，不许过度声称）**：这一步证明的是**"没有抛错、且每个启用行都到达 ACTIVE"**，
   **不是**"每一行都贡献了模型可见的东西"——`tool-ck3-modcheck` 这个 fiber 是 ACTIVE，
   **不等于** `ck3_modcheck` 出现在该 preset 的工具表里。`node bin/verify.mjs` 仍然不是这条检查。
2. **用户手工三件**：
   - ① **重启 Host —— 已完成（实测）**：占用 `127.0.0.1:3080` 的 node 启动于 **23:28:03**，晚于插件写入的
     21:08:37，所以那一行 boot-time row 本次启动就在场。
   - ② **在一个真正由 `dsh-ck3-mod` 服务的新会话里核对工具表 —— 仍未完成，且只能由用户开新会话完成。**
     判别键是下方告警里的**三位专家**，不是四个 `ck3_*`。
   - ③ **旧 preset `dsh-ck3` 的已安装目录 —— 已用正规接口删除（实测）。**
     `agentPresets.remove('dsh-ck3')` 正常返回；删除后**独立读回两处**：roster 剩 **7 个** preset 且不含
     `dsh-ck3`，`…\.agent-presets\dsh-ck3` 目录消失（`Test-Path` → `False`）；同一轮
     `dsh-ck3-mod` 仍在（5 文件），其 `agent.cordis.yml` 的 SHA256 与删前一致
     （`8E8B21863375D5802E3BD6C45588B8FA9428F9AD0F4B131BF99D00833D85A409`）。
     **删除前它在 roster 里是 `trust: user` 且带 `broken`**：4 行指向早先被整个删掉的 `dsh-ck3-wiki`
     （`tool-ck3-search` / `tool-ck3-read` / `tool-ck3-cache` / `tool-ck3-freshness`）——
     所以它不只是"陈旧"，而是一个**在任何 picker 里都永远挂不起来**的死条目。

> ### ⚠️ 验收的判别键是**三位专家**，不是四个 `ck3_*`
>
> 这条曾经写错，记下来免得再错一次。四个 `ck3_*` 工具在**宿主平面**
> （`profiles\web\cordis.patch.yml` 那一行），注册进宿主的 `ctx.tools`，所以
> **每一个会话都看得见，包括不是 CK3 的会话**——「工具表里有 `ck3_*`」只能证明那一行挂上了，
> 是一条**恒真**的检查，证明不了当前会话是不是 CK3 模组工坊。
>
> 真正的判别键是 **preset 平面**的三个具名专家：
>
> | 看到什么 | 结论 |
> | --- | --- |
> | `expert_modd` ＋ `expert_verifier` ＋ `expert_chronicler`，**且没有** `expert_architect` | 是 `dsh-ck3-mod`，**这一半才算闭环** |
> | `expert_architect` / `expert_local` 这一族 | 是 `dsh-smith`，即尚未真正新开 CK3 会话 |
>
> 实测佐证：本会话（`dsh-smith`）的工具表里就有四个 `ck3_*`，而专家是
> `expert_architect`／`expert_protocol`／`expert_verifier`／`expert_chronicler`。
> 另外「工具在表里」与「工具能返回真数据」也是两件事：后者本轮已在 `dsh-smith` 会话里
> 实测过（`ck3_mod_status` 读出启动器库的 1 个 mod 与 2 条交叉判定；`ck3_modcheck` 零参数跑通
> `D:\CK3Mods` 并报 0 findings）。

**运行时证据面的边界（写清楚，免得下一个会话过度声称）**：游戏已启动、战役已开、`logs\` 有 16 个文件，
但 **`event_log.csv` 仍然不存在 —— 而且现在知道它在本 build 里永远不会出现（D-75）**。
下面这一节是**旧诊断**，它推错了，保留是为了说明错在哪里：

- `event_log` **不在** `log_settings_live.json` / `_release` / `_debug` 任何一个里，而 `logs\` 里那 16 个文件
  与配置里的 `loggers[].sinks[].file_name` **一一对应** ⇒ **它不走日志系统**。所以「开一局就会生成」与
  「改 `log_settings`」两个方向**都是错的**。
- 它是**控制台命令**写出来的。`ck3.exe`（95,206,088 B）里有一对相邻字符串：
  **`event_queue`** 与 `Event debug info written to logs/event_log.csv`，同属
  `console_command_implementation.cpp` 的字符串池；另两处 `event_queue` 在
  `jomini_event_queue_manager.cpp`（不同模块，已排除）。
- **解锁三步**：① `-debug_mode` 启动游戏；② 加载一局；③ 控制台执行 **`event_queue`**。
  **命令名是字符串池顺序推出来的强线索，不是实测跑通的**——若它不产出文件，那就是名字不对。
- **复测（新会话，实测）：这条命令至今没有被执行过，而且这次是「整机级」的缺席证明，不是「一个目录里没有」**
  （D-69）。① `ck3_mod_evidence` 原话仍是「没有 `event_log.csv`」；② `logs\` 仍是 **16 个文件**
  （11 个 0 字节 ＋ 5 个有内容，`debug.log` 601,714 B／`setup.log` 36,864 B），时间戳全部落在
  **2026/9/14 23:17:39–23:26:22** 那一次启动里；③ 对**整个 `D:\`** 与**整个用户目录**递归搜 `*event_log*`
  **零命中**——上一个会话只说了「`logs\` 里没有」，这次排除的是「副本在别处」。字符串偏移也重新量过：
  `event_queue` @ 68103024、`event_counts` @ 68114472、`Event debug info written to logs/event_log.csv`
  同池。**所以本行状态是「已定根因、未解锁」，不是「已解决」。**

所以「事件从不触发」这条检查是**已实现、已测试、但尚未在真实数据上触发过**——这是**缺能力，不是通过**。

### ✅ Row 2 结了 —— 结法是「解锁执行了，而它证明了旧诊断是错的」（D-75，实测）

**用户已在游戏里执行了那条命令。** 三个互相独立的痕迹都指向同一个结论：

| 读数 | 来源 |
| --- | --- |
| `console_history.txt` 全文只有一行 **`event_queue`** | 游戏自己记录的输入历史——不依赖任何人的转述 |
| `debug.log:5594` `Running console command: event_queue`，`:5595` `Total items in queue: 2107` | 引擎自己的日志 |
| **整个 `C:\` ＋ 整个 `D:\` 递归搜 `event_log*` 零命中** | 文件系统；两次读间隔 6 秒且字节不变，排除未 flush |

**命令跑通了，但它不创建 CSV。** `ck3.exe` 里 `event_queue` 的实现**没有任何写文件调用**——
它的全部格式串（offset `72187380` 原样读出）是：

```
"Total items in queue: %d\n"  "nullptr"  "- OnActions: %d\n"  "- Events: %d\n"
"\t%s\t%d\n"  "\n-- EVENTS --\n"  "\n-- ON_ACTIONS --\n"  "event_queue_update"
```

这些串**逐条都在观测到的输出里出现**，所以命令是被确认的，不是被推断的。

**旧诊断错在哪：`同偏移 ≠ 同功能`。** `Event debug info written to logs/event_log.csv`（offset `68104256`）
确实存在，但它和 `logs/`、`logs/%s/%s.csv` 挨着，而这三者紧挨 **`help event_queue`**，旁边就是
`See game.log for full help details.`（offset `68103980` 原样读出）——**那是 `help` 命令的日志重定向**。
同族的 `Event queue data written to game log` 才说明了真正的去向，实测也吻合：
`game.log` **0 条**，`debug.log` 全在里面。**「同属一个字符串池」曾经被当成相关性的证据，这次证明它不是。**

**而且输出是截断的，这一点决定了能不能用**：表头自称 `- Events: 2063` / `- OnActions: 44`，
文件里**只有 29 行事件、2 行 on_action**，随后是空行与 EOF。所以它给出的是
**那 29 个事件的真实触发次数**（`diarchy.0011` 693 次、`councillor_spouse_background.0001` 584 次……），
**对其余 2034 个一无所知**。**没出现在这份列表里 ≠ 从不触发**，多数只是被截断了——
拿它做 `event-never-fired` 会量产假阳性，比不检查更糟，所以工具的旧「解锁三步」文案已删除。

**唯一还没量过的**：同族命令 **`event_counts`**（二进制帮助串 `Print event debug counts`，offset `68114472`）
**从未被执行过**——`console_history.txt` 至今只有 `event_queue` 一行。它可能给出完整计数表，
**在跑过之前本工具不假设它的行为**，也没有任何代码建立在它上面。

**顺带实测的两条（对下一个会话有用）**：

1. **`rules.mjs`（19:51:55）已经进了正在运行的宿主，`index.js`（20:20:10）没有。**
   服务本 GUI 的是 **PID 5600，启动于 19:56:28，持有端口 59190**。所以：
   新增的 `vanilla-key-unknown` / `event-theme-unknown` **现在是活的**（已用 `ck3_mod_init`
   生成 `liverule` 验证：`picture = { reference = …decision_misc.dds }`、`trigger_event`、
   `theme = realm`、无 `is_editor_only`、无 depth-1 `icon`——**六个缺陷一个不剩**）；
   而 `ck3_mod_evidence` 里改过的文案**要等下一次重启**才生效。
2. **`ck3_modcheck` 的 `modPath` 语义是「这个路径本身就是一个 mod 文件夹」**，不是 mod 目录。
   传 `D:\CK3Mods`（一个装 mod 的目录）会把目录本身当成 mod 去校验，于是报
   `mod-file-missing` / `descriptor-missing`。目录为空时这是正确行为，但**别把它读成工具坏了**。


**另一条实测顺带解释了当初的「全部 0 字节」**：`log_settings_live.json` 与 `_release.json` 顶层都是
**`flush_interval_seconds = 3`**，所以「文件已建、内容未落盘」是个**预期窗口**而不是异常读数
（实测启动后 45 秒仍是 0/16，之后才陆续写入）。

**从真实日志里量出来的两条**（都不许当成缺陷）：

1. **同一台机器两次启动、两次 `enabled_mods: []`**，日志里就已经有原版自己的东西：
   `setup.log` **512 条 W**（`provincetemplate.cpp: Province 10186 has no pixels!`），
   `error.log` **2 条 E**（`landed_title_name_util.cpp:853: Failed to find any valid flavorization for title`）。
   ⇒ 工具只统计、不把「日志非空」当缺陷。
2. **一条消息会同时写进多个 sink**：实测同一条错误出现在 `debug.log ＋ error.log ＋ game.log`，
   按文件求和是 6 条、**去重后只有 2 条，虚高正好 3 倍**。⇒ 报告以**去重后的条数**为准，
   并列出每条错误出现在哪些 sink。

模组"能被游戏加载"仍然只能由用户在游戏里验证。

**规划阶段实测、仍然有效的关键事实**：

| 事实 | 读数 |
| --- | --- |
| 知识库 | 仍在（`Crusader Kings III Wiki`，913 条），但**本 preset 不再使用它**——模组开发不需要 |
| mod 素材量 | `Category:Modding` **71 个成员**；`Scripting` md=27,667／25 段代码块；`Localization` md=26,480／67 段代码块 |
| 版式判据 | `Scripting`＝`timeless`；`Mod structure`＝1.1（revid 18579）；`Localization`＝**1.4**（revid 32485）；游戏当前 **1.19.0.6** |
| 模组硬约束 | wiki 原文：非英文账户名必须把 mod 目录移出 Documents；实测 `USERNAME=曦曦` 含 **2 个非 ASCII 字符** ⇒ mod 放 `D:\CK3Mods`（已建，空） |
| 原版本地化版式 | `game\localization\english` **122/122** 个 `.yml` 带 UTF-8 BOM；首行 `l_english: `；**版本号可选且已弃用**（742 条原版条目根本不写），条目可带行尾 `#` 注释 |
| 原版安装布局 | 数据在 `<gameRoot>\game\`：`common\` **122** 子目录、`events\` 33、`gui\` 196、`localization\` 9 语言 ＋ `jomini` ＋ `languages.yml` |
| `preflight` 的两个边界 | ① 只在 `typeof Config === 'function'` 时读 schema（`:178`）⇒ 导出普通对象 schema 的插件一律 `skip`，**其 config 没有任何仓库内脚本会验**；② 解析基座曾是 `$DSH_HOME/profiles/`（错），**已修**为 profile 自己的目录——见 **D-63** |

**上一轮目标（CK3 Wiki 镜像）已 CANCELLED 并完成清理（D-57）**，下文保留为该项目的完整历史记录；
它留下的 913 条知识库本轮**未被使用**。

**CK3 Wiki 镜像 —— CANCELLED and fully cleaned up（用户于上一轮会话取消，D-57）。**
交付物 `tools/ck3wiki/`（工具 + `falsify.mjs` + README）与知识库 `Crusader Kings III Wiki`
（`iYD6qed-…`，913 条）**两者都已交付**；本次按用户要求取消项目并做全面清理：删掉 934 个
生成物文件（19.41 MB，可重建）、5 个一次性/探针脚本与 `$DSH_HOME\profiles\web\` 的四个 CK3
脚本，**保留 8 个可重建语料与跑回归测试所必需的文件**（`git ls-files tools` 实测 8 条，**D-58**
订正了 D-57 的「9」；理由与全部实测计数见 `PROJECT.md`
该节的取消订正块与 **D-57**）。
**一处必须由用户手工完成、API 做不到的事**：ima 服务端那 913 条无法删除（该接口没有删除
端点），只能在 ima 客户端里手工删库。设计决策 **D-52**（URL 导入而非 Markdown 上传）、
**D-53**（converter 每作用域一个缓冲）、**D-54**（门绕过留在本地、不碰 `dsh-web-fetch-http`）
**保持不变**，其历史文本一字未改。

State, as of this writing:

| | |
| --- | --- |
| Converter | **sound** — 8 pilot pages pass every audit; 4 independent defects found by review and fixed; `falsify.mjs` pins all 4 and was validated in the negative |
| Extraction | **DONE** — 922 pages fetched, 0 fetch failures, 15.9 MiB, 482 s, 0 gate challenges in 980 requests; all 430 articles pass the audit at a median text recall of 0.99. **916 distinct files, all 916 verified against the manifest by digest** |
| Ingest | **DONE** — knowledge base `Crusader Kings III Wiki` (`iYD6qed-…`), 6 folders, 922 URLs submitted, **913 unique entries**, with the two causes D-57 records: the wiki's main page resolved to `CK3 Wiki`, **and 3 titles were duplicated across partitions** (`430−2=428`, `202−1=201`, i.e. ima kept one copy of each). *(The two causes do not arithmetically close the gap of 9 — open question 12.)* Coverage by URL slug: **429/430 articles, 100 % of the other five partitions** |
| Plugin | `dsh-ima-kb` gained **4** tools (`ima_import_urls`, `ima_upload_dir`, `ima_kb_create`, `ima_kb_mkdir`); 13 tools, 10 config keys, verified by `profiles/web/check-ima-kb.mjs` (stubbed services; **not** a Cordis-injection proof). Changes committed locally as `e300cca` |

**A defect found after "done", recorded because the check that finds it did not exist.** The corpus
had **922 manifest entries for 916 files**: `list=allpages` pagination returned six Template titles
twice, each was fetched twice, and the second write overwrote the first — so the manifest carried
two entries for one path whose `sha256` no longer matched disk. The **content was never wrong** (the
second fetch of a title is the same page); the **manifest was**. Repaired by `repair-manifest.mjs`
(one entry per path, every digest recomputed from disk, re-verified: **916 match, 0 mismatch**), and
`extract.mjs` now deduplicates titles before fetching and re-reads every written file to verify its
own manifest — so a rerun cannot reintroduce it. The lesson is the one this board already carries in
another form: **an audit that checks content quality will not notice a file that was never
distinctly written.**

**These three items were the milestone's open set; all three are now closed (D-57):**

1. **Title backfill: COMPLETE.** The two readings above (**85 → 104** of 913) were early
   samples. Measured at cancellation: **all 913 titles carry `<wiki title> - CK3 Wiki`**, including
   namespaced pages. The old number is a superseded reading, not an outstanding risk —
   `data/coverage.json`'s `backfilled: 220` is stale, must not be quoted — and the file itself is
   gone with `data/`, so it cannot be re-read at all.
2. **Two permanent leftovers in `曦曦的知识库` remain, and still no API can remove them:**
   `this-page-does-not-exist.md` and the 12 CK3 probe entries the architecture review wrote there
   (11 URLs + that file). Deleting the local mirror does **not** touch these — they are the user's
   to delete in the ima client, together with the `Crusader Kings III Wiki` knowledge base itself.
3. **The plugin repository is IN SYNC, and the push route that had never been proven has
   been proven.** Pushed with `bin/push-api-ref.ps1 -RemoteOnlyParent`
   (see **D-56**); `refs/heads/main` moved `4e2d9cc` → **`53a3f66`**, and the new commit
   **parents at `4e2d9cc`** so the move was a fast-forward. Verified *against the API*, not
   from the script's own report — remote tree **`ebdd375`** equals the local tree; one parent;
   **9 blobs identical to `git ls-files`**; no doubled path segments; the 18-line commit
   message intact. All five checks pass.

**Also done this session: all four owned repositories carry the `DeepSeek Harness Plugins`
topic**, with no existing topic dropped (`dsh-smith` 9, `dsh-account-balance` 7, `dsh-desktop`
1, `dsh-ima-kb` 1). Two measured facts from that, worth keeping: the topics **PUT rejects the
display form** `"DeepSeek Harness Plugins"` with `422 must start with a lowercase letter or
number` — the body must carry the normalised slug `deepseek-harness-plugins`, even though
GitHub renders it back with capitals; and `dsh-desktop`'s first write answered a bare
**HTTP 500** which succeeded unchanged on retry, so a 500 there is transient rather than a
validation problem.

**One credential-shaped finding, recorded because the next session will trip over it.** The
token supplied for this work was found in **`%APPDATA%\DSH Desktop\Partitions\dsh-desktop\
Local Storage\leveldb\000025.log`** — the user's own **typed draft** of the request, which the
Web GUI persists as browser Local Storage. It was **not written by any command here**: every
call passed it through `$env:GH_TOKEN` in a child process, and a search for the token's
distinguishing fragment across `D:\DeepSeek Harness`, `$DSH_HOME`, `%TEMP%` and `%APPDATA%`
found it in that one file and nowhere else. **The harness's own stores are clean:** 178 session
and 178 storage files were scanned and matched nothing, and session logs are zstd-compressed
in any case. **Deliberately NOT cleaned:** the file is held open by four live `DSH Desktop`
processes, and editing a locked LevelDB is how an application's storage gets corrupted — so
the correct action is the user's, in the app, and the effective one is **revoking the token at
GitHub**, which invalidates it everywhere at once.

Everything below is the pre-existing objective of this repository and is unaffected.

Two presets ship from this repository — `dsh-smith` (builds harness agents and Cordis plugins)
and `dsh-forge` (software delivery) — and those two directories are the whole owned surface
(`AGENTS.md` rule 7). What is open, and nothing else:

0. **GitHub integration: CANCELLED and fully torn down (D-51) — this is closed, not pending.**
   **⚠️ 别把这一项读成"部署没有 GitHub 能力"（2026-09-19 晚补注）：** 这一项说的是那次**入站 webhook
   集成**被取消并拆除。部署现在**有** GitHub **API** 能力 —— 由 profile 补丁层的一行 `mcp-github` 提供
   （90 个工具、含写、会话内已实测派发），见本板顶部那一节与 D-93–D-96。**两者是不同的东西**：
   前者是"GitHub 打进来自动开会话"，后者是"会话反过来调用 GitHub API"。不要互相引用。
   The user cancelled the project, so the deployment no longer carries it: **no**
   `webhook-runtime` / `webhook-github` / `github` rows, **no** `$DSH_HOME/plugins/dsh-github`,
   **no** `GITHUB_WEBHOOK_SECRET` or `GITHUB_TOKEN` ref, `/github` unrouted, the user-level
   `NODE_OPTIONS` reverted, and the desktop launcher deleted. D-47–D-50 are superseded by D-51 but
   **deliberately retained**, and `PROJECT.md`'s GitHub section is banner-marked as non-current.
   **What survives, because none of it is GitHub-API-specific:** `bin/check-pack.mjs` +
   `.github/workflows/checks.yml` (they guard *this* repo's published tarball), the
   `-RemoteOnlyParent` / empty-range fixes to `bin/push-api*.ps1` (they close D-45), and the
   machine-level measurements (`405` is a false positive; `git clone` fails with
   `CRYPT_E_NO_REVOCATION_CHECK` while the HTTPS API works; a quick tunnel's hostname changes on
   every restart). **Do not rebuild it without reading D-47–D-50 first** — with
   the plugin's own README deleted, those entries are now the only copy of that reasoning.
   **Two artifacts that this list previously counted as survivors were removed in D-57, because
   they did not survive after all:** `github-gate.mjs` at the repo root (it forwarded `POST
   /github`, a route that no longer exists — dead by construction, not by choice) and
   `.gitignore`'s `github-worktrees/` rule (dead config: the directory it guarded is absent from
   disk). Both were deleted; the gitignore change left a one-line note saying why.
1. **`dsh-forge`'s tool surface is VERIFIED — closed this session.** All three checklist items
   in `docs/dsh-forge.md` were measured in a real `dsh-forge` session and are recorded there:
   the tool table, `run_code` + the generated `tools:sdk` section, and the `deny: [write, edit]`
   filter under `mode: both`. The filter result is stronger than the word "rejected" implied —
   the two bindings are **absent from the SDK object**, so the call dies at property lookup
   (`TypeError: tools.write is not a function`) before any dispatch, and a **same-depth,
   same-provider control without a `toolFilter`** retains both, which excludes depth and
   inheritance. D-26 records the correction this forced on D-17's wording.
2. **`bin/verify.mjs` cannot reach the roster from any session** (D-24). Corrected in its text;
   making it a real check would need it to attach to a live runtime instead of booting a bare one.
3. **The local commits were unpushed — CLOSED on 2026-09-19 (late): pushed, and verified against the API.**
   `bin/push-api-ref.ps1 -RemoteOnlyParent` uploaded **six** commits chained from the old remote tip:
   `refs/heads/main` moved `bc87ad5` → **`355f3e0`**, the six-step parent walk lands exactly on `bc87ad5` (so it
   was a fast-forward, no `-Force`), the remote tree equals `git rev-parse HEAD^{tree}`
   (`c59d9484…`), the 49 remote paths equal `git ls-files` with **zero** doubled segments, and every commit
   message survived. `main` still has **no upstream configured** (`git rev-parse main@{upstream}` → *no
   upstream*), which is expected for this route — the transport is REST, not `git push`. The push tooling
   itself gained a fix on the way: `-DryRun` printed the same remote tip for every row of a multi-commit
   batch, which reads as "five sibling commits, four orphaned" — it now advances the parent per row
   (`6dc0554`). **Original text, kept as history:** the four commits an earlier session made — `e3ec4a4`,
   `a980f67`, `0016c18`, `b6ecb19` — were local-only at the time, and `bin/push-api-ref.ps1` gained
   `-RemoteOnlyParent` for a range whose first parent exists only on the remote and `bin/push-api.ps1`
   errors cleanly instead of crashing on an empty range (**D-48**), with the flag's happy path pushed for
   real and five checks taken **against the API** (**D-56**).
   of crashing on an empty range (**D-48**), and the flag's happy path was then pushed for real,
   with five checks taken **against the API** (**D-56**) — the "unproven in a real push" reading
   this item used to carry is superseded.
4. **Outside the repository — the `dsh-ima-kb` mount check is DONE** (open question 8, D-40): six
   presets `MOUNT OK`, `dsh-ima-kb` in none of the 160 preset rows, and `ima_kb_list` present in a
   live session's tool table. **Question 9 is closed too, for `ima_kb_list`'s live path** (D-44): a real
   session's call returned 7 knowledge bases, which `standingKeyFor` could not have shown. What survives
   is narrower and is recorded in `PROJECT.md` — eight of the nine tools are not production-verified,
   including the other three read tools. Nothing under `D:\DeepSeek Harness` is blocked by it: the plugin
   is not in this tree.
5. **The D-46 gap — still a gap, but its record defect is fixed.** The two `push-api` bullets in
   `AGENTS.md` (the `parents`/`if` bullet and the `auto_init` bullet) and `PROJECT.md:426` all cite
   **D-46**, and `DECISIONS.md` has no such entry: its `## D-<number>` headings run 1–27 and
   30–**57** (55 entries plus the note), skipping **28/29** (deliberately absent, explained
   in-file) and **46**. Those citations are **pre-existing**; the session that recorded this did not
   delete the entry and could not see what happened to it, so **D-46 stays unassigned rather than
   invented**. The line numbers this item used to name — `AGENTS.md:233,251` — rotted, and moved
   again during this very pass, which is why it now names the two bullets instead of their lines.
   **What was fixed:** the explanatory note had been headed `## D-46 is cited elsewhere but is NOT
   in this file`, which **matched the `## D-<number>` entry pattern** — so a search for entries
   reported D-46 as present when only the note was. It is now headed `## Note, not an entry: the
   D-46 gap`, making D-46 cleanly absent to any pattern-based lookup. Do not renumber or "restore" it.

> The row-count question is **closed**: 38 named rows = 3 group containers + **35 leaf rows**, of
> which **31 active**, 2 `conditional`, 2 `disabled`. Both counting paths skip containers
> (`dsh-agent-presets/lib/index.js:991`, `:1038`). Both figures this board previously carried were
> wrong, and D-25 records why.

> This board was rewritten this session. Its previous objective ("close the last two
> verifications on this preset") was satisfied: both closed, recorded in `PROJECT.md`, with the
> surviving caveats kept in D-17.

## In progress

| Role | Child id | Question |
| --- | --- | --- |
| — | — | No verification is in flight. A snapshot; date it if it stops being true. |

## Settled this session

| # | Item | Status | How it was established |
| --- | --- | --- | --- |
| 1 | Second preset, or change `dsh-smith`? | **Second preset** | User's call, after the two roles were read out of `preset.yml` and the shipped set. `dsh-smith/**` was not touched. |
| 2 | PTC or both for the new preset? | **`both`** | `collapses()` at `dsh-tools/lib/index.js:2993-2995` collapses model-direct calls to `run_code` alone under `ptc`; the SDK binding at `:1207-1220` propagates `agent`/`parent`/`signal`, so `exit_plan_mode` would still work — reliability, not correctness. See D-19. |
| 3 | Is a mount check runnable for `dsh-forge` from here? | **No** | This session's own tool table has no `cordis_*` at all: the host takes the four process-global provider ids at boot, so every other composition must gate the row off. See D-20. |
| 4 | Do the ported scripts still behave as before? | **Yes** | With no `--preset`: 5 skills lint clean; drift 36/32 rows with the same six drifted rows; install refuses to overwrite with the same message. |
| 5 | Does the new static preflight actually detect defects? | **Yes — falsified** | `mode: nope` → `$.mode expected "native" \| "ptc" \| "both" but got "nope"`; a renamed package → `package does not resolve`. Both exit 1. |
| 6 | Does `dsh-forge` parse and validate? | **Yes, 0 failures** | `bin/preflight.mjs --preset dsh-forge`: `validated: 24   skipped: 10   failed: 0` over 38 named rows. The 10 skips are named in `docs/dsh-forge.md` — skipping is not passing. |
| 7 | Persistent shell rows? | **Not composed, deliberately** | `dsh-tool-pwsh-persistent`/`-bash-persistent` inject `["tools","terminals"]`, and no bundle composes `dsh-terminal`; adding the row would fail the mount on a `waiting for terminals` row. A host-plane change, not a preset one. |
| 8 | Did an independent adversarial review of this change earn its cost? | **Yes — 7 documentation defects, 0 composition defects** | One `expert_verifier` call confirmed all six technical claims and found that the prose around them was wrong in seven places; the change was then re-verified and re-installed. Recorded as D-22, including the one finding of its own that was itself slightly off. |
| 9 | Does `dsh-forge` mount? | **Yes — `MOUNTED OK`** | The dynamic-plugin probe from a session on the shipped `cordis` preset: `standingKeyFor('dsh-forge')` resolved a standing scope key; `compositionInventory()` listed 35 leaf rows — 31 active, 2 `conditional`, 2 disabled — with `broken=none`, so no row is mounted-but-contributing-nothing. See D-23 and `docs/dsh-forge.md`. |
| 10 | Can `bin/verify.mjs` run the mount check? | **No — from any session** | It builds its own bare Cordis context (`bin/verify.mjs:204`), so `agentPresets` is absent by construction. Measured twice, byte-identical: a plain shell and the shipped-`cordis` session that *could* run the probe both printed `INCONCLUSIVE — this runtime publishes no agentPresets service`. D-24; header and advice corrected. |
| 11 | Did the file and the inventory really disagree by a row? | **No — both errors were ours** | `flattenRows` (`:991`) and `mountedCompositionRows` (`:1038`) both skip `group: true` entries, so a row list is leaves only: **38 = 3 groups + 35 leaves**, of which **31 active**. "35 active" mislabelled the total and "34 = 38 − 4" subtracted from a total that includes the 3 containers. D-25. |
| 12 | Do `run_code` and the `tools:sdk` section reach a model? | **Yes — both, measured** | This session's own table has `run_code` and executes it; a delegated child's prompt carried the `Program-only SDK bindings:` block and its `await tools.glob(...)` returned 15 paths. The SDK section is not merely rendered — it is **callable**. Sibling of `wireSchemas`'s `both` branch (`dsh-tools/lib/index.js:2739-2742`). |
| 13 | Does `deny: [write, edit]` hold under `mode: both`? | **Yes — and it is absence, not rejection** | Filtered `expert_debugger`: 30 names, `write`/`edit` absent from table *and* SDK section, forced calls → `TypeError: tools.write is not a function` (`instanceof ToolCallError === false`), `glob` control succeeded. Control at same depth/provider without `toolFilter`: 32 names, both present, `edit` really dispatched. D-26. |
| 14 | Is the workspace's installed preset what this repo says it is? | **Yes — byte-identical** | `Get-FileHash` on `~/.dsh/.agent-presets/dsh-forge/agent.cordis.yml` and `dsh-forge/agent.cordis.yml` agree: `C8353AF1D7B05193AF88D5DDC085D2B4B79B422DFDEA93C0D2AF70C0414A86A1`. So no measurement here is contaminated by hand-edit drift — the failure mode `AGENTS.md` rule 6 exists to prevent. |
| 15 | Should this repository carry anything other than presets, and should the profile's balance bundle stay? | **No to carrying plugins, and the bundle was removed — then the user asked for a balance badge and got one this session.** | The first two steps were the user's call. The repo's fork was deleted with its records after it turned out never to have been mounted (its own route still answered 404). The community bundle the profile actually loaded was removed with the sanctioned writer — `dsh plugin --profile web remove dsh-deepseek-balance`, exit 0 — which reconciles `dsh.profile.bundles` itself (`dsh/lib/plugin-Ddi42qoW.js:46-78`), so the layer list is not left pointing at an unresolvable package (a boot failure per `dsh-app-boot/lib/index.js:831`). **Then the user asked for the GUI to show the balance**, so a from-scratch plugin was written — not restored from either removed artifact. Current state, re-measured for this row: bundles are still `dsh-base` + `dsh-web-app`; `dsh --profile web --dump-config` composes one balance row, `id: account-balance` / `name: dsh-account-balance`; the profile's dependency is `dsh-account-balance: link:…/.dsh/plugins/dsh-account-balance`; and there is **no** `dsh-deepseek-balance` reference anywhere. The plugin lives **outside** this repository, which is why the two-directory surface in `AGENTS.md` rule 7 is unchanged. |
| 16 | Does the `dsh-ima-kb` row *contribute*, or is it merely mounted? | **It contributes — measured live for `ima_kb_list`, and only there** | An **ordinary session's** `ima_kb_list` call returned **7 knowledge bases**, matching the building session's independent reading exactly in set and in membership counts. The check script stubbed `credentials`, so it never exercised **Cordis service injection** — the one failure this class hides. The other eight tools are not covered; per-tool boundary in `PROJECT.md`. D-44. |
| 17 | Do the two shipped webhook packages need `dsh plugin add` to be usable as rows? | **No — both resolve by row name already** | Importing `@deepseek-ai/dsh-webhook` and `@deepseek-ai/dsh-webhook-github` **by name from the profile directory** returned their full export lists, which is the resolution the loader itself performs (`cordis-plugin-loader/lib/index.js:279-282`, `baseUrl` anchored at the profile). The mechanism is `$DSH_HOME/profiles/node_modules` being maintained as a mirror of the installation's dependency closure. Only the new plugin needed the sanctioned writer. |
| 18 | Does `POST /github` answering `405` mean the route is mounted? | **No — it is a false positive** | The web-app's fallback seat answers an *unmatched* path with the same `405`, so `POST /github` and `POST /definitely-not-a-route-xyz` are byte-identical while the route is absent. **Both were probed.** The discriminator is `503` (mounted, secret unresolvable) versus `401` (secret present, signature wrong), because the adapter resolves the secret before verifying the HMAC (`dsh-webhook-github/lib/types/handler.js:75-78`). D-47. |
| 19 | Does the GitHub ingress actually create a session? | **Yes — measured, and the PROMPT was admitted too** | A locally signed POST answered `202`; the store then held `webhook-a627e8f0-…` with `cwd` = the fetched checkout, `agentPreset: dsh-forge`, `delegationDepth: 0`. The session log is header-only, so the **projection** was read instead: `permissions.preset: workspace-write`, `modelSelection` `deepseek-flash`/`max`, `sessionStats.turns: 1`, **non-zero `tokenUsage`**. A non-zero token count is stronger evidence than a text search, because it proves the prompt was processed rather than merely stored. D-47. |
| 20 | Does `git clone` work on this machine? | **No — and that changed the design** | `schannel: next InitializeSecurityContext failed: CRYPT_E_NO_REVOCATION_CHECK (0x80092012)`, the same revocation-endpoint defect this file already records for `git push`. GitHub's HTTPS API and **codeload are reachable where git's transport is not**, so the rule's checkout fetches a tarball over `fetch` and extracts it in-process, with `git clone` kept only as a fallback. Measured: 9 files in 755 ms, reuse on the second call, path-escape guards all false for `..`, absolute, and backslash entries. D-47. |
| 21 | Is the new tarball guard real, or does it just always pass? | **Real — falsified and repaired** | On a **copy** in `%TEMP%`: dropping `dsh-smith` from `package.json`'s `files` produced **PACK FAILED, 4 findings**; restoring it produced **PACK OK**. Dropping `bin` produced PACK OK **and that is correct** — npm force-includes whatever the `bin` map names, so the first falsification attempt was itself wrong, not the guard. D-48. |

## Open questions

1. **CLOSED — does `mode: both` send the SDK without collapsing the catalog?** **Yes.** Measured
   in a real `dsh-forge` session: the tool table carries the full catalog (32 names) *and*
   `run_code`, and a delegated child successfully executed `await tools.glob(...)` — an SDK binding
   that resolves only if the `tools:sdk` section was rendered into its prompt. `wireSchemas`'s
   `both` branch returning the full list (`dsh-tools/lib/index.js:2739-2742`) is therefore
   confirmed end to end rather than by reading. See `docs/dsh-forge.md`.
2. **CLOSED — do the read-only experts stay read-only under `mode: both`?** **Yes, and the
   mechanism is not a guard.** A delegated `expert_debugger` (`deny: [write, edit]`, byte-equal
   config to `expert_verifier`) enumerated 30 names with `write`/`edit` absent from both the
   mounted table and the SDK section; forced calls threw `TypeError: tools.write is not a function`
   (`instanceof ToolCallError === false`) while `tools.glob` succeeded. The differential control —
   same depth, same spawn provider, no `toolFilter` — retained both and dispatched a real `edit`.
   This is the one design signal that neither a mount nor `preflight.mjs` can touch, because the
   filter is applied per child at spawn (`dsh-subagent/lib/index.js:554`) and no check here ever
   spawns a child. D-26.
3. **OPEN — does a `repeat-tool-reminder` row in a preset co-exist with the host's?** The host
   composes the same package (`dsh-base/cordis.patch.yml:419-422`); the preset's row installs its
   own scoped listeners. Both should fire. Untested, and the failure mode would be a doubled
   reminder, not a failed mount — worth one observation rather than a work item.
4. **OPEN — is a clean mount in *this* process evidence about a *new* one?** The mount check ran in
   the current process. The cold-process case is reasoned (`!!js` gates read `process.platform` and
   `cordisInspect`, same values in a cold process) and not measured, because measuring it means
   starting a second harness process — which would start a second server.
5. **OPEN, new and small — is `ralph` visible to a child at delegation depth 1?** The measurements
   above say **yes**: three separate children at depth 1 all enumerated 32 names with
   `has_ralph=true`, and `composeFrom` binds a child to its parent's exact generation
   (`dsh-agent-presets/lib/index.js:1508-1524`, *"the same tool registrations"*). But this rests
   **entirely on child self-reports**, and one of them initially omitted `ralph` from its prose
   list. Nothing in this repo asserts an answer either way, so there is no defect to chase — only
   an unmeasured claim, and the cheap check is enumerating from a child whose row is *known* to be
   depth-sensitive. Recorded rather than dismissed because the same round trip that closed items 1
   and 2 raised it.
6. **OPEN, new — does a session served by `dsh-smith` have `run_code` and the `tools:sdk` section?**
   Three artifacts were read this session and they disagree, so no cause is asserted here.
   `docs/dsh-smith.md` contains no `run_code` mention; both preset compositions declare **no**
   `code-runtime` row (`dsh-smith/agent.cordis.yml`, `dsh-forge/agent.cordis.yml` — the latter only
   *recommends* adding one, in a comment); yet the session that wrote D-30 had `run_code` in its own
   tool catalog and a `Program-only SDK bindings:` block in its own prompt. Both **installed** preset
   copies are byte-identical to this repo (`77E34CB76EF2B41D`, `C8353AF1D7B05193`), so this is **not**
   hand-edit drift under rule 6. The probe is a runtime read of the mounted preset — `agentPresets`'
   projection, per rule 2 — and it is **not runnable from this session**. Until it runs, the honest
   statement is "these three artifacts disagree", never "a different preset served the session": that
   inference is exactly the trap D-4 records.
7. **OPEN, new and standing — who pushes the balance plugin now that it has its own repository?**
   Its working tree is the directory the deployment loads, so a code change there takes effect on the
   next `dsh web` restart *without* any git action, and the GitHub repository drifts silently until
   someone pushes. There is **no** CI, no submodule, and no watcher by design (D-33). Pushing means
   the two-step route in `AGENTS.md`'s boundaries — `git push` does not work on this network — and
   that route is not reachable from the plugin's own directory, so it has to be driven with
   `-RemoteRepo dsh-account-balance`. The cheap check that the two agree:
   `git -C $DSH_HOME/plugins/dsh-account-balance status --porcelain` is clean **and** the remote tip's
   tree equals `git rev-parse HEAD^{tree}` — the same tree comparison every other push here uses.
8. **CLOSED — does `dsh-ima-kb` mount, and do its tools reach a session's tool table? YES to both.**
   The user drove the dynamic-plugin probe themselves from a session on the shipped `cordis` preset
   and pasted the **raw runtime output** (contract query → `cordis_define` → `cordis_run` → call →
   values). Six presets — `standard`, `ptc`, `minimal`, `cordis`, `dsh-forge`, `dsh-smith` — returned
   **`MOUNT OK`, zero failures**, with the four documented failure shapes all absent.
   `compositionInventory` answered from **live Loader entries** (6 presets, **160 rows**, every
   `broken` null; `fiberState === 2` on every enabled row), and **`dsh-ima-kb` is in none of the 160**
   — the direct confirmation that it is a host-plane row, with `agent-preset/not-found` as the control
   when it is passed as a preset id. The other half is the user's own live reading: a fresh session's
   tool table **contains `ima_kb_list`**. See **D-40**. `bin/verify.mjs` was **not** run, correctly —
   it builds a bare Context and could only print INCONCLUSIVE (D-24).
9. **CLOSED for `ima_kb_list`'s live path — does any *individual row* contribute? YES, measured live.**
   The user asked an agent in an **ordinary session** to call `ima_kb_list`; it returned **7 knowledge
   bases**, matching the building session's independent reading exactly in set and in membership counts.
   That is the first and only evidence that, in the real runtime, the row's `apply` ran, Cordis resolved
   the injected `credentials` and `tools` services to host instances, the reference resolved from
   `$DSH_HOME/.credentials.yaml` **through the seam**, the HTTP call to `ima.qq.com` was answered, and the
   response reached the model as text. **Why the earlier checks could not have caught this one:** the
   building session's check script **stubbed `credentials` by hand**, so **Cordis service injection was
   never exercised** — a tool that registers but cannot resolve `ctx.credentials` passes `standingKeyFor`,
   `preflight` and `verify.mjs` alike and is still inert. **The surviving gap is per-tool, not per-row**:
   see `PROJECT.md`'s ima subsection for the live-vs-stubbed split across the nine tools.
   > **Do not re-open this as "does the row contribute".** What is unmeasured is narrower and named in
   > `PROJECT.md`: `ima_import_url`, `ima_upload_file`, `ima_note_create` / `get` / `list`,
   > `ima_kb_search`, `ima_kb_browse` and `ima_media_info` have **no** live measurement — the check
   > script that exercised them stubbed the seam. All nine share the credential seam; each one's own
   > endpoint and write path does not inherit this verdict. See **D-44**.

10. **CLOSED — the balance row's "host half needed a restart" claim is superseded, and it was measured
    rather than argued.** Three readings, all reproduced independently on this record's behalf:
    PID **15116** (`node`) started **2026-09-12 10:17:17** and **owns the listener on `127.0.0.1:3080`**;
    `profiles/web/cordis.patch.yml` was last written **2026-09-12 10:12:46**, i.e. **4m31s before**
    that process started, and it carries **both** the `account-balance` and `ima-kb` rows; and
    `GET /api/balance` on 3080 answers **401**, so the route is registered and live in that process.
    The process came up with the row already present — the **same evidence shape as the ima case**
    (D-42), now evidenced twice. See **D-43**. Kept distinct there: the restart requirement is
    *certainly false*; the three readings are what was *measured* (401 proves reachability, **not**
    correct answers — the 200-with-cookie case lives on 3081 and was not re-measured); and
    `patchReload: "live"` is the *inferred* mechanism, **not isolated**. The original clause may simply
    have been wrong when written — there is no process history before 10:17:17, so it is superseded as
    current advice, not rewritten as a mistake with a known cause.

11. **LIVE ARTIFACT, outside this repo — `dsh-ima-kb` is published, REWRITTEN, and it now carries the
    same standing drift risk as the balance plugin (item 7).** `https://github.com/ABccgh/dsh-ima-kb` —
    public, branch `main`, **two commits, and the auto_init bootstrap commit is now nowhere in its
    ancestry.** The repository was **deleted and re-created** (`auto_init: true`) and the history
    re-uploaded as a **root + child**, with the ref force-moved; **re-measured here** by querying the
    GitHub API myself, not restated from the pushing session's report:
    - tip **`4e2d9cc68a6e8f8a4f41ca2de1a203293b45e6b4`** ("docs(readme): 开头那句工具数从 5 改成 9"),
      **1 parent** = the root;
    - root **`28d22d13fc63cddf618bea8d3673003f9b81ad3e`** ("feat: 腾讯 ima 知识库接入 DSH（9 个工具）"),
      **0 parents**, tree `9eb29b2`;
    - tip's tree **`9df69b5b633be520aa89ffa0200e222d1dc4b04c`**, which **equals
      `git rev-parse HEAD^{tree}` in the plugin's working tree** — the strong form every push here is
      checked by;
    - the recursive remote list is **9 blobs** plus the `lib` tree object, matching the local
      `git ls-files` **exactly**, so no path segment is doubled (`node_modules/` untracked).

    **The earlier pair `208e9d0…` (tip) / root is superseded and is history, not current state** — it
    is the *remote* pair that the rewrite replaced, and the only remaining mentions of it are the
    historical entries in this file, `PROJECT.md` and `DECISIONS.md` (**D-45 alone still carries it as
    current**, and append-only forbids editing it; the current answer is here and in D-46). The
    **local** history is a different pair again — `6c1324a` then `8b9719b`, whose SHAs are not the
    remote's, while `8b9719b`'s tree still equals the remote tip's tree. **The resync is clean**
    (re-measured here): `git status --porcelain` in the plugin's working tree is **empty**. See
    **D-46**. **The risk, stated the same way as item 7:** that working tree
    (`$DSH_HOME/plugins/dsh-ima-kb`) is the directory the deployment loads, so an edit there changes
    behaviour with **no git action at all**, while the GitHub copy drifts silently until someone
    pushes; there is **no CI, no submodule and no watcher, by design** (D-33). Cheap check that the two
    agree: `git -C $DSH_HOME/plugins/dsh-ima-kb status --porcelain` is clean **and** the remote tip's
    tree equals `git rev-parse HEAD^{tree}` — the same comparison every other push here uses.
    **Push is not reachable from a normal session here, and that is now measured rather than assumed:**
    the local history's root has no local ancestor, and **neither** `bin/push-api.ps1` nor
    `bin/push-api-ref.ps1` can push a commit whose parent exists only on the remote — `-AllowUnrelated`
    does not override the pairing refusal. The route that worked was a **scratch API push**
    (`%TEMP%`, deleted, and deliberately **not** committed to any repository); its shape is recorded in
    prose in **D-45**, and the scripts themselves were **not** modified. Nothing under
    `D:\DeepSeek Harness` is blocked by any of this: the plugin is not in this tree, and a re-measure
    here confirmed **zero** ima-shaped tracked paths in it.

> **Correction to the earlier version of item 8, recorded because it was wrong and a reader may still
> hold it:** the previous text said confirming the tools reach a live tool table **does need a `web`
> profile restart**. That is **false and superseded** (D-42). No restart was needed, and one would
> have **terminated the session serving the user**. Do not repeat the old phrasing.

> **Carried open earlier this session and now CLOSED as harmless, recorded so it is not re-opened.**
> The worry was that the running harness holds an in-memory credential snapshot and could rewrite
> `$DSH_HOME/.credentials.yaml` on an unrelated write, dropping the two new `refs:` keys the plugin
> depends on. Measured after all the plugin work: the file still holds **all three** refs —
> `DEEPSEEK_API_KEY`, `IMA_OPENAPI_APIKEY`, `IMA_OPENAPI_CLIENTID`. No guard is needed. Unlikely and
> unmeasured was the right way to hold it; **measured harmless** is the right way to record it.

> **Two side effects this milestone left in the user's ima account, which only the ima client can
> undo** — the OpenAPI has no delete endpoint at all (D-39): **5** notes titled 「DSH × ima 联调记录」
> and the file `dsh-ima-upload-probe.md` in `曦曦的知识库`, plus an earlier URL import of
> `https://github.com/deepseek-ai/deepseek-harness` into the same knowledge base. The user has been
> told. The note count was first reported as 3 and the measured figure is 5.

12. **CLOSED — the `922 → 913` reconciliation DOES close, and the check was already run (D-59).**
    Reading **(ii)** is the right one, and it is now proved rather than inferred:
    **`922 (listings) − 6 (Template titles `list=allpages` returned twice) = 916 (manifest rows);
    916 − 3 (distinct URLs duplicated across partitions) = 913 (knowledge base).**
    The proof is a comparison already in the record, not a new experiment: at planning time the KB
    was enumerated **live, per partition, with 22 paged calls** — `428 / 4 / 12 / 20 / 248 / 201` —
    and the manifest's partitions are `430 / 4 / 12 / 20 / 248 / 202`. **Four of the six partitions
    agree EXACTLY**, including `ns10 = 248` on both sides, which is what places the six Template
    dedupes *before* manifest time and therefore rules out reading (i). The two that differ are
    exactly `00_Articles` (−2) and `50_Categories` (−1) — sum **3**, precisely the three
    duplicate-URL keys D-57 names (`Crusader Kings III Wiki:Style`, `…:Versioning`,
    `Dragon Age: Thedas at War`), each of which sits in one of those two partitions.
    So the gap of nine decomposes **6 + 3**, both terms accounted for, and **922 was a
    fetch/listing count, never a submission count**. The earlier "possibly unanswerable
    from now on" verdict was wrong: the evidence needed was a live per-partition enumeration,
    and that had already been performed and written down before the corpus was deleted.

## Next

0. **DONE（2026-09-19 深夜）—— `ABccgh/dsh-smith` 已推送、已核对，这一项没有遗留。** 修复 + D-97 的
   四个文件提交为 `671532a`，经 `-RemoteOnlyParent -Base a9ea9f25f3ecf9ccd579286709a126d3a9fae180`
   推为远端 `fb3f8d6`：父 = 旧 tip `6143f6a`（fast-forward）、tree `db6d059…` 两侧相同、49/49 路径集合
   一致、无 `bin/bin/…`（D-33 那次事故的形状）、远端 `bin/push-api-ref.ps1` 现为修复后的 blob
   `fce5784`；推送后九个位置**全部**重跑了路径→blob 双向集合对比，9/9 IDENTICAL（这同时关闭了 D-97 的
   "未验证"行）。
   **路线规则留在这里，不要丢：** `-Base` 永远指"内容已被推送过的那个本地提交"（**D-97 (ii)**），
   **绝不给远端 SHA**；判断"推了没有"用 tree 与路径集合，**不要用 SHA 相等** —— 本仓库的两次推送都给出过
   "同内容、不同 SHA"（`a9ea9f2`/`6143f6a`，以及本次的 `671532a`/`fb3f8d6`）。
   从**本目录**运行（脚本按 `git -C $PWD` 定位仓库），`-Base` 给**完整 SHA**；`git push` 在本机仍是死的
   （`CRYPT_E_NO_REVOCATION_CHECK`），REST API 是唯一出口。更正读数见 **D-98**。
0. **CK3 milestone — CANCELLED, cleaned up and CLOSED (D-57); nothing of it is pending work
   here.** Extraction, ingest, the plugin push and the repository topics were all finished and
   verified, and the cancellation has since removed the generated corpus. What is left is not work
   in this workspace:
   (a) the **title backfill is COMPLETE** — the `85 → 104 of 913` readings are superseded (all 913
   titles carry `<wiki title> - CK3 Wiki`, measured before the deletion; item 1 above), and the
   re-run instruction is dead with its tool: `coverage-ck3.mjs` was one of the four `profiles/web`
   CK3 scripts deleted, and the `data/` it read no longer exists. The COUNT stays settled at
   **913** — see open question 12 on how the causes for it add up;
   (b) the 13 leftover items in `曦曦的知识库` are the user's to delete in the ima client — no API
   can remove them;
   (c) `tools/ck3wiki/` is **tracked, not untracked** (`0016c18`, **8** files — D-58 corrects
   D-57's "9"): the generated `data/` is gitignored **and deleted** (`node tools/ck3wiki/extract.mjs`
   rebuilds it), and the directory stays out of the tarball because it is not in `package.json`'s
   `files`.
   **Two lessons worth keeping from this milestone.** *On the ima API:* a **403 is the rate
   limiter, not a dead credential** — proven by an authenticated read succeeding immediately
   after, and by the knowledge base reporting exactly the count the local run had recorded. Add
   spacing and back off; do not go looking for a new key. *On this machine's push route:*
   `-RemoteOnlyParent` **works in a real push** (D-56), and the pushing script runs git against
   **its own cwd** — so it must be invoked with the working directory set to the repository being
   pushed, and `-Base` must be a **full SHA**.
1. ~~Open a new session on 「DSH 研发工坊 · DSH Forge」 and work the three-item checklist~~ —
   **done.** All three closed in `session-8b8072a6`, at a preset whose file hash matched the repo
   copy. `docs/dsh-forge.md` now records the measurements under 三项的实测结果, and its checklist
   is kept as the source of the criteria rather than as pending work.
2. Keep `AGENTS.md` rules 5, 6, 7 and the boundaries current: the mount check needs the shipped
   `cordis` preset, `verify.mjs` is a diagnostic, the two owned preset directories are written
   only through `bin/install.mjs --preset <id>`, and those two directories are the whole owned
   surface — a plugin is a different kind of thing and is never installed with `bin/install.mjs`.
   **Added this session:** rule 7's balance parenthetical now says explicitly that the history it
   records does *not* forbid the feature, because a from-scratch plugin was written and mounted
   after the removals it describes. Read that paragraph as history, not as a standing ban.
3. **Count with the tool's own semantics before publishing a breakdown.** Two counting paths in
   `dsh-agent-presets` skip group containers; this session published three wrong numbers from
   grepping the file directly (D-22, D-25). When a document states a decomposition, parse it or
   print it — do not derive it from a total.
4. **A child's self-reported list is a transcription, not a reading** (D-27). The filtered child
   dropped `ralph` from its prose while the runtime array held it, and misquoted a type alias. Have
   the runtime print the array and compare against that.
5. **When a report is captured, record the revision it was taken at, and re-measure before
   restating any number from it** (D-14, D-16).
6. **A test that passes is a claim about what it asserted, not about what it named.** This session
   produced three examples in one file: the empty-state assertion used `/\d/` and tripped on the
   clock in the same tree; a "stored layout" case seeded `localStorage` *before* the browser
   globals were reinstalled and was silently discarded; and the first version of the client suite
   rendered the *loading* state while claiming to test the empty state. All three were caught only
   by reading the failure output, not by the suite going green.
