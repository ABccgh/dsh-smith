---
name: drama-workspace
description: 本机 D:\AIVideo 工作区的契约：目录布局与当前真实状态（**没有正在进行的短剧项目**）、三个 duanju_* 工具为什么是首选路径而 node 脚本是回退、源与产物的唯一性规则、并发写锁、工作区规则层为什么是空的，以及「读不到」不许长得像「没问题」。当要跑一个检查、要判断读到的文件是不是权威、要新建一个剧目录、或结果与预期不符时使用。
---

# D:\AIVideo 工作区契约

## 〇、先读这一节：工作台现在**没有在拍的短剧**

> **毕业照 / 金枝 / 家规三个剧本已取消并完全删除**（git `0ace833`，D-69，`DECISIONS.md:3011`）。
> `products\` 下现在只剩 `image-to-video`（自用单件，非营收）与 `travel-promo`（两份参考件，订单已取消）。
> **它们都不是剧本。**

盘上**唯一完整的一部剧**是测试夹具：

```
D:\AIVideo\tools\_fixtures\series-min\
  story.json  manifest.json
  bible\{characters,props,scenes,voices}.json + README.md
  episodes\第01集.json
  script\可导入-第01集.txt
  （另有 12 份分镜表 CSV 与一个历史基线子目录 —— 那一部分不属本 preset 的范围，见第三节）
```

**夹具的用途是回归测试，不是内容。** 要拿一个剧目录练手、要验证一条命令能不能跑，用它；
要设计一部新剧，要**先和用户确认剧名与题材**，再新建 `products\<剧名>\`。

⚠️ **任何技能、任何记忆层里把 毕业照/金枝/家规 当成在拍的项目，都是过期信息**，读到就当缺陷报出来。

⚠️⚠️ **但夹具本身带着 `金枝` 这个残留名字，而且是故意的，不要去「清理」它。**
夹具的 `story.json:2` 是 `"seriesId": "金枝"`（`manifest.json` 同），
因为它是在删除前**从金枝抽出来的**（git `0ace833`，识别为逐字节相同的 `R100` 改名），
D-69 的「什么会推翻它」第 2 条点名了这件事。最小夹具的定义是
「**被测工具运行时真正会读的全部输入**」（D-69 第三节）——
**改它的 `seriesId`、或删它的文件，就是让那几套测试再次静默地测不到东西。**
所以两句话分开说：**金枝不是一部在跑的剧**；**夹具带金枝的残留数据**。

**夹具的完整读数（实测，别当成「一部中性的最小剧」）**：**22 个文件** ·
`episodes\第01集.json` 一份 · `script\可导入-第01集.txt` **一份**（**整部件不存在**
⇒ **实测**：跑 `script-only-check.mjs --series <夹具>` 得到
`? [UNAVAILABLE] script/ 下没有「可导入-第<剧名>-全N集.txt」`、`汇总：不可读 1`、**退出码 3** ——
**那不是在通过**）· `bible\` 下**四件 JSON 加一份 `README.md`**（「bible 四件」指的是四个 JSON，目录里是 5 个条目）·
`story.json` **没有** `episodeCharsMin` / `episodeCharsMax` 两个字段（所以字数下限走缺省 1450，
夹具**不能**用来验证「声明了区间」那条路径）。

## 一、布局

```
D:\AIVideo\
  products\<剧名>\              一部剧一个目录
    story.json                  集数、声明时长、分集功能表（每集 number/seconds/function/hook3s/cliffhanger/paywall）
    manifest.json               平台模式与分辨率等声明
    bible\                      characters.json / props.json / scenes.json / voices.json
    episodes\第NN集.json        每集一份紧凑 JSON —— **正文的唯一源**
    script\可导入-<剧名>-全N集.txt   平台真正导入的那一份（整部）—— **交付物**
    script\可导入-第NN集.txt        单集那份，写与改稿时的依据
    评估报告-回填.json            平台评估读数（见 script-review 技能）
    项目总览.md                   受管区块，只由 duanju_checkpoint 写（见 drama-project-memory 技能）
  tools\                       所有脚本 + _fixtures\
  platforms\<平台>\             投稿材料（SOURCE.md / notes.md / raw\）
  PROJECT.md  DECISIONS.md  INVENTORY.md  HANDOFF-CHECKLIST.md
```

**`.git` 在工作区根**，所以从任意子目录起的会话都能上溯到 `D:\AIVideo` 作为项目根。

## 二、首选路径：三个 `duanju_*` 工具；`node` 脚本是回退

本工作台有一个**宿主平面的剧本域插件**（`D:\dsh-duanju-script`）注册的三个工具。它们做的是同一批事，
但**返回结构化结论**而不是一段要你肉眼解析的文字 —— 所以**默认用它们**：

| 要做的事 | 首选 | 回退（工具不覆盖时） |
| --- | --- | --- |
| 跑正文契约检查，拿四态结论 | `duanju_gate`（`range: 'script-only'`） | `node D:\AIVideo\tools\script-only-check.mjs --series <剧目录>` |
| 一个剧的当前状态投影 | `duanju_recall` | 分别读 `story.json` / `manifest.json` / bible / 回填 |
| 把投影写进 `项目总览.md` | `duanju_checkpoint` | **没有回退** —— 手写会破坏受管区块 |

**工具不覆盖、必须用 `node` 的部分**（这些仍然要跑）：

```powershell
# 从 episodes\第NN集.json 重拼整部正文（平台真正导入的那一份）
node D:\AIVideo\tools\episode-build.mjs  --series D:\AIVideo\products\<剧名> --all --script
# 只校验、不写盘的预览
node D:\AIVideo\tools\episode-build.mjs  --series D:\AIVideo\products\<剧名> --all --script --check
# 判 story.json 里的 hook3s 与 cliffhanger 有没有落点（机器契约里没有 hook3s 这一条）
node D:\AIVideo\tools\hook-audit.mjs     --series D:\AIVideo\products\<剧名>
# 圣经那一层的台账（含 bible\README.md 的受管区块）
node D:\AIVideo\tools\asset-manifest.mjs --series D:\AIVideo\products\<剧名> --check
```

- `--check` 是**不写盘**的预览。想确认「本可写」就用它。
- `episode-build.mjs` 的三态是 `BUILD-OK / BUILD-FAIL / BUILD-UNAVAILABLE`（后者是「跑不了」，不是通过）。
- **`duanju_gate` 四态**（`PASS / FAIL / UNAVAILABLE / CRASHED`）与分类器的完整口径，见 `script-tools` 技能。
- `hook-audit.mjs` 的退出码是 `0` 全有落点 / `2` 有落点缺失 / `1` 用法或输入错；
  它读的是**源文件**（`episodes\第NN集.json`），不是生成物。

> **不要手改产物。** 改 `script\*.txt` 而不改 `episodes\第NN集.json`，下一个跑生成器的人会把你的修改覆盖掉，
> **而且在覆盖之前没有任何东西会报错。** 这是本工作区最贵的一类错，因为它静默。

## 三、一处已知的硬编码路径（记在这里的那一条链已移出本 preset）

全工作台**唯一**一处硬编码的目录是 **`tools\board-to-xlsx.mjs:30`**：

```
30: const TEMPLATE_DIR = 'D:\\AIVideo\\research-youxi\\templates'
```

**它属分镜表导出那条链，那条链不属本 preset。** 之所以还留在这里，是因为它是**「文档里的行号会过期」
这个盲区的标本**，值得你在别处复用这条判据：

- **实测（逐行读出来的）**：那一行今天在 **`:30`**（文件共 337 行），而工作区里**有两份文档**
  把它写成 `:29` —— `DECISIONS.md:1445` 与 `INVENTORY.md:111`。
  （**更正**：已随分镜表一起移出本 preset 的 `shotlist` 技能——**那份技能不再存在，不要去找它**——
  记的是「三份文档都写 `:29`」；我在 `D:\AIVideo` 全树递归搜，今天只找到**两份**。
  第三份可能在已删的项目目录里。）
- **没有任何检查读行号**，所以行号过期**不会让任何东西变红**。
  `DECISIONS.md:3107` 把这条点名成「头部注释与文档里的行号」这个盲区。
- ⇒ **本工作区已定的写法（`DECISIONS.md:3251`）：引用位置时优先引内容锚点；
  无法用内容锚点时必须同时给行号与可辨认的原文片段** —— 所以本技能给的是 `board-to-xlsx.mjs:30`
  **加上** `const TEMPLATE_DIR`。你在别处引用位置时照这个写法。

## 四、并发：一个剧目录同时只能有一个写者

多个 preset（或两个会话）可能同时指向 `products\<剧名>\`。
工作区记录过这类事故（D-10「并发跑同一个文件必须先拿锁」）。后果是**一半来自这个会话、一半来自那个会话**的文件，
而且**没有任何检查会报错**。

**开工前看一眼 `manifest.json` 的 mtime**；不确定就问用户「现在是不是只有我在写这部剧」。

## 五、工作区规则层：**今天是空的**（这是实情，不是省略）

`agent-instructions` 已把 `.git`、`AGENTS.md`、`DRAMA.md` 列为项目根标记，
候选文件是 `AGENTS.md` / `CLAUDE.md` / `DRAMA.md`。

**实测：`D:\AIVideo` 里这三个都不存在**，所以从那里起的会话**读不到任何工作区规则层** ——
本技能与这个 preset 的其他技能就是那层规则的替代品。用户哪天建了 `D:\AIVideo\AGENTS.md` 或 `DRAMA.md`，
下一次读取就会把它带上（**不需要重启宿主**）。

## 六、这条工作区的规矩：**「读不到」不许长得像「没问题」**

本工作区反复付过这条学费，所以每个检查都在输出上区分：判完了通过 / 判完了不通过 / **判不了**。
`duanju_gate` 把这一条做成了**第四态**：`CRASHED`（脚本崩了或参数用错）与 `UNAVAILABLE`（跑不了）
是**两个不同的「没判」**，而它们都不是 `PASS`。

**你对用户报告时也要这样。** 缺文件、缺目录、依赖缺失、命令没跑 —— 说「没跑」「读不到」，
不要说「没有发现问题」。空结果集与「没问题」在读数上长得一样，而含义相反。
（这一条在本 preset 里有一处反直觉的实测：**剧目录里没有 `story.json` 时，工具会报 `CRASHED`** ——
而那不是脚本坏了。详见 `script-tools` 第二节。）

## 七、自检清单

- [ ] 我知道这一步的**权威文件**是哪一个绝对路径，而不是「大概在那个目录」
- [ ] 我确认过 `products\` 下没有把已删的三个项目当成在跑
- [ ] 我引用位置时给了**内容锚点**，或在行号之外还给了可辨认的原文片段
- [ ] 我没手改产物（`script\*.txt`），而是改了 `episodes\第NN集.json` 再重拼
- [ ] 开工前我看过 `manifest.json` 的 mtime，或问过用户是不是只有我在写
- [ ] 我报的是「读到了 / 读不到」，不是把空结果集说成「没有问题」
