---
name: drama-workspace
description: 本机 D:\AIVideo 工作区的契约：目录布局、tools 下每个脚本的调用命令与退出码含义、产物与源的唯一性规则、并发写锁、以及工作区里那几处硬编码路径。当要跑一个脚本、要判断读到的文件是不是权威、要新建一个剧目录、或结果与预期不符时使用。
---

# D:\AIVideo 工作区契约

## 一、布局

```
D:\AIVideo\
  products\<剧名>\              一部剧一个目录
    story.json                  集数、声明时长等系列级事实
    bible\                      characters.json / props.json / scenes.json / voices.json
    storyboards\第NN集-分镜.csv  28 列，闸门直接判的那份
    storyboards\第NN_15列_平台导入.xlsx
    script\可导入-<剧名>-全N集.txt   平台真正导入的那一份
    episodes\第NN集.json         每集一份紧凑 JSON —— **所有产的唯一源**
    assets\  refs\  shots\ out\
    评估报告-回填.json            平台评估读数（见 youxi-platform 技能第六节）
  tools\                       所有脚本
  research-youxi\templates\    三份官方 xlsx 模板
  platforms\<平台>\             投稿材料（SOURCE.md / notes.md / raw\）
  PROJECT.md  DECISIONS.md  INVENTORY.md  HANDOFF-CHECKLIST.md
```

**`.git` 在工作区根**，所以从任意子目录起的会话都能上溯到 `D:\AIVideo` 作为项目根。

## 二、唯一的源，唯一的产物

> **`episodes\第NN集.json` 是唯一源；`storyboards\*.csv` 与 `script\可导入-*.txt` 都是它的产物。**

```powershell
# 一份 JSON 源 → 28 列分镜表 + 单集正文 + 整部正文（平台导入的那份）
node D:\AIVideo\tools\episode-build.mjs --series D:\AIVideo\products\<剧名> --episode <N>
node D:\AIVideo\tools\episode-build.mjs --series D:\AIVideo\products\<剧名> --all
node D:\AIVideo\tools\episode-build.mjs --series D:\AIVideo\products\<剧名> --all --script
node D:\AIVideo\tools\episode-build.mjs --series D:\AIVideo\products\<剧名> --episode <N> --check
node D:\AIVideo\tools\episode-build.mjs --series D:\AIVideo\products\<剧名> --episode <N> --import
```

- `--check` 是**不写盘**的预览。想确认「本可写」就用它。
- `--import` 是**单向迁移通道**：把旧的 25 列 CSV 反向读成 JSON，只补新列为空。**一个字的剧情都不改。** 只在换源时用。
- 它的三态同闸门：`BUILD-OK` / `BUILD-FAIL` / `BUILD-UNAVAILABLE`（后者是「跑不了」，不是通过）。

> **不要手改产物。** 改 CSV 或 txt 而不改 JSON，下一个跑生成器的人会把你的修改覆盖掉，
> 而且在覆盖之前**没有任何东西会报错**。手改过的 CSV 还常犯「行列不齐」——
> 那要用 `board-pad.mjs` 补，它**只补空字段**，行比表头长时直接拒绝（截断会静默丢数据）。

## 三、闸门与诊断

```powershell
node D:\AIVideo\tools\script-gate.mjs --series D:\AIVideo\products\<剧名> --episode <N>
node D:\AIVideo\tools\script-gate.mjs --series D:\AIVideo\products\<剧名> --episode <N> --format json
node D:\AIVideo\tools\script-gate.mjs --series D:\AIVideo\products\<剧名> --series-check
node D:\AIVideo\tools\script-gate.mjs --series D:\AIVideo\products\<剧名> --cross-episode
node D:\AIVideo\tools\board-pad.mjs       D:\AIVideo\products\<剧名>\storyboards\第NN集-分镜.csv
node D:\AIVideo\tools\diagnose-board.mjs  <csv>
node D:\AIVideo\tools\hook-audit.mjs      --series D:\AIVideo\products\<剧名>
node D:\AIVideo\tools\asset-manifest.mjs  --series D:\AIVideo\products\<剧名> --check
node D:\AIVideo\tools\quota-check.mjs     --series D:\AIVideo\products\<剧名>
```

三态纪律与退出码（`0` 全通过 / `1` 用法或输入错 / `2` 有 `FAIL` / `3` 有 `UNAVAILABLE`；
**没有 `4`** —— 头注释声称的那个「运行期异常」永远发不出来，异常冒泡成 `1`）
见 `script-delivery` 技能第三节。**`UNAVAILABLE` 不是通过。**

## 四、导出成平台能导入的 xlsx

```powershell
node D:\AIVideo\tools\board-to-xlsx.mjs --series D:\AIVideo\products\<剧名> --episode <N> --dry-run
node D:\AIVideo\tools\board-to-xlsx.mjs --series D:\AIVideo\products\<剧名> --episode <N>
node D:\AIVideo\tools\verify-xlsx-external.mjs <xlsx>       # 用另一个 zip 读取器独立复核
```

它以**官方模板为底**（解 zip → 只替换 `xl/worksheets/sheet1.xml` → 重新打包），
**删掉前两行注释**，并**回读自证**（断言第 1 行是平台表头、列数正确）。

⚠️ **它把模板目录硬编码成 `D:\AIVideo\research-youxi\templates`**（`board-to-xlsx.mjs:30`）。
移动那个目录会让它**读不到模板而不报错**，缺陷只在产出的 xlsx 上体现。
如果你动了 `research-youxi\`，先跑一次 `--dry-run` 确认模板读得到。

⚠️ **仍然必须由人做的一步**：导入平台后**核对平台分出的镜头数 == 本地的行数**。工具末尾就打印这句话。

## 五、素材侧的硬规则

- 参考图必须是**文件名**、必须真实存在于 `assets\` 或 `refs\`、**不得以下划线开头**
  —— 以下划线开头的文件是工具自己的产物（联络表、QC 报告），**产物不许当输入**。
- **本地文件才算数**：画布会被删，画布上的东西不是资产。
- `画面类型` 列不许写「联络表 / 拼图 / QC 报告」这类工具产物。

## 六、并发：一个剧目录同时只能有一个写者

`dsh-aivideo` 与 `dsh-duanju` 两个 preset 可能同时指向 `products\<剧名>\`。
工作区记录过这类事故（D-10「并发跑同一个文件必须先拿锁」）。后果是**一半来自这个会话、一半来自那个会话**的文件，
而且**没有任何检查会报错**。

**开工前看一眼 `manifest.json` 的 mtime**；不确定就问用户「现在是不是只有我在写这部剧」。

## 七、工作区规则层

`agent-instructions` 已把 `.git`、`AGENTS.md`、`DRAMA.md` 列为项目根标记，
候选文件是 `AGENTS.md` / `CLAUDE.md` / `DRAMA.md`。

**今天 `D:\AIVideo` 里这三个都不存在**，所以从那里起的会话**读不到任何工作区规则层** ——
本技能与 `dsh-duanju` 的其他技能就是那层规则的替代品。用户哪天建了 `D:\AIVideo\AGENTS.md` 或 `DRAMA.md`，
下一次读取就会把它带上（**不需要重启宿主**）。

## 八、这条工作区的规矩：**「读不到」不许长得像「没问题」**

本工作区反复付过这条学费，所以每个脚本都在输出上区分三态：
判完了通过 / 判完了不通过 / **判不了**。脚本对 `UNAVAILABLE` 一律非零退出。

**你对用户报告时也要这样。** 缺文件、缺目录、依赖缺失、命令没跑 —— 说「没跑」「读不到」，
不要说「没有发现问题」。空结果集与「没问题」在读数上长得一样，而含义相反。
