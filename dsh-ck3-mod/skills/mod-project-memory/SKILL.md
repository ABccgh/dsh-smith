---
name: mod-project-memory
description: Use when recording a CK3 mod project's state, when resuming a mod rather than starting one, when a design question about the mod has just been settled, or when deciding whether a conclusion belongs in a memory file at all. Carries the layer layout, the entry formats, and the rule that game-mechanics conclusions belong to the wiki and travel as citations instead.
---

# Mod project memory

Context ends; the project does not. These layers are the memory of the work — which files
exist and why, what was decided, what the check reported — and they are kept current as the
work happens rather than at the end, because a fact held only in context is lost at
compaction, and compaction is exactly when it would have been needed.

## The four layers

Every path below is relative to the **project root** — the directory the user works in, not
the preset's own directory. Resolve it the way the workspace does: the outermost directory
holding an `AGENTS.md` or `MODDING.md` that applies, or the root of whatever the user names.

| Layer | Path | Lifetime | Contents |
| --- | --- | --- | --- |
| Rules | `MODDING.md` (auto-loaded) | durable, maintained by the user | This machine's mod paths and conventions: `D:\CK3Mods`, the all-ASCII path constraint, the two `.mod` files, the localization encoding |
| Chronicle | `docs\mod-notes\PROJECT.md` | durable, edited in place | What is currently true about this mod, each line naming its source |
| Decisions | `docs\mod-notes\DECISIONS.md` | **append-only** | One entry per settled question, with the reason and the reversal condition |
| Board | `docs\mod-notes\BOARD.md` | volatile, rewritten | The current objective, the open questions, the live expert handoffs |

`MODDING.md` is read from the **working directory tree**, not from the preset's directory — so
a copy of it placed inside the preset would never load, and would fail silently. When
`MODDING.md` is missing, that is something to tell the user, not something to fix by copying
one in.

Read order when you resume a mod rather than start one: `MODDING.md`, then `PROJECT.md`,
then `DECISIONS.md` before re-opening anything that may already be settled, then `BOARD.md`
for the objective. When you start a mod with no memory yet, seed the layers from what you
actually verified this session — an empty heading reads as maintained and is worse than no
file.

## The rule that governs the whole discipline

**A game-mechanics conclusion never enters these layers.**

What a modifier does, what an event requires, what a reform costs, how a scope resolves,
what a trigger returns — these belong to the wiki, and they travel as a citation: page URL,
revid, banner state. Writing one into `PROJECT.md` freezes one patch's answer into a file
that a later patch silently invalidates, and the memory then does the opposite of its job:
it makes the next session confidently wrong instead of merely ignorant.

So when a decision rests on a mechanic, record **the decision** and the citation beside it:

```markdown
- 把 on_action 挂在自己的 namespace 下而不是覆盖原版的 on_game_start：覆盖会与任何
  也在该 on_action 里插东西的 mod 冲突，而 `Mod compatibility` 页说明 on_action 的
  effect 块被替换时不叠加（cited: <page URL> revid=…）。取舍：多一个文件，换掉
  一个只在同时装载别的 mod 时才出现的症状。
```

The rule of thumb: if the sentence would still be true in a game with different numbers, it
belongs here. If it names a number, a scope, or a key, it belongs to the wiki and comes with
a URL or a vanilla file path.

## Entry formats

`DECISIONS.md` — append only, newest last. Never edit an entry, not even a status line; a
decision that is later overturned gets a **new** entry that says so.

```markdown
## D-<n>: <the question, as a question>
- **决定：** <the answer, in the imperative>
- **依据：** <the evidence or constraint that decided it>
- **否决：** <the alternative, and why it lost>
- **推翻条件：** <what would make this wrong — a check, a read, a changed constraint>
```

```markdown
## D-<m>: D-<n> 还成立吗？
- **决定：** 不成立 —— D-<n> 已被取代。
- **依据：** <what changed, or the check that failed>
- **否决：** keeping D-<n> because its reasoning still reads as sound
- **推翻条件：** <what would restore D-<n>>
```

`PROJECT.md` — sections, edited in place, only the ones you can fill today:

```markdown
# <mod name> — chronicle
## 这是什么              <!-- the mod in one paragraph: what it changes, for whom -->
## 文件与落点            <!-- every file, absolute path, and what the game reads it as -->
## 覆盖范围              <!-- the vanilla files/entities it overrides — its footprint -->
## 已核实的现状          <!-- each line names the source: the file, the check output, the read -->
## 采纳的专家报告        <!-- role, child id, the question, and whether you re-checked the claim -->
## 当前状态
## 已知缺口              <!-- deliberate omissions, with the reason -->
## 待复核的旧结论        <!-- anything believed but not verified this session -->
```

`BOARD.md` — rewritten freely and expected to be short:

```markdown
# Board
## 目标            <!-- one line -->
## 进行中          <!-- one line per live expert handoff: role, child id, question -->
## 开放问题        <!-- each with the check that would answer it -->
## 下一步          <!-- the immediate next action -->
```

If you keep only two of the three files, keep `PROJECT.md` and `BOARD.md`: the chronicle
carries what is true and the board carries what is next.

## Rules that keep the record trustworthy

- **Write verified facts only.** A claim enters `PROJECT.md` with the source that established
  it — a file path, a `ck3_modcheck` output, a wiki page with its revid. Without a source it
  belongs under an open question on the board.
- **Write it when you learn it**, not at the end.
- **Replace, do not contradict.** When a fact changes, revise the line rather than appending a
  correction below it — except in `DECISIONS.md`, where the record is history and is never
  rewritten.
- **Record what the check did and did not cover.** `ck3_modcheck` validates bytes on disk. A
  green report is worth recording as "the files are the shape they should be", never as "the
  mod loads", and the `path=` format is unverified on this machine — say so where it matters.
- **Never record a secret.** No tokens, no account details — a reference to where a value
  lives is the most that belongs in the record.
- **Keep each layer short.** Length is what makes a memory file stop being read, and an
  unread memory file is a cost with no benefit.

## Handing maintenance over

After a milestone or a decided question, delegate the write to `expert_chronicler` — with the
evidence, not just the conclusion: the files, the reads, the exact `ck3_modcheck` output, the
decision. A brief without evidence produces open questions instead of entries, which is the
correct outcome and not a failure.
