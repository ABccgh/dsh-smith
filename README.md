# DSH Presets · 智能体工坊与研发工坊

两个 DeepSeek Harness agent preset，一个仓库。每个都是**一个会话挂载的一份组合**，各自强化思考协议、记忆纪律与具名专家团队，各带一套随行技能。

> Two DeepSeek Harness agent presets in one repository: `dsh-smith` builds harness agents and Cordis plugins, `dsh-forge` delivers software.

[![topics](https://img.shields.io/badge/topics-DeepSeek%20Harness%20Plugins-blue)](https://github.com/search?q=topic%3Adeepseek-harness-plugins&type=repositories)

---

## 该用哪个

| | **`dsh-smith`** · 智能体工坊 | **`dsh-forge`** · 研发工坊 |
| --- | --- | --- |
| 做什么 | 造 DSH 智能体、写 Cordis 插件 | 交付软件：写、改、测、调、审 |
| 专家 | architect / verifier / protocol / chronicler（4） | architect / verifier / **debugger** / protocol / chronicler（5） |
| 计划协议 | 组合设计（平面 / realm / 行清单） | 软件工程（改动面 / 接口 / 边界 / 验收） |
| 工具呈现 | 原生工具表 | `mode: both`：原生工具表 ＋ `run_code` 的 TypeScript SDK |
| 自省工具 | 含 `tool-cordis` 行（本部署下被门关掉） | 不含该行 |
| 血统（`drift-check` 比对的上游） | 出厂 `cordis` | 出厂 `standard` |
| 详细文档 | [`docs/dsh-smith.md`](docs/dsh-smith.md) | [`docs/dsh-forge.md`](docs/dsh-forge.md) |

**两个都装也可以**：它们互不覆盖，各自的源目录就是各自的 preset 目录，会话启动时由选择器决定用哪个。

## 快速开始

**前置条件**：已安装 DeepSeek Harness（`dsh`），Node.js ≥ 20。

```sh
git clone https://github.com/ABccgh/dsh-smith.git
cd dsh-smith

node bin/install.mjs                      # dsh-smith（默认）
node bin/install.mjs --preset dsh-forge   # dsh-forge
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
> **命令行没有 `--agent-preset` 这样的开关**（`dsh` 的选项族是 `--profile` / `--from-default-profile` / `--patch` / `--dump-config` / `--dump-default-config`）。预设由**会话启动时的选择器**选定，装完新开一个会话，在模式选择器里选「DSH 智能体工坊」或「DSH 研发工坊 · DSH Forge」。

## 验证状态

**按字面读。** 本仓库区分「已验证」「只做了静态检查」「未验证」，而**唯一算数的挂载检查有一个硬前提**。

### 挂载检查为什么需要出厂 `cordis` 预设的会话

动态插件探针（`cordis_define` + `cordis_run`）是唯一能在活着的 harness 进程里问到 `agentPresets.standingKeyFor(id)` 的路子，而它需要 `cordis_*` 工具。那套工具只在注册了 `tool-cordis` 行的组合里存在——实测的 live Loader 状态：

| 预设 | `tool-cordis` 行 | `cordis_*` |
| --- | --- | --- |
| 出厂 `cordis` | `enabled=true`，`fiberPhase=active` | **有** — 挂载检查在这里跑 |
| `dsh-smith` | `enabled=false`（`!!js` 门） | 无 |
| `dsh-forge` | 不含该行 | 无 |

原因是那四个 inspect provider 是**进程全局**的，宿主启动时就占用了它们的 id，所以其它组合必须把这一行关掉，否则整体挂载失败。

> **`node bin/verify.mjs` 不是那条挂载检查，而且换会话也救不了它。** 它自己 `new cordis.Context()` 起一个**裸 Cordis 运行时**，按定义不含 harness 注册表，所以 `agentPresets` 永远缺席，它**从任何会话都会打印 `INCONCLUSIVE`**——实测两次、输出逐字相同：一次在普通 shell，一次就在那个 `cordis_*` 齐全的出厂 `cordis` 会话里。它的头注释现在这么写着，它自己也会这么告诉你。**它是诊断工具，不是挂载判定。**

### 两个预设的验证结果

| | `dsh-smith` | `dsh-forge` |
| --- | --- | --- |
| 挂载（`standingKeyFor`） | **通过** | **通过** —— `MOUNTED OK` |
| 组合清单 | 36 行全部组合，**29 行 ACTIVE**，4 行按设计关闭 | 38 具名 = 3 group ＋ **35 叶**，其中 **31 激活**、2 `conditional`、2 关闭 |
| 未激活／无贡献的行 | 无 | 无 |
| 静态预检（`preflight.mjs`） | `validated: 21   skipped: 10   failed: 0` | `validated: 24   skipped: 10   failed: 0` |
| 技能 lint | 5 个全 clean | 4 个全 clean |
| 工具到达模型 | 四条专家 ＋ 两条委派工具在表内，两条产品行缺席 | **32 项**，`run_code` 在，两条产品行缺席 |
| 只读角色过滤 | `expert_verifier` 强制生效（含差分对照） | `expert_verifier` 与 `expert_debugger` 强制生效；**在 PTC 下是「绑定不存在」而非「被拒绝」** |
| PTC / `tools:sdk` | 不适用（原生模式） | **可调用** —— 子代理 `await tools.glob(...)` 成功返回 15 条路径 |

**详细依据与逐条读数**在各预设自己的文档里：[`docs/dsh-smith.md`](docs/dsh-smith.md#验证状态)、[`docs/dsh-forge.md`](docs/dsh-forge.md#验证状态)。

### 未验证，且不声称

- **冷进程**里的挂载是否同样干净——推断（`!!js` 门读 `process.platform` 与 `cordisInspect`，冷进程同值），未实测：实测它要另起一个 harness 进程。
- **`expert_verifier` 在 `dsh-forge` 下未单独委派**——它与 `expert_debugger` 的 `toolFilter` / `provider` / `maxDepth` / `backgroundMode` 逐字对等，所以「测一条覆盖两条」是**由配置对等推出**，不是实测。
- **`restrict()` 本身**造成了拒绝（而非其它同效机制）；**`toolFilter` 遇到未知名字是否 fail-loud**、与 `allow` 如何组合。
- **`dsh-forge` 的 `repeat-tool-reminder` 行与宿主的同名行共存**是否会让提醒出现两次——未测。

## 仓库结构

```
bin/                 六个脚本，两个预设共用
  presets.mjs        唯一的预设登记表：id、源目录、上游预设、预期工具
  install.mjs        安装（--preset / --force / --home）
  preflight.mjs      静态检查：解析每一行的包 + 用插件自己的 schema 验证配置
  verify.mjs         诊断：本机 CLI 能否触及 harness 运行时（不是挂载判定）
  lint-skills.mjs    技能 frontmatter
  drift-check.mjs    与各自的出厂上游逐行比对（只报告，不同步）
dsh-smith/           preset 源目录（组合 + preset.yml + 5 个技能）
dsh-forge/           preset 源目录（组合 + preset.yml + 4 个技能）
docs/
  dsh-smith.md       逐预设文档
  dsh-forge.md
  agent-notes/       本仓库自己的记忆层：PROJECT / DECISIONS / BOARD
AGENTS.md            给 agent 的工作区规则（自动加载）
```

**`bin/preflight.mjs` 通过不等于能挂载**，它自己会这么说。它看不见的三类恰好是最要命的：激活了但什么都没贡献的行、泄漏到根 realm 的服务、以及写在 `apply()` 而不是 schema 里的校验。另外它**不拒绝未知配置键**（schemastery 对多余的键不报错），所以把键名敲错但必需字段仍在的情况它看不见。

**`npm run check` 在 harness 之外会以退出码 1 结束，这是设计如此。** 它把 `lint`、`preflight`、`verify` 串起来跑，而 `verify` 把「没检查」当作不通过。所以本仓库**不适合**直接把 `npm run check` 放进 CI：CI 里请只跑 `node bin/lint-skills.mjs && node bin/preflight.mjs`（纯静态、退出码可靠）。`npm run check:all` 覆盖两个预设。

## 许可与来源

MIT。见 [LICENSE](LICENSE)。

`dsh-smith/skills/` 下的 `editing-cordis-compositions` 与 `cordis-plugin-development` 复制自 DeepSeek Harness 官方发行包 `@deepseek-ai/dsh-agent-presets` 的 `cordis` 预设，遵循其 MIT 许可，版权归 DeepSeek 所有；其余内容（含 `dsh-forge` 的四个技能）为本仓库原创。
