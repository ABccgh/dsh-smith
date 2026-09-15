---
name: ck3-mod-authoring
description: Use when writing, changing, or validating a Crusader Kings III mod — laying out a .mod file and its folder, writing script syntax, placing files in common/events/gui/history/localization, producing a localization yml, or deciding whether a mod is ready to hand over. Carries the load layout, the syntax and encoding rules, the all-ASCII path constraint, and the rule that ck3_modcheck runs before delivery.
---

# Authoring a CK3 mod

A mod is a set of files the game reads in a fixed way. Every rule below exists because
getting it wrong produces a mod that **exists on disk and does nothing** — the game does not
warn, the launcher does not complain, and the author concludes the game is broken. That
silent failure is what this skill is written against.

## Layout: the two `.mod` files

A loadable mod is a sibling pair:

```
D:\CK3Mods\<name>.mod        ← the launcher's descriptor: what the game is told to load
D:\CK3Mods\<name>\           ← the mod's own folder, of the same name
D:\CK3Mods\<name>\descriptor.mod   ← the descriptor INSIDE the folder: what the mod is
```

Both `.mod` files are real and both matter. The outer one is what the launcher reads; the
inner one is what the game sees when it loads the mod. A mod with only the outer file, or
with the two disagreeing about version or supported game version, is the defect that
producing "a mod that installed but does not appear to do anything".

The outer `.mod` carries at minimum:

```
version="1.0.0"
tags={ "Gameplay" }
name="<name>"
supported_version="1.19.*"
path="mod/<name>"
```

## Paths: ASCII only, and this is measured rather than preferred

Every path the game resolves for a mod must be **all-ASCII**. The Windows account on this
machine contains non-ASCII characters, so a mod placed under the user profile — the default
place a modding tool reaches for — lands under a path the game cannot resolve, and fails
silently. **Mods live under `D:\CK3Mods`. Never place one under a profile path, and never
under a directory whose name contains a non-ASCII character.**

When you write a path into a descriptor, a config, or an instruction, read it back and check
it is ASCII before you deliver; this is the one mistake in this document that no amount of
in-game testing surfaces as a clear error.

## Script syntax

Script files (`.txt` under `common\`, `events\`, `history\` and friends) use one consistent
shape:

```
# a comment runs to end of line

key = value                 # a scalar
key = "quoted string"       # a string, quoted when it contains spaces or is a name
key = {                     # a block
    nested = value
    list = { a b c }        # a collection: entries separated by whitespace
    other = { 1 2 3 }
}
```

Three rules that account for most script errors:

- **Indentation is presentation, not structure.** The game parses braces and whitespace, not
  nesting-by-column. Align anyway — a file a human cannot read is a file a human cannot fix.
- **`key = value` needs the spaces around `=`.** `key=value` is not the same token stream in
  every CK3 script context, and the wiki's own examples write it spaced.
- **A block that never closes swallows the rest of the file.** When a mod "does nothing",
  count the braces before you change any value.

## Where files go

| Directory | What belongs there |
| --- | --- |
| `common\` | Definitions: governments, laws, casus belli, men-at-arms, religions, cultures, decisions, on_actions |
| `events\` | Events and their `namespace` declarations |
| `gui\` | Interface definitions |
| `history\` | Starting state: characters, titles, provinces |
| `localization\english\` | Text keys, one `.yml` file per group |

A file in the wrong directory is a file the game never reads. When a mod's effect does not
appear, check placement before you check the content.

## Localization format

`localization\english\<name>_l_english.yml`, saved as **UTF-8 with BOM**:

```
l_english:
 KEY:0 "The text the player sees."
 ANOTHER_KEY:0 "Another line."
```

Four things are load-bearing and all four are easy to get wrong:

- **UTF-8 with BOM.** A file saved as UTF-8 without the BOM is read as the wrong encoding and
  the entries do not load. This is invisible in most editors — check the bytes, not the
  appearance.
- **`l_english:` is the first line**, with the trailing colon, and it is the file's language
  header. One header per file.
- **One entry per line as `KEY:0 "text"`.** The key must match exactly what the script
  references; a typo produces an untranslated key shown raw in the interface.
- **The number is a version marker, not decoration.** `0` means the entry is current. A
  **non-zero** number marks the entry as needing retranslation, so writing `0` on a string
  you changed is how a stale translation survives with nobody noticing. When you change text
  that was already translated, that is a deliberate decision — make it deliberately.

## `ck3_modcheck` runs before delivery

**`ck3_modcheck` must be run on every mod you wrote or changed, before you hand it over.**
It checks the load layout, the descriptor contents, the ASCII path constraint, and the
localization BOM and key format — the four classes of defect above that the game reports
either silently or not at all.

Its output belongs in your report **verbatim** — the exact command and what it printed — and
so does what it did not check. Three honest outcomes, and only three:

1. it ran and passed: report the command and the output;
2. it ran and failed: report the failure and fix it, or report it unfixed;
3. it could not run: say that the mod is **unchecked**, in those words, and say what that
   leaves unverified.

A mod you did not check is not delivered. Presenting an unchecked mod as working is the
failure this rule exists to prevent, and "it should load" is not a check result.

## Before you call it done

Run the checks in this order, because each one assumes the last:

1. Both `.mod` files exist, agree, and name a path under `D:\CK3Mods`.
2. Every path in the mod is ASCII.
3. Every script block closes; every `localization` file is UTF-8 **with** BOM and opens with
   `l_english:`.
4. `ck3_modcheck` on the mod root.
5. Only then, in game.

Steps 1–4 are what the tooling can prove. Step 5 is what the game proves, and its result —
what actually appeared in the interface, or what did not — is what your report should say.
