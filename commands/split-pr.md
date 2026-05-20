---
description: Analyze a large PR and split it into smaller, dependency-aware PRs. SUGGEST mode produces an actionable plan; DRAFT mode creates the branches locally. Doesn't open PRs (Mode 3 deferred).
argument-hint: <PR url, PR number, or branch name> [--draft] [--max-files=N] [--base=<branch>]
model: opus
---

# Split a large PR into smaller dependency-aware PRs

Large PRs are slow to review and easy to merge with bugs. This command
analyzes a PR, identifies logical groupings, computes import-based
dependencies between them, and produces a concrete split plan.

Two modes:
- **SUGGEST (default)** — analysis only. Outputs a split plan, a
  reviewable shell script, and draft PR descriptions. No side effects.
- **DRAFT (`--draft`)** — runs SUGGEST first, then creates the actual
  git branches locally (one per bucket). Does NOT open PRs.

Mode 3 (auto-open PRs) is deferred. Once you have the draft branches,
opening PRs is a `gh pr create` away.

**Response format:** one short sentence on what was done, the next
concrete action, terse.

## Mode picker (front door for empty invocations)

### Front door A — picker fires by default

**Trigger:**
- `$ARGUMENTS` is empty, OR
- `$ARGUMENTS` contains only a PR identifier with no `--*` flag

Use `AskUserQuestion`:

```
question: "What do you want to do with this PR?"
header: "Split mode"
multiSelect: false
options:
  - label: "Suggest splits (analysis only, no changes)"
    description: "Analyze the PR's files, dependencies, and patterns.
                  Output a split plan + a reviewable shell script you
                  can run yourself. Zero side effects. Recommended
                  first run."
  - label: "Draft splits (create branches locally)"
    description: "Run the analysis, then create N git branches locally
                  — one per bucket. Does NOT open PRs. You can review
                  each branch and open PRs manually via gh pr create
                  when ready."
  - label: "Show verbose help"
    description: "Print the full flag reference and edge-case behavior."
```

If `$ARGUMENTS` has no PR yet, prompt: `"PR? (URL, number, or branch
name — e.g. 471 or feat/CAT-494-foo)"`.

Map the choice + PR to:
- Suggest → `/devkit:split-pr <PR>`
- Draft   → `/devkit:split-pr <PR> --draft`
- Help    → print the verbose section below + STOP

### Skip the front door

When any `--*` flag is provided in `$ARGUMENTS`, the picker is skipped.

## Input

PR identifier: `$ARGUMENTS`

Accept: GitHub PR URL, PR number (resolve via current repo's origin),
or branch name (`gh pr list --head <branch>`).

Flags:
- `--draft` — create the branches locally after analysis (Mode 2)
- `--max-files=<N>` — override the per-bucket cap (default 25 files)
- `--base=<branch>` — base branch for the new splits
  (default: the original PR's base branch)
- `--include-tests-with-source` — pair test files with their source
  file's bucket (default: tests group together by directory)
- `--push` — push the new branches to origin after creating
  (DRAFT mode only)

(Empty `$ARGUMENTS` is handled by the picker above.)

## Context Loading

Read available context BEFORE doing anything:
1. `CLAUDE.md` in the repo root
2. `.claude/codebase/*.md`
3. `tsconfig.json` / `babel.config.js` for import alias resolution

## Phase A — Fetch the PR + files

```bash
# 1. PR metadata + state
gh api repos/<owner>/<repo>/pulls/<num> \
  --jq '{number, title, body, state, author: .user.login,
         head_sha: .head.sha, base_ref: .base.ref,
         head_ref: .head.ref}' \
  > /tmp/pr-meta.json

# Halt if state is "merged" or "closed".
# Halt if `gh auth status` fails.
# Determine the actual base branch (e.g., "develop", "main").

# 2. Per-file patches
gh api repos/<owner>/<repo>/pulls/<num>/files --paginate \
  > /tmp/pr-files.json

# 3. Verify the local working tree
#    - Must be on the PR's head branch (or have it as a remote ref)
#    - Working tree must be clean (git status --porcelain returns empty)
#    - If not, halt with the issue
```

**Filter the file list** (same exclusions as pr-review:post-review):
- `*.lock`, `package-lock.json`, etc.
- `**/node_modules/**`, `**/vendor/**`, `**/Pods/**`, `**/build/**`, `**/dist/**`
- `**/generated/**`, `**/__generated__/**`, `*.generated.*`
- `*.min.js`, `*.min.css`, `*.map`

Lock files and generated files are NOT split — they stay in their
"natural" bucket (typically root or the package that owns them) and
get pulled into whichever bucket touches them most.

## Phase B — Build the import dependency graph

For each in-PR file, parse `import` / `require` statements and resolve
each one to a file path. Build an adjacency map:
`{ file_a: [file_b, file_c, ...] }` — meaning A depends on B and C.

```python
def build_import_graph(pr_files, tsconfig_paths, package_root):
    """
    Returns dict: { filename: [list_of_files_it_imports_from_within_PR] }

    Imports OUTSIDE the PR scope are ignored — they're stable and
    don't create cross-bucket coupling.
    """
    import re, os
    pr_paths = {f['filename'] for f in pr_files}
    graph = {}

    # Patterns to extract imports
    import_patterns = [
        r'^\s*import\s+(?:[\w*{}\s,]+\s+from\s+)?[\'"]([^\'"]+)[\'"]',
        r'\bimport\s*\(\s*[\'"]([^\'"]+)[\'"]\s*\)',
        r'\brequire\s*\(\s*[\'"]([^\'"]+)[\'"]\s*\)',
    ]

    for f in pr_files:
        fname = f['filename']
        if not fname.endswith(('.ts', '.tsx', '.js', '.jsx', '.mjs')):
            graph[fname] = []
            continue

        # Need the current file content — fetch via gh api or read locally
        content = read_file_at_head(fname)
        if not content:
            graph[fname] = []
            continue

        deps = []
        for pat in import_patterns:
            for m in re.finditer(pat, content, re.MULTILINE):
                spec = m.group(1)
                resolved = resolve_import(spec, fname, tsconfig_paths)
                if resolved and resolved in pr_paths:
                    deps.append(resolved)
        graph[fname] = sorted(set(deps))

    return graph

def resolve_import(spec, importing_file, tsconfig_paths):
    """Resolve an import specifier to a repo-relative file path.

    Returns None if it can't be resolved or is external.

    spec examples:
      './foo'           → resolve relative
      '../bar/baz'      → resolve relative
      '@alias/foo'      → look up alias in tsconfig_paths
      'react-native'    → external, return None
    """
    if spec.startswith(('./', '../')):
        dir = os.path.dirname(importing_file)
        candidate = os.path.normpath(os.path.join(dir, spec))
        return find_existing_with_ext(candidate)

    # Check tsconfig path aliases
    for alias, target in tsconfig_paths.items():
        prefix = alias.rstrip('*')
        if spec.startswith(prefix):
            tail = spec[len(prefix):]
            candidate = target.rstrip('*') + tail
            return find_existing_with_ext(candidate)

    # External package — skip
    return None

def find_existing_with_ext(path):
    """Probe for .ts/.tsx/.js/.jsx/.../index.* at the path."""
    for ext in ('.ts', '.tsx', '.js', '.jsx', '.mjs'):
        if os.path.exists(path + ext):
            return path + ext
    for ext in ('.ts', '.tsx', '.js', '.jsx', '.mjs'):
        idx = os.path.join(path, 'index' + ext)
        if os.path.exists(idx):
            return idx
    return None
```

**Read `tsconfig.json`** to extract path aliases:
```bash
jq '.compilerOptions.paths // {}' tsconfig.json > /tmp/ts-paths.json
```

If no tsconfig, fall back to checking `babel.config.js` for
`babel-plugin-module-resolver` aliases.

## Phase C — Bucket files (dependency-aware refinement)

Start with the v1.5.3 path-based bucketing (already proven). Then
refine using the import graph:

```python
def bucket_files_with_deps(files, graph, max_files=25):
    """
    Returns [{bucket_id, files, deps_on_buckets, deps_from_buckets}].

    Refinement rules:
      1. Start with path-based buckets (same as pr-review:post-review)
      2. Compute cross-bucket dependencies via the import graph
      3. If two buckets have heavy mutual deps (>5 edges in both
         directions), MERGE them into one bucket
      4. If a bucket has >max_files items, try to split it along
         dependency cliques
      5. Special: tests pair with their source file's bucket if
         --include-tests-with-source is set
    """
    # Step 1: initial path buckets (from v1.5.3 logic)
    buckets = path_bucket(files)

    # Step 2: build bucket-level dep graph
    file_to_bucket = {}
    for b in buckets:
        for f in b['files']:
            file_to_bucket[f['filename']] = b['id']

    cross_edges = {}  # (bucket_a, bucket_b) -> count
    for src_file, dep_files in graph.items():
        src_bucket = file_to_bucket.get(src_file)
        if not src_bucket:
            continue
        for dep_file in dep_files:
            dep_bucket = file_to_bucket.get(dep_file)
            if not dep_bucket or dep_bucket == src_bucket:
                continue
            key = (src_bucket, dep_bucket)
            cross_edges[key] = cross_edges.get(key, 0) + 1

    # Step 3: merge tightly-coupled buckets
    tight_pairs = [(a, b) for (a, b), n in cross_edges.items() if n >= 5]
    # Bidirectional check: a→b AND b→a
    for a, b in tight_pairs:
        if cross_edges.get((b, a), 0) >= 5:
            merge_buckets(buckets, a, b)
            # rebuild file_to_bucket + cross_edges
            ...

    # Step 4: split oversized buckets along dep cliques
    for b in list(buckets):
        if len(b['files']) > max_files:
            sub_buckets = clique_split(b, graph, max_files)
            buckets.remove(b)
            buckets.extend(sub_buckets)

    # Step 5: re-compute final cross-bucket deps for output
    return assign_deps(buckets, graph)
```

**Output:** a list of buckets with:
- `id`: e.g., "A", "B", "C", ...
- `name`: descriptive label (derived from common path prefix)
- `files`: list of file objects
- `deps_on`: list of bucket IDs this bucket depends on
- `deps_from`: list of bucket IDs that depend on this bucket

## Phase D — Compute merge order (topological sort)

Sort buckets so dependencies merge first:

```python
def topological_sort(buckets):
    """
    Returns merge-order tiers — buckets in the same tier can be merged
    in parallel; later tiers depend on earlier ones.

    Returns [[bucket, bucket, ...], [bucket, ...], ...]
    """
    remaining = {b['id']: set(b['deps_on']) for b in buckets}
    by_id = {b['id']: b for b in buckets}
    tiers = []

    while remaining:
        # Find buckets with no remaining deps — they're ready to merge
        ready = [bid for bid, deps in remaining.items() if not deps]
        if not ready:
            # Cycle detected — surface to user, fall back to all-parallel
            # WARNING: log the cycle
            ready = list(remaining.keys())
        tier = [by_id[bid] for bid in ready]
        tiers.append(tier)

        # Remove ready buckets; clear them from others' deps
        for bid in ready:
            del remaining[bid]
        for deps in remaining.values():
            deps.difference_update(ready)

    return tiers
```

If a CYCLE is detected (A depends on B AND B depends on A indirectly),
emit a warning and treat the involved buckets as "must merge together
or break the cycle manually."

## Phase E — Generate the split script

Build a reviewable shell script at `/tmp/split-<pr>-script.sh`:

```bash
#!/bin/bash
# Generated by /devkit:split-pr for PR #<num>
# Original branch: <head_ref>
# Base for splits: <base_ref>
# Generated: <timestamp>
#
# This script creates N new branches, one per bucket. It does NOT open PRs.
# Review the file list per bucket before running.
#
# Safety:
#   - Aborts on any error (set -e)
#   - Confirms each branch creation
#   - All new branches in the split/<pr>/ namespace for easy cleanup
#
# To run:  bash /tmp/split-<pr>-script.sh
# To undo: git branch -D $(git branch | grep '^split/<pr>/')

set -euo pipefail

ORIGINAL_BRANCH="<head_ref>"
BASE_BRANCH="<base_ref>"
PR_NUMBER=<num>
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Verify working tree clean
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ Working tree not clean. Commit or stash first."
  exit 1
fi

# Fetch the latest base
git fetch origin "$BASE_BRANCH"

# Bucket A — <bucket A name> (<count> files)
echo "─── Bucket A: <name> ───"
git checkout -b "split/$PR_NUMBER/a-<slug>" "origin/$BASE_BRANCH"
git checkout "$ORIGINAL_BRANCH" -- \
  <file1> \
  <file2> \
  ...
git add -A
git commit -m "CAT-XXX: <bucket A title>

Split from PR #<num>. Contains <count> files in <area>.
<one-line scope summary>"
echo "✅ Branch split/$PR_NUMBER/a-<slug> created"

# Bucket B — <bucket B name> (...)
# ... same structure ...

# Bucket C — <bucket C name>, stacked on Bucket A
# (its base is Bucket A's branch, not develop)
git checkout -b "split/$PR_NUMBER/c-<slug>" "split/$PR_NUMBER/a-<slug>"
git checkout "$ORIGINAL_BRANCH" -- \
  ...

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ Created N branches under split/$PR_NUMBER/"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Inspect each branch:  git log split/$PR_NUMBER/a-...  --stat"
echo "  2. Push to origin:        git push origin split/$PR_NUMBER/..."
echo "  3. Open PRs in dependency order — Tier 1 first, then 2, etc."
echo "  4. Close the original PR #$PR_NUMBER once splits are open."
```

For STACKED buckets (those with `deps_on`), set the base branch to
the dependency's split branch instead of the original base.

## Phase F — Generate draft PR descriptions

For each bucket, write a markdown file at
`/tmp/split-<pr>-prs/<bucket-id>.md`:

```markdown
# <Bucket title>

> Split from PR #<num> ("<original title>") — bucket <ID>.

## Scope

<count> files: <one-paragraph description derived from path patterns>

### Files in this PR

<grouped file list — collapse repeated path prefixes>

## Dependencies

<If deps_on is non-empty:>
This PR is **stacked** on:
  - PR for bucket X — <its description>

Merge that first. Once merged, this PR's base will auto-rebase
to <base_ref>.

<If deps_on is empty:>
This PR can be merged **in parallel** with the other splits.
No dependencies.

## Test plan

<Per-bucket-type test plan suggestions>:
  - tests/__mocks__ → "Verify the smoke test passes:
                       `npm test -- --passWithNoTests`"
  - source code     → "Verify the unit tests for the touched code
                       still pass: `npm test <touched-area>`"
  - docs/specs      → "No automated test. Review the markdown."

## Why split this off

<one paragraph: what this bucket contains, why it's a coherent unit>

---

This PR was created as part of an automated split of #<num> via
/devkit:split-pr.
```

## Mode behavior

### Mode 1 — SUGGEST (default)

Run Phases A → F. Output to terminal:

```
═══════════════════════════════════════════════════════════════
📊 Split plan for PR #<num> — "<title>"
   <total_files> files across <total_buckets> buckets
═══════════════════════════════════════════════════════════════

Bucket A — <name>                  (<N> files, 0 deps)
  → Can merge first (Tier 1, parallel)
  Examples: <first 3 files>

Bucket B — <name>                  (<N> files, deps: A)
  → Merges after A (Tier 2)
  Examples: ...

...

Merge order:
  Tier 1 (parallel):  A, D, E
  Tier 2 (after T1):  B (→A), F (→E)
  Tier 3 (after T2):  C (→B)

Generated files:
  Script:           /tmp/split-<num>-script.sh
  Descriptions:     /tmp/split-<num>-prs/{a,b,c,...}.md

Next steps:
  1. Review the script + descriptions
  2. Run the script:           bash /tmp/split-<num>-script.sh
     OR run this command with --draft to do that automatically
  3. Open PRs in tier order via `gh pr create`
  4. Close the original PR once all splits are open
```

STOP. No side effects so far.

### Mode 2 — DRAFT (`--draft`)

Run Phases A → F (same as SUGGEST), then:

1. **Show the plan + ask for confirmation:**

   ```
   About to create <N> new branches:

     split/<pr>/a-<slug>   (<N> files)
     split/<pr>/b-<slug>   (<N> files)
     ...

   Original branch (<head_ref>) will NOT be touched.
   Working tree must be clean (verified).
   No PRs will be opened — just the branches.

   Proceed? (y / n / show-script)
   ```

   - `y` → execute the script
   - `n` → abort cleanly. Print: "Cancelled. No branches created."
   - `show-script` → print the script and ask again

2. **Execute the script** via `bash /tmp/split-<num>-script.sh`:
   - Capture stdout/stderr
   - If any branch creation fails:
     - Print the error
     - Print rollback hint: `git branch -D $(git branch | grep '^split/<num>/')`
     - Do NOT continue with subsequent buckets

3. **If `--push` is set**, push each created branch to origin:
   ```bash
   for branch in $(git branch | grep '^split/<num>/'); do
     git push origin "$branch"
   done
   ```

4. **Final summary:**

   ```
   ✅ Created <N> branches locally
   <if --push: ✅ Pushed all branches to origin>

   Branches:
     split/<num>/a-<slug>  ← Tier 1, no deps
     split/<num>/b-<slug>  ← Tier 2, stacked on a-<slug>
     ...

   To open PRs (manually, in tier order):

     # Tier 1 (parallel — can open in any order):
     gh pr create --base <base_ref> --head split/<num>/a-<slug> \
       --body-file /tmp/split-<num>-prs/a.md \
       --title "<auto-generated title for A>"

     # Tier 2 (after Tier 1's PR exists):
     gh pr create --base split/<num>/a-<slug> --head split/<num>/b-<slug> \
       --body-file /tmp/split-<num>-prs/b.md \
       --title "<auto-generated title for B>"

     # ... etc.

   To clean up if you change your mind:
     git branch -D $(git branch | grep '^split/<num>/')
     <if --push: git push origin --delete <each-branch>>
   ```

STOP.

## Honest limitations

```
⚠️ Dependency analysis is import-based only
   We catch file-A-imports-file-B but NOT:
   - Runtime string-based requires
   - Reflection / dynamic dispatch
   - Implicit dependencies via shared global state
   - Build-time codegen dependencies (if A's types are generated from B)
   If your PR has these, the dep graph may miss real coupling.

⚠️ Bucket naming is heuristic
   We use common path prefixes. For "what is this PR about" you'll
   often need to rewrite the auto-generated titles.

⚠️ Commit history per bucket is squashed
   We don't preserve the original commit boundaries — each split
   branch gets ONE commit containing all of that bucket's files.
   If your original PR had a careful commit story, that's lost.
   v2 candidate: --preserve-commits mode that uses git rebase -i to
   re-distribute original commits to the right buckets.

⚠️ Shared files end up in one bucket
   If util.ts is imported by 5 different buckets, it goes into the
   bucket where it's imported MOST often. The other 4 buckets become
   stacked on that one. This works but creates dep chains.

⚠️ Conflict handling is manual
   As Tier 1 PRs merge, Tier 2 PRs need rebasing. The script doesn't
   automate that — you do it via `git pull --rebase` or by
   re-creating the splits from the updated base.

⚠️ Cycles in the dep graph
   Surfaced with a warning. Treated as "merge together" — the
   buckets in the cycle get combined into one larger bucket.
   Real cycles are rare; this is usually a sign of bad code structure.

⚠️ Test files
   By default, tests group together by directory (faster to bucket).
   With --include-tests-with-source, each test goes into its source
   file's bucket. The latter creates more coherent PRs but more buckets.
```

## Edge cases

| Case | Behavior |
|---|---|
| PR has < 30 files | Halt: "PR is small enough to review as-is. Use /devkit:pr-review instead." |
| PR has only 1 logical bucket after analysis | Halt: "Cannot split — all files are in one tightly-coupled cluster." |
| Working tree not clean | Halt with the issue. Don't touch anything. |
| PR is merged / closed | Halt with the state. |
| `gh` not authenticated | Halt: "Run `gh auth login` and retry." |
| Cycle detected in dep graph | Warn, combine cycle members into one bucket |
| Some files have no resolvable imports | Treat as no deps (they go in their path-bucket) |
| --draft + branches already exist | Halt: "Branches split/<num>/* already exist. Clean up first." |
| --push + push fails | Stop, print error. Branches still exist locally. |
| Original head_ref has been force-pushed | Use the latest head SHA from /tmp/pr-meta.json — accept stale local state |
| Renamed files in the PR | Use the new filename for bucketing |
| Removed files | Include in their old-path bucket (the deletion needs to land somewhere) |

## Guardrails

- NEVER touch the original PR's branch
- NEVER force-push to anything
- NEVER open PRs — that's Mode 3 (deferred)
- ALWAYS verify the working tree is clean before creating branches
- ALWAYS use the `split/<pr>/` namespace for new branches (easy cleanup)
- ALWAYS print the rollback command in the summary
- NEVER skip the confirmation prompt unless --bulk-confirm
  (NOTE: --bulk-confirm not supported in this command — splitting
  branches is destructive enough to always confirm)
- ALWAYS validate that the dep graph is acyclic before generating
  the merge order — if cyclic, merge the cycle members into one bucket
- NEVER write to disk in SUGGEST mode

## What this command does NOT do

- Does not open GitHub PRs (Mode 3, deferred to v1.7.0)
- Does not auto-rebase split branches as upstream PRs land
- Does not preserve the original commit history per bucket
  (each bucket = one squashed commit). `--preserve-commits` is a
  future flag.
- Does not analyze runtime/dynamic dependencies — only static imports
- Does not split individual commits — only files. A commit that
  touches files across multiple buckets gets squashed into per-bucket
  commits.

## Composability

- Run before opening a PR review — if /devkit:pr-review:post-review
  reports "PR is oversized" (Phase A.6 trigger), this is the
  recommended follow-up.
- Pairs with `/devkit:pr-review:post-review` per bucket — after the
  splits exist, run pr-review on each smaller PR.
- Does NOT replace careful authoring — the best splits come from
  writing smaller PRs in the first place. This is a recovery tool
  for when that didn't happen.
