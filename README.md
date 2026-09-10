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

安装脚本把 `dsh-smith/` 整个目录复制到 `${DSH_HOME:-$HOME/.dsh}/.agent-presets/dsh-smith/`。它不会覆盖已存在的同名预设。

**验证安装**：

```sh
node bin/verify.mjs
```

该脚本调用花名册的 `standingKeyFor(id)` 做真实挂载检查——组合每个插件行，但不启动 agent、不启动会话、不启动回合。它刻意区分三种结局，**绝不把「没检查」说成「检查通过」**：

| 输出 | 含义 | 退出码 |
| --- | --- | --- |
| `MOUNTED OK` | 组合成功：无未激活行，无泄漏到根 realm 的服务 | 0 |
| `MOUNT REJECTED` | 无法组合，并打印确切原因 | 1 |
| `INCONCLUSIVE` | 本机没有可询问的 harness 运行时，**什么都没验证** | 1 |

裸 Cordis 运行时不含 harness 的注册表，所以在普通 shell 里它通常返回 `INCONCLUSIVE`；要在真实部署里验证，请在任意模式的会话中调用 `standingKeyFor('dsh-smith')`。

然后在需要该能力的会话里选择模式 **「DSH 智能体工坊」**。

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

### 2. 记忆纪律

| 层 | 路径 | 生命周期 |
| --- | --- | --- |
| 指令 | `AGENTS.md`（按目录） | 持久，自动加载 |
| 编年史 | `docs/agent-notes/PROJECT.md` | 持久，就地修订 |
| 决策 | `docs/agent-notes/DECISIONS.md` | **只追加**，含「什么会推翻它」 |
| 工作板 | `docs/agent-notes/BOARD.md` | 易变，自由重写 |

`AGENTS.md` 的加载预算在本预设中从默认 65536 提升到 **196608 字节**；工具结果修剪阈值同步放宽（12288/6144/2048），因为专家报告与挂载验证输出是本预设的长结果。

### 3. 专家团队

四位具名专家，每一位是一条独立的 `@deepseek-ai/dsh-tool-subagent` 行——spawn 提供者声明了 `persona`、`toolFilter`、`depthLimit`、`agentOptions` 能力，所以「角色」就是给某一行一个角色的 persona 和推理预算。

| 工具 | 职责 | 推理预算 | 写权限 | 输出契约 |
| --- | --- | --- | --- | --- |
| `expert_architect` | 架构与设计 | `max` | 有 | 决策 / 边界 / 取舍 / 风险 / 验收 |
| `expert_verifier` | 对抗式验证 | `max` | **无** | 结论 / 发现 / 未被攻破 / 空白 |
| `expert_protocol` | 协议、生态、版本 | 默认 | 无 | 答案 / 证据 / 冲突 / 未知 |
| `expert_chronicler` | 记忆维护 | 默认 | 仅记忆层 | 已记录 / 已确立 / 未决 |

`expert_verifier` 通过工具过滤被摘掉 `write` 与 `edit`：**看不见，且强制执行也会被拒**。审查无法悄悄变成重写，这是该行存在的全部意义。

四者默认后台运行（`backgroundMode: continuable`），因此一条消息可以并行启动全部专家；`subagent` 行的 `maxDepth: 2` 把递归界定为「主智能体 → 专家 → 专家的助手」。

### 4. 随行技能

| 技能 | 作用 |
| --- | --- |
| `editing-cordis-compositions` | 组合创作与两个平面的判据（随出厂 `cordis` 预设分发） |
| `cordis-plugin-development` | 动态 Cordis 插件开发（随出厂 `cordis` 预设分发） |
| `dsh-runtime-reference` | **本部署的**路径、按平面分组的行清单、实时服务与提示段落名、挂载诊断 |
| `dsh-expert-team` | 团队名册、交接契约、如何组合一个新角色 |
| `dsh-memory-chronicle` | 四层记忆布局、条目格式、维护规则 |

## 已知限制：`tool-cordis` 那一行

**这一节记录的是一个未修好的缺陷，不是设计亮点。** 如果你只需要专家团队、思考协议和记忆层，可以忽略它；如果你要用本预设开发 Cordis 插件，请先读完。

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

**已用真实挂载验证的部分**（`agentPresets.standingKeyFor('dsh-smith')`，非仅阅读确认）：

- 挂载通过——无未激活行，无泄漏到根 realm 的服务；
- `compositionInventory()` 报告 **33 行全部组合，32 行 `ACTIVE`**；
- 恰好 4 行按设计关闭：`tool-bash`（Windows 平台门）、`tool-cordis`（上述条件门）、`tool-subagent-codex` 与 `tool-subagent-claude-code`（未安装的可选产品提供者）；
- 四条专家行 `tool-expert-architect / verifier / protocol / chronicler` 全部 `ACTIVE`。

**我必须明确标注的验证缺口。** 上面这些只证明「行组合成功且处于 ACTIVE」，**不证明任何工具真的到了模型手上**——行激活与工具可用是两件事。以下三项在本仓库交付时尚无端到端观测：

1. 四条专家行是否真的注册出 `expert_architect` / `expert_verifier` / `expert_protocol` / `expert_chronicler` 四个模型可见工具，以及子代理创建路径是否可用；
2. `tool-cordis` 在目标部署上究竟落在上述哪一种情况；
3. `tool-subagent` 行上的 `modelSelectionSettings: true` 是否有效——该设置依赖宿主挂载 `@deepseek-ai/dsh-tool-subagent/model-selection-settings` 行，本部署的基础组合里没有它，因此**很可能是一个静默无效的配置**，同时 `list_subagent_models` 工具也不会出现。

首次在真实会话里使用时，请用 `cordis_inspect_query` 的 `Tool.listTools` 取一次真实工具表来确认第 1、3 项。

## 兼容性

针对 DeepSeek Harness **0.1.5-rc.1** 的行名与配置面编写。行名、服务键与配置字段属于部署内部接口，升级后可能移动；升级后请重新运行 `node bin/verify.mjs`。

## 许可与来源

MIT。见 [LICENSE](LICENSE)。

`dsh-smith/skills/` 下的 `editing-cordis-compositions` 与 `cordis-plugin-development` 两个技能复制自 DeepSeek Harness 官方发行包 `@deepseek-ai/dsh-agent-presets` 的 `cordis` 预设，遵循其 MIT 许可，版权归 DeepSeek 所有；其余内容为本仓库原创。
