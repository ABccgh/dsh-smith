---
name: drama-workspace
description: 本机 D:\AIVideo 工作区的契约：目录布局与当前真实状态（**没有正在进行的短剧项目**）、六个 `duanju_*` 工具为什么是首选路径而 `node` 脚本是回退、产物与源的唯一性规则、并发写锁、以及工作区里那几处硬编码路径。当要跑一个检查、要判断读到的文件是不是权威、要新建一个剧目录、或结果与预期不符时使用。
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
  storyboards\第01集-分镜.csv … 第12集-分镜.csv   （12 集，28 列）
  storyboards\_baseline-25列\第01集-分镜.csv      （历史基线，25 列；不是权威）
  script\可导入-第01集.txt
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

**夹具的完整读数（实测，别当成「一部中性的最小剧」）**：22 个文件 · `episodes\第01集.json` 一份 ·
`script\可导入-第01集.txt` **一份**（**整部件不存在** ⇒ `duanju_recall` 报 `whole.length === 0`，
闸门 E9a 会报 `UNAVAILABLE` —— **那不是在通过**）· `bible\` 下**四件 JSON 加一份 `README.md`**
（「bible 四件」指的是四个 JSON，目录里是 5 个条目）· `storyboards\` 12 集 28 列，
外加一个 `_baseline-25列\` 子目录（**旧基线，不是当前分镜表**；`duanju_contract` 明确只读直系文件，不进子目录）。

## 一、布局

```
D:\AIVideo\
  products\<剧名>\              一部剧一个目录
    story.json                  集数、声明时长、分集功能表（每集的 number/seconds/功能/paywall）
    manifest.json               平台模式与分辨率等声明
    bible\                      characters.json / props.json / scenes.json / voices.json
    storyboards\第NN集-分镜.csv  28 列，闸门直接判的那份
    storyboards\第NN_15列_平台导入.xlsx
    script\可导入-<剧名>-全N集.txt   平台真正导入的那一份（整部）
    script\可导入-第NN集.txt        单集那份，是写分镜时的依据，不是交付物
    episodes\第NN集.json         每集一份紧凑 JSON —— **所有产物的唯一源**
    assets\  refs\  shots\ out\
    评估报告-回填.json            平台评估读数（见 youxi-platform 技能）
    项目总览.md                   受管区块，只由 duanju_checkpoint 写（见 drama-project-memory 技能）
  tools\                       所有脚本 + _fixtures\
  research-youxi\templates\    三份官方 xlsx 模板
  platforms\<平台>\             投稿材料（SOURCE.md / notes.md / raw\）
  PROJECT.md  DECISIONS.md  INVENTORY.md  HANDOFF-CHECKLIST.md
```

**`.git` 在工作区根**，所以从任意子目录起的会话都能上溯到 `D:\AIVideo` 作为项目根。

## 二、首选路径：六个 `duanju_*` 工具；`node` 脚本是回退

本工作台有一个**宿主平面的剧本域插件**（`D:\dsh-duanju-script`）注册的六个工具。它们做的是同一批事，
但**返回结构化结论**而不是一段要你肉眼解析的文字 —— 所以**默认用它们**：

| 要做的事 | 首选 | 回退（工具不覆盖时） |
| --- | --- | --- |
| 跑闸门，拿四态结论 | `duanju_gate` | `node D:\AIVideo\tools\script-gate.mjs …` |
| 查列契约（权威数组） | `duanju_contract` | 直接读 `script-gate.mjs` 的 `REQUIRED_COLUMNS` |
| 分镜表逐行形状 | `duanju_board` | `node tools\diagnose-board.mjs <csv>` |
| 官方模板逐字节对照 | `duanju_template` | 手工解 zip 读 `xl/worksheets/sheet1.xml` |
| 一个剧的当前状态投影 | `duanju_recall` | 分别读 `story.json` / `manifest.json` / bible / 回填 |
| 把投影写进 `项目总览.md` | `duanju_checkpoint` | **没有回退** —— 手写会破坏受管区块 |

**工具不覆盖、必须用 `node` 的部分**（这些仍然要跑）：

```powershell
node D:\AIVideo\tools\episode-build.mjs --series D:\AIVideo\products\<剧名> --all --script
node D:\AIVideo\tools\episode-build.mjs --series D:\AIVideo\products\<剧名> --episode <N> --check
node D:\AIVideo\tools\episode-build.mjs --series D:\AIVideo\products\<剧名> --episode <N> --import
node D:\AIVideo\tools\board-to-xlsx.mjs   --series D:\AIVideo\products\<剧名> --episode <N> --dry-run
node D:\AIVideo\tools\board-to-xlsx.mjs   --series D:\AIVideo\products\<剧名> --episode <N>
node D:\AIVideo\tools\verify-xlsx-external.mjs <xlsx>
node D:\AIVideo\tools\hook-audit.mjs      --series D:\AIVideo\products\<剧名>
node D:\AIVideo\tools\asset-manifest.mjs  --series D:\AIVideo\products\<剧名> --check
node D:\AIVideo\tools\quota-check.mjs     --series D:\AIVideo\products\<剧名>
node D:\AIVideo\tools\board-pad.mjs       D:\AIVideo\products\<剧名>\storyboards\第NN集-分镜.csv
```

- `--check` 是**不写盘**的预览。想确认「本可写」就用它。
- `--import` 是**单向迁移通道**：把旧的 25 列 CSV 反向读成 JSON，只补新列为空。**一个字的剧情都不改。**
- `episode-build.mjs` 的三态是 `BUILD-OK / BUILD-FAIL / BUILD-UNAVAILABLE`（后者是「跑不了」，不是通过）。
- **`duanju_gate` 四态**（`PASS / FAIL / UNAVAILABLE / CRASHED`）与退出码的完整口径，见 `script-tools` 技能。

> **不要手改产物。** 改 CSV 或 txt 而不改 JSON，下一个跑生成器的人会把你的修改覆盖掉，
> 而且在覆盖之前**没有任何东西会报错**。手改过的 CSV 还常犯「行列不齐」——
> 那要用 `board-pad.mjs` 补，它**只补空字段**，行比表头长时直接拒绝（截断会静默丢数据）。

## 三、导出成平台能导入的 xlsx

它以**官方模板为底**（解 zip → 只替换 `xl/worksheets/sheet1.xml` → 重新打包），
**删掉前两行注释**，并**回读自证**（断言第 1 行是平台表头、列数正确）。

⚠️ **它把模板目录硬编码成 `D:\AIVideo\research-youxi\templates`** —— 这是**全工作台唯一一处硬编码模板目录**，
位置是 **`tools\board-to-xlsx.mjs:30`**：

```
30: const TEMPLATE_DIR = 'D:\\AIVideo\\research-youxi\\templates'
```

**已实测（逐行读出来的，不是推断）**：**有三份文档把这个行号写成 `:29`，三份都错。**
移动那个目录会让它**读不到模板而不报错**，缺陷只在产出的 xlsx 上体现。
如果你动了 `research-youxi\`，先跑一次 `--dry-run` 确认模板读得到。

> 也就是说：**引用这一行时给 `:30`**，而且这个数字本身也要现读 —— 三份文档同时错同一格，
> 说明它是被抄的，不是被读的。

⚠️ **仍然必须由人做的一步**：导入平台后**核对平台分出的镜头数 == 本地的行数**。工具末尾就打印这句话。

## 四、素材侧的硬规则

- 参考图必须是**文件名**、必须真实存在于 `assets\` 或 `refs\`、**不得以下划线开头**
  —— 以下划线开头的文件是工具自己的产物（联络表、QC 报告），**产物不许当输入**。
- **本地文件才算数**：画布会被删，画布上的东西不是资产。
- `画面类型` 列不许写「联络表 / 拼图 / QC 报告」这类工具产物。

## 五、并发：一个剧目录同时只能有一个写者

`dsh-aivideo` 与 `dsh-duanju` 两个 preset 可能同时指向 `products\<剧名>\`。
工作区记录过这类事故（D-10「并发跑同一个文件必须先拿锁」）。后果是**一半来自这个会话、一半来自那个会话**的文件，
而且**没有任何检查会报错**。

**开工前看一眼 `manifest.json` 的 mtime**；不确定就问用户「现在是不是只有我在写这部剧」。

## 六、工作区规则层

`agent-instructions` 已把 `.git`、`AGENTS.md`、`DRAMA.md` 列为项目根标记，
候选文件是 `AGENTS.md` / `CLAUDE.md` / `DRAMA.md`。

**今天 `D:\AIVideo` 里这三个都不存在**，所以从那里起的会话**读不到任何工作区规则层** ——
本技能与 `dsh-duanju` 的其他技能就是那层规则的替代品。用户哪天建了 `D:\AIVideo\AGENTS.md` 或 `DRAMA.md`，
下一次读取就会把它带上（**不需要重启宿主**）。

## 七、这条工作区的规矩：**「读不到」不许长得像「没问题」**

本工作区反复付过这条学费，所以每个检查都在输出上区分：判完了通过 / 判完了不通过 / **判不了**。
`duanju_gate` 把这一条做成了**第四态**：`CRASHED`（脚本崩了或参数用错）与 `UNAVAILABLE`（跑不了）
是**两个不同的「没判」**，而它们都不是 `PASS`。

**你对用户报告时也要这样。** 缺文件、缺目录、依赖缺失、命令没跑 —— 说「没跑」「读不到」，
不要说「没有发现问题」。空结果集与「没问题」在读数上长得一样，而含义相反。
