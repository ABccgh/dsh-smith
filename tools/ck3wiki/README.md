# `tools/ck3wiki` — 把 CK3 Wiki 镜像成 ima 知识库

把 [ck3.paradoxwikis.com](https://ck3.paradoxwikis.com/Crusader_Kings_III_Wiki)（英文 Crusader
Kings III Wiki，MediaWiki 1.39.4）的**全部面向读者的页面**抓成一个带出处与修订号的本地
Markdown 语料，再通过 URL 导入写进腾讯 ima 知识库。

本目录里的每一处"必须这样写"都有实测依据，注释里写明了**是什么实验**得出的；不要凭直觉
把它"简化"回去，下面每条都对应过一个真实失败。

## 先看这一节：三条会让人白干的实测事实

1. **站点用指纹拦截机器人，且判定是间歇性的。** `ck3.paradoxwikis.com` 的任何路径（包括
   `/api.php`、`/rest.php`、`index.php?action=raw`）都可能返回 HTTP 200 + 一张约 3 KB 的
   Fastly "Client Challenge" 页。放行条件实测为 **浏览器样式的 User-Agent + 请求里存在
   `Accept-Language`**：

   | 请求 | 结果 |
   | --- | --- |
   | Chrome UA + `Accept-Language: en-US,en;q=0.9` | 真实 JSON（5/5 与 4/4 重复实验） |
   | 同样的头，去掉 `Accept-Language` | 挑战页 |
   | curl 自带 UA + `Accept-Language` | 挑战页 |
   | `python-requests/2.31` + `Accept-Language` | 挑战页 |
   | `Accept-Language: *` | 真实 JSON |
   | **Node 26 `fetch`（undici）带齐上述两个头** | **挑战页** |

   所以本目录的 HTTP 传输层是 **`curl.exe`**，由 Node 以管道方式驱动——不是图方便，而是
   undici 拿不到内容。HTTP/1.1 与 HTTP/2 没有差别。**因为判定是间歇性的，每个响应都要检查
   是不是 HTML，然后退避重试**（`lib/http.mjs`）。

2. **`action=parse` 不跟随重定向。** 本站 1900 个 ns0 页面里有 **1470 个是重定向**，只有
   **430 个是真实条目页**。直接抓 1900 个会得到 1470 个几百字节的重定向残页当作"内容"。
   `extract.mjs` 先用 `list=allpages&apfilterredir=redirects` 取全部重定向，再用
   `redirects=1` 的 `query.redirects` 数组（`{from,to}`）建立别名映射——**读
   `query.pages[].redirects` 会得到空结果**，这一点踩过一次：日志打印"0 redirects resolve to
   0 targets"却毫无报错。别名会写进每个文件的正文头部，好让旧标题仍能被检索命中。

3. **ima 开放接口没有删除能力。** 网页导入是**就地更新**（同一 URL 重复导入返回**逐字节
   相同**的 media_id，条目数不变：两次导入 13 → 13 条），所以重跑即刷新；而**文件上传没有
   upsert**，每次都是新的永久条目。这就是本流程**用 URL 导入写库、用 Markdown 做本地镜像**
   的原因，也是"最新"这一要求能成立的唯一机制。

## 工作流

```
node extract.mjs --concurrency 6        # 抓取 → data/out/**/*.md + data/manifest.json
node verify-convert.mjs --checkall      # 语料审计（在抓取结果上再跑一遍）
node falsify.mjs                        # 转换器的合成回归测试（必须 0 失败）
node ingest.mjs --list                  # 生成 data/import-urls.json
# 然后在 DSH 会话里调用 ima_import_urls（见下）
```

### 1. `extract.mjs` — 抓取

按命名空间分区，全部平铺在知识库根目录（ima 无法通过接口建文件夹，所以用文件名前缀分区）：

| 分区 | 命名空间 | 数量 |
| --- | --- | --- |
| `00_Articles` | ns0 非重定向 | 430 |
| `10_Project` | ns4（CK3 Wiki:） | 4 |
| `20_Modules` | ns828 | 12 |
| `30_MediaWiki` | ns8（界面文案） | 20 |
| `40_Templates` | ns10 | 254 |
| `50_Categories` | ns14 | 202 |

每个 `.md` 的头部是**出处块**：源 URL、`revid`、wiki 修订时间、抓取时间、表格/链接计数、
`{{Version|…}}` 里读出的游戏版本、以及该页的**全部重定向别名**。正文里所有 wiki 内链都写成
站内绝对 URL，所以语料离开站点后仍然可导航。

**审计门是这一步的重点**，不通过的页进 `failures` 而不是 `pages`：

- Markdown 词数 ≥ 源 HTML 可见词数的 `--min-recall`（默认 10%）——抓"半页正文"是这里最隐蔽的失败；
- 标题数 ≥ 源 `<h*>` 数的 80%；
- 除故意的 `<br>`（单元格换行）与本站自己的扩展标签（如 `<model>`）外，不得残留 HTML 标签；
- 输出里不得出现哨兵字符。

### 2. `verify-convert.mjs` — 语料审计

`--fetch <标题...>` 抓取并缓存 `data/_raw/<标题>.html`；`--check` 对着缓存跑断言；
`--checkall` 跑全部缓存。断言逐条对应一种**"看起来完整、其实错了"**的失败，注释里写了它
是在哪次事故后加的。

**`--checkall` 曾经在"17 个表格里 16 个装了别的表的单元格"的正确性缺陷上打印全绿**，
所以它现在不是唯一的把关：`falsify.mjs` 是钉死该缺陷的合成回归测试。

### 3. `falsify.mjs` — 转换器的回归测试

四个合成用例，各自对应一个**已实测过**的转换器缺陷（表格游标、单元格文本重复、链接标签
吞掉后续正文、`</b>` 不闭合）。**它必须报 0 失败。** 校验办法是把 `lib/convert.mjs` 的游标
改回 `let cursor = 0` 再跑，它应当报出失败——这个"反向验证"做过，确实会失败。

### 4. `ingest.mjs` — 生成导入清单并核对

`--list` 写 `data/import-urls.json`；`--verify` 打印核对办法。**脚本自己不发任何请求**：
真正的写入交给 `dsh-ima-kb` 插件的 `ima_import_urls` 工具（凭证、限流、重试都在插件里）。

在 DSH 会话里：

```
ima_import_urls { knowledgeBaseId: "<新库 id>", urls: [ …data/import-urls.json 的 articles[].url ] }
```

然后核对（**不要只看工具返回的"成功"**）：

- `ima_kb_browse` 逐页翻完新库，条目数应等于 `manifest.counts.pages`；
- media_id 由 URL 决定（`weburl_<账号前缀>_<url 的 md5>_<目录 id>`），可与 manifest 的
  `url` 对撞做双向连接——**按标题对撞不可靠**：ima 的标题是**异步回填**的，刚导入时是原始
  URL，几分钟后才变成 `Faith - CK3 Wiki`。

## 转换器为什么长成现在这样

`lib/convert.mjs` 是手写的标签栈遍历器，不引依赖。它被重写过一次，因为**帧缓冲区**的设计
连续产出静默错误。现在的架构是：

1. **每个作用域只有一个输出缓冲。** 结构帧不持有文本。早期版本给每帧一个缓冲区、并把文本
   写进"当前帧"，结果整页正文消失——`<div>` 里的文本进了关闭时被丢弃的帧。
2. **没有收到自己结束标签的帧不得执行结构关闭动作。** MediaWiki 大量省略 `</p>`、`</li>`、
   `</td>`；在展开时执行它们，会让表格里的一个 `</div>` 把整张表清空。
3. **文本归属于最近的"捕获型"祖先，而不是栈顶。** `<h2>` 几乎总把文字包在
   `<span class="mw-headline">` 里，单元格式亦然；按栈顶归属会把标题变成普通正文。
4. **表格式的值在关闭时解析，不留标记。** 只有标题仍用一个哨兵（`## ` 必须写在文字之前）。

已知的取舍：单元格会被渲染成一个独立子文档，所以单元格内部的链接/图片标记是文字形式而
非 Markdown 链接；这是为了让"嵌套表格/列表不串到相邻单元格"成为结构性保证。

## 许可

Paradox Wikis 的内容以 **CC BY-SA 4.0** 授权，每个生成的 `.md` 头部都写明了许可与出处。
