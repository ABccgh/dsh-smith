# DSH Presets · 智能体工坊 / 研发工坊 / CK3 模组工坊

三个 DeepSeek Harness agent preset，一个仓库。每个都是**一个会话挂载的一份组合**，各自强化思考协议、记忆纪律与具名专家团队，各带一套随行技能。

> Three DeepSeek Harness agent presets in one repository: `dsh-smith` builds harness agents and Cordis plugins, `dsh-forge` delivers software, `dsh-ck3-mod` authors Crusader Kings III mods.

[![topics](https://img.shields.io/badge/topics-DeepSeek%20Harness%20Plugins-blue)](https://github.com/search?q=topic%3Adeepseek-harness-plugins&type=repositories)

---

## 该用哪个

| | **`dsh-smith`** · 智能体工坊 | **`dsh-forge`** · 研发工坊 | **`dsh-ck3-mod`** · CK3 模组工坊 |
| --- | --- | --- | --- |
| 做什么 | 造 DSH 智能体、写 Cordis 插件 | 交付软件：写、改、测、调、审 | **只做 CK3 模组开发**：写得出、校验得了、记忆留得住 |
| 专家 | architect / verifier / protocol / chronicler（4） | architect / verifier / **debugger** / protocol / chronicler（5） | modd / verifier / chronicler（3） |
| 计划协议 | 组合设计（平面 / realm / 行清单） | 软件工程（改动面 / 接口 / 边界 / 验收） | 模组四段（目标与落点 / 证据清单 / 执行顺序 / 未知与假设） |
| 工具呈现 | 原生工具表 | `mode: both`：原生工具表 ＋ `run_code` 的 TypeScript SDK | 原生工具表 |
| 自省工具 | 含 `tool-cordis` 行（本部署下被门关掉） | 不含该行 | 不含该行 |
| 宿主依赖 | 无 | `dsh-web-app` 的 `code-runtime` | **一个插件**：`dsh-ck3-modcheck`（见下） |
| 血统（`drift-check` 比对的上游） | 出厂 `cordis` | 出厂 `standard` | 出厂 `standard` |
| 详细文档 | [`docs/dsh-smith.md`](docs/dsh-smith.md) | [`docs/dsh-forge.md`](docs/dsh-forge.md) | [`docs/dsh-ck3-mod.md`](docs/dsh-ck3-mod.md) |

**三个都装也可以**：它们互不覆盖，各自的源目录就是各自的 preset 目录，会话启动时由选择器决定用哪个。

> ### `dsh-ck3-mod` 还需要一个插件
>
> 与另外两个不同，`dsh-ck3-mod` 的 `tool-ck3-modcheck` 行引用的是**本仓库不发布的宿主平面插件** `dsh-ck3-modcheck`：它按**原版游戏安装**的判据校验模组——`.mod` 与文件夹是否配对、`descriptor.mod` 在不在、路径是否全 ASCII、本地化 `.yml` 是否带 UTF-8 BOM 与 `l_english:` 首行、脚本括号是否配平。
> 它装在 `$DSH_HOME/plugins/` 下、由 profile 的 `cordis.patch.yml` 一行 `insert:` 挂载，**不在本仓库里**（本仓库只发布 preset，见 `AGENTS.md` 规则 7）。
> 没有它，preset 仍然能挂载，但 `ck3_modcheck` 不会出现——而那正是"交付前必跑"这条规矩的执行者。安装步骤在 [`docs/dsh-ck3-mod.md`](docs/dsh-ck3-mod.md)。

## 快速开始

**前置条件**：已安装 DeepSeek Harness（`dsh`），Node.js ≥ 20。

```sh
git clone https://github.com/ABccgh/dsh-smith.git
cd dsh-smith

node bin/install.mjs                          # dsh-smith（默认）
node bin/install.mjs --preset dsh-forge       # dsh-forge
node bin/install.mjs --preset dsh-ck3-mod     # dsh-ck3-mod（还需要一个插件，见上）
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
> **命令行没有 `--agent-preset` 这样的开关**（`dsh` 的选项族是 `--profile` / `--from-default-profile` / `--patch` / `--dump-config` / `--dump-default-config`）。预设由**会话启动时的选择器**选定，装完新开一个会话，在模式选择器里选「DSH 智能体工坊」「DSH 研发工坊 · DSH Forge」或「CK3 模组工坊 · CK3 Mod Forge」。

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

原因是那四个 inspect provider 是**进程全局**的，宿主启动时就占用了它们的 id，所以其它组合必须把这一行关掉，否则整体挂载失败。

> **`node bin/verify.mjs` 不是那条挂载检查，而且换会话也救不了它。** 它自己 `new cordis.Context()` 起一个**裸 Cordis 运行时**，按定义不含 harness 注册表，所以 `agentPresets` 永远缺席，它**从任何会话都会打印 `INCONCLUSIVE`**——实测两次、输出逐字相同：一次在普通 shell，一次就在那个 `cordis_*` 齐全的出厂 `cordis` 会话里。它的头注释现在这么写着，它自己也会这么告诉你。**它是诊断工具，不是挂载判定。**

### 三个预设的验证结果

| | `dsh-smith` | `dsh-forge` | `dsh-ck3-mod` |
| --- | --- | --- | --- |
| 挂载（`standingKeyFor`） | **通过** | **通过** —— `MOUNTED OK` | **通过** —— `MOUNT OK`（出厂 `cordis` 会话，见下） |
| 组合清单 | 36 行全部组合，**29 行 ACTIVE**，4 行按设计关闭 | 38 具名 = 3 group ＋ **35 叶**，其中 **31 激活**、2 `conditional`、2 关闭 | 27 具名 = 3 group ＋ **24 叶**，其中 **23 行 ACTIVE**、1 行 `disabled` 无 fiber |
| 未激活／无贡献的行 | 无 | 无 | **无未激活行**：24 个叶行中 23 行 `fiberState = 2`（`ACTIVE`）、1 行 `disabled`；**贡献仍无读数** |
| 静态预检（`preflight.mjs`） | `validated: 21   skipped: 10   failed: 0` | `validated: 24   skipped: 10   failed: 0` | **无法在 CI 跑** —— 见下 |
| 技能 lint | 5 个全 clean | 4 个全 clean | 3 个全 clean |
| 工具到达模型 | 四条专家 ＋ 两条委派工具在表内，两条产品行缺席 | **32 项**，`run_code` 在，两条产品行缺席 | **未验证** |
| 只读角色过滤 | `expert_verifier` 强制生效（含差分对照） | `expert_verifier` 与 `expert_debugger` 强制生效；**在 PTC 下是「绑定不存在」而非「被拒绝」** | 设计上对 `expert_verifier` 用 `deny: [write, edit]`，未验证 |
| PTC / `tools:sdk` | 不适用（原生模式） | **可调用** —— 子代理 `await tools.glob(...)` 成功返回 15 条路径 | 不适用（原生模式） |

**`dsh-ck3-mod` 为什么这一列几乎全是「未验证」，而不是一句「已通过」：**

1. **它的挂载检查已经跑了（实测，在一个出厂 `cordis` 预设的会话里）——但这一列仍不写「已通过」。** `standingKeyFor('dsh-ck3-mod')` 正常返回（`MOUNT OK`），同一次 `compositionInventory()` 给出 **24 个叶行**、`broken: none`、**23 行 `fiberState = 2`**（`ACTIVE`）；唯一没有 fiber 的是因平台表达式而 `disabled` 的 `tool-bash`。**它证明的是「没抛错、每个启用行都 ACTIVE」，不是「每一行都贡献了模型可见的东西」**（D-40）——`tool-ck3-modcheck` 的 fiber 是 ACTIVE，**不等于** `ck3_modcheck` 出现在该预设的工具表里，所以「工具到达模型」那一格仍是**未验证**。逐条读数见 [`docs/dsh-ck3-mod.md`](docs/dsh-ck3-mod.md)。
2. **它的 `preflight` 不能在 CI 跑，因为 `tool-ck3-modcheck` 那一行引用的是本仓库不发布的插件。** `dsh-ck3-modcheck` 是宿主平面插件，从 profile 的 `node_modules` 解析；装了的机器上通过，没有 profile 的 runner 上必然 `Cannot find package`。按 `.github/workflows/checks.yml` 自己的规矩（**不能变绿的步骤要排除并写明理由，不许用 `continue-on-error` 糊过去**），这一条被排除，CI 里留给它的是 `lint-skills` 与 tarball 清单核对。
3. **`preflight` 对那一个插件的 config 其实也不做校验。** 实测 `bin/preflight.mjs:178` 只在 `typeof Config === 'function'` 时才读 schema，而该插件（与 `dsh-ima-kb` 同一写法）导出的是**普通对象**形式的 Standard Schema，所以它打印 `skip <id> (exports no usable Config schema)` 然后**跳过**。配置校验因此落在插件自己的 `test/falsify.mjs` 里——那一份是**实测通过**的：**121/121 断言**、**39 个检查 code**，6 类植入缺陷逐个点名，且对真实原版本地化文件零误报。这一点写清楚，比让读者以为 preflight 验过了要好。

**详细依据与逐条读数**在各预设自己的文档里：[`docs/dsh-smith.md`](docs/dsh-smith.md#验证状态)、[`docs/dsh-forge.md`](docs/dsh-forge.md#验证状态)、[`docs/dsh-ck3-mod.md`](docs/dsh-ck3-mod.md)。

### 未验证，且不声称

- **冷进程**里的挂载是否同样干净——推断（`!!js` 门读 `process.platform` 与 `cordisInspect`，冷进程同值），未实测：实测它要另起一个 harness 进程。
- **`expert_verifier` 在 `dsh-forge` 下未单独委派**——它与 `expert_debugger` 的 `toolFilter` / `provider` / `maxDepth` / `backgroundMode` 逐字对等，所以「测一条覆盖两条」是**由配置对等推出**，不是实测。
- **`restrict()` 本身**造成了拒绝（而非其它同效机制）；**`toolFilter` 遇到未知名字是否 fail-loud**、与 `allow` 如何组合。
- **`dsh-forge` 的 `repeat-tool-reminder` 行与宿主的同名行共存**是否会让提醒出现两次——未测。

## 仓库结构

```
bin/                 九个文件，三个预设共用
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
docs/
  dsh-smith.md       逐预设文档
  dsh-forge.md
  dsh-ck3-mod.md
  agent-notes/       本仓库自己的记忆层：PROJECT / DECISIONS / BOARD
AGENTS.md            给 agent 的工作区规则（自动加载）
```

**`dsh-ck3-mod` 的那一个插件不在这个仓库里。** `dsh-ck3-modcheck` 装在 `$DSH_HOME/plugins/` 下、由 profile 的 `cordis.patch.yml` 一行 `insert:` 挂载——这是本仓库既有的模式（同 `dsh-account-balance`、`dsh-ima-kb`、`dsh-desktop`），也是 `AGENTS.md` 规则 7 的边界：本仓库只发布 preset，Cordis 插件由 `dsh plugin --profile <profile> add <path>` 写入 profile 的依赖图。复制 `dsh-ck3-mod/` 到另一台机器**不会**带上它。

## 仓库之外的插件

本仓库只发布 preset（规则 7）。有三个 Cordis 插件是**独立仓库**，各自单独克隆与安装，**都不在本仓库的 tarball 里**：

| 插件 | 做什么 | 承载它的 preset |
| --- | --- | --- |
| [`dsh-ck3-modcheck`](https://github.com/ABccgh/dsh-ck3-modcheck) | 按**原版游戏安装**的判据校验 CK3 模组：`.mod` 与文件夹配对、`descriptor.mod`、路径全 ASCII、本地化 BOM 与 `l_english:` 首行、脚本括号配平；另读启动器 playset 与运行时日志 | `dsh-ck3-mod`（宿主平面一行 `insert:`） |
| [`dsh-agent-memory`](https://github.com/ABccgh/dsh-agent-memory) | **经验层**：把记录下来的教训蒸馏进 `~/.dsh/AGENTS.md` 里一个受管区块，该区块**每个会话每一轮自动加载** | 与 preset 无关（宿主平面，因此三个 preset 都获得它） |
| [`dsh-account-balance`](https://github.com/ABccgh/dsh-account-balance) | Web GUI 的余额徽标（宿主侧 `GET /api/balance` ＋ 浏览器侧 sidebar 徽标） | 与 preset 无关 |

**`dsh-agent-memory` 的边界值得写下来，因为它最容易被高估**：它**不是学习**——本部署没有权重更新路径。它做的是**保证检索**：凡是写进 `LESSONS.md` 的，都会出现在每个会话的每一轮里。对**没有人记录过的**教训它一无所知。另外，**在沙箱会话里它只生成、不落盘**：插件写文件走的是被沙箱包住的 `fs` 接缝，`workspace-write` 会拒绝写 `~/.dsh`——这是保护在起作用（agent 不该能悄悄改掉那份指导每个会话的文件），不是缺陷。

**`bin/preflight.mjs` 通过不等于能挂载**，它自己会这么说。它看不见的三类恰好是最要命的：激活了但什么都没贡献的行、泄漏到根 realm 的服务、以及写在 `apply()` 而不是 schema 里的校验。另外它**不拒绝未知配置键**（schemastery 对多余的键不报错），所以把键名敲错但必需字段仍在的情况它看不见。

**`npm run check` 在 harness 之外会以退出码 1 结束，这是设计如此。** 它把 `lint`、`preflight`、`verify` 串起来跑，而 `verify` 把「没检查」当作不通过。所以本仓库**不适合**直接把 `npm run check` 放进 CI：CI 里请只跑 `node bin/lint-skills.mjs && node bin/preflight.mjs`（纯静态、退出码可靠）。`npm run check:all` 覆盖 `dsh-smith` 与 `dsh-forge`；`dsh-ck3-mod` **故意不在其中**，因为它的 preflight 依赖那个本仓库不发布的插件（原因见上面的验证状态一节）。

## 许可与来源

MIT。见 [LICENSE](LICENSE)。

`dsh-smith/skills/` 下的 `editing-cordis-compositions` 与 `cordis-plugin-development` 复制自 DeepSeek Harness 官方发行包 `@deepseek-ai/dsh-agent-presets` 的 `cordis` 预设，遵循其 MIT 许可，版权归 DeepSeek 所有。`dsh-ck3-mod/skills/` 下的 `dsh-runtime-reference` 同样复制自 `dsh-smith`，属本仓库原创内容。其余内容（含 `dsh-forge` 的四个技能与 `dsh-ck3-mod` 的另外两个技能）为本仓库原创。

**本仓库不分发、不缓存任何游戏或 wiki 语料。** `dsh-ck3-mod` 只携带**方法**——`.mod` 布局、本地化编码、脚本语法、交付前必须跑 `ck3_modcheck`——而每一条判据要么来自运行时的校验插件对**用户本机原版安装**的读取，要么来自模型的 `web_fetch` 现场抓取的 CK3 Wiki 页面（该站页脚声明其内容为 **CC BY-SA 3.0**，版权归其各自作者）。`tools/ck3wiki/` 是上一轮取消的镜像项目留下的工具，**不在本仓库发布的 tarball 里**（见 `AGENTS.md` 规则 7）。
