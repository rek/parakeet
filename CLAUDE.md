In all interactions and commit messages, be extremely concise and sacrifice grammar for the sake of concision.

This document provides a quick reference for using AI to build features in this NX + React Native + Expo + TypeScript project.

For detailed guides with examples and best practices, see:

- **[AI Workflow Guide](./docs/AI_WORKFLOW.md)** - Complete step-by-step development process
- **[Code Style Guide](./docs/CODE_STYLE.md)** - TypeScript and React Native standards
- **[Commit Conventions](./docs/COMMIT_CONVENTIONS.md)** - Git commit message format
- **[Project Structure](./docs/PROJECT_ORGANIZATION.md)** - Overview of where things are found

## Development Workflow Overview

We follow a 4-phase process for building features:

**1. Design Phase** → Create design doc in `/docs/designs/[feature-name].md` using the [template](./docs/designs/_TEMPLATE.md)

**2. Planning Phase** → Break down into tasks and identify dependencies

- We track work in Beads instead of Markdown. Run \`bd quickstart\` to see how.
- At the end of each plan, give me a list of unresolved questions to answer. Make the questions extremely concise and sacrifice grammar for the sake of concision.

**3. Implementation Phase** → Code incrementally following the approved design

**4. Review Phase** → Validate against design, run tests, check quality

See [AI Workflow Guide](./docs/AI_WORKFLOW.md) for detailed instructions, prompts, and examples.

## Prompt Templates

### Starting a New Feature

```
I want to build [feature name]. Let's start with a design document.

Please create a design doc in /docs/designs/[feature-name].md that includes:
- Problem statement
- Proposed solution
- Technical approach
- Which NX libraries will be created/modified (feature, ui, data-access, util)
- Library dependencies (following PROJECT_ORGANIZATION.md dependency rules)
- Component structure
- Data flow
- API contracts (if applicable)
- Testing strategy (per library)
```

### Moving to Implementation

```
The design for [feature name] is approved. Let's implement it.

Please:
1. Create a todo list based on the design, organized by library
2. Create any required NX libraries with proper tags:
   - Use type: feature, ui, data-access, or util
   - Use scope: dailyProvisions or shared
3. Implement following the structure in /docs/designs/[feature-name].md
4. Follow NX dependency rules from PROJECT_ORGANIZATION.md
5. Write TypeScript with proper typing
6. Follow React Native best practices
7. Co-locate tests with each library
```

## Quick Reference

### NX Monorepo Structure

This project uses NX monorepo architecture with strict dependency rules.

**Library Types:**

- `feature` - Smart components, business logic, user-facing features
- `ui` - Presentational components only (no business logic)
- `data-access` - API calls, state management, data fetching
- `util` - Pure functions, helpers, constants

**Library Pattern:** `libs/{scope}/{type}-{name}`

- Scope: `dailyProvisions` (app-specific) or `shared` (cross-app)
- Type: `feature`, `ui`, `data-access`, or `util`

**Apps are Shells:** `apps/` contain only routing, config, and entry points. All features belong in `libs/`.

**Dependency Rules:**

- Apps → feature only
- Feature → ui, data-access, util
- UI → util only
- Data-access → util only
- Util → nothing

**Common NX Commands:**

```bash
# Create a new library
nx g @nx/react-native:lib @dailyProvisions/feature-name \
  --directory=libs/dailyProvisions/feature-name \
  --tags="type:feature,scope:dailyProvisions"

# Run tests for changed code only
nx affected:test

# Visualize dependency graph
nx graph
```

See [Project Organization](./docs/PROJECT_ORGANIZATION.md) for complete details.

---

### Code Style

See [Code Style Guide](./docs/CODE_STYLE.md) for comprehensive standards.

**Key conventions:**

- TypeScript strict typing, avoid `any`
- Functional components with hooks
- File naming: Components (PascalCase), hooks (useXxx), utils (camelCase)
- One function per file (organize into libraries and folders)

### Commits

See [Commit Conventions](./docs/COMMIT_CONVENTIONS.md) for full specification.

**Format:** `<type>(<scope>): <subject>`

**Common types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## AI Collaboration Best Practices

1. **Always design before coding** - Create design docs for non-trivial features
2. **Be explicit** - Provide context and constraints upfront
3. **Incremental changes** - Build and test in small iterations
4. **Review AI output** - Check generated code against design and best practices
5. **Maintain history** - Keep design docs updated as implementation evolves

## Resources

- **Templates:** [Design docs](./docs/designs/_TEMPLATE.md) | [ADRs](./docs/decisions/_TEMPLATE.md)
- **Documentation:** [AI Workflow](./docs/AI_WORKFLOW.md) | [Code Style](./docs/CODE_STYLE.md) | [Commits](./docs/COMMIT_CONVENTIONS.md)
- always follow code styles: docs/CODE_STYLE.md

<!-- gitnexus:start -->
# GitNexus MCP

This project is indexed by GitNexus as **parakeet** (1206 symbols, 2594 relationships, 76 execution flows).

GitNexus provides a knowledge graph over this codebase — call chains, blast radius, execution flows, and semantic search.

## Always Start Here

For any task involving code understanding, debugging, impact analysis, or refactoring, you must:

1. **Read `gitnexus://repo/{name}/context`** — codebase overview + check index freshness
2. **Match your task to a skill below** and **read that skill file**
3. **Follow the skill's workflow and checklist**

> If step 1 warns the index is stale, run `npx gitnexus analyze` in the terminal first.

## Skills

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/refactoring/SKILL.md` |

## Tools Reference

| Tool | What it gives you |
|------|-------------------|
| `query` | Process-grouped code intelligence — execution flows related to a concept |
| `context` | 360-degree symbol view — categorized refs, processes it participates in |
| `impact` | Symbol blast radius — what breaks at depth 1/2/3 with confidence |
| `detect_changes` | Git-diff impact — what do your current changes affect |
| `rename` | Multi-file coordinated rename with confidence-tagged edits |
| `cypher` | Raw graph queries (read `gitnexus://repo/{name}/schema` first) |
| `list_repos` | Discover indexed repos |

## Resources Reference

Lightweight reads (~100-500 tokens) for navigation:

| Resource | Content |
|----------|---------|
| `gitnexus://repo/{name}/context` | Stats, staleness check |
| `gitnexus://repo/{name}/clusters` | All functional areas with cohesion scores |
| `gitnexus://repo/{name}/cluster/{clusterName}` | Area members |
| `gitnexus://repo/{name}/processes` | All execution flows |
| `gitnexus://repo/{name}/process/{processName}` | Step-by-step trace |
| `gitnexus://repo/{name}/schema` | Graph schema for Cypher |

## Graph Schema

**Nodes:** File, Function, Class, Interface, Method, Community, Process
**Edges (via CodeRelation.type):** CALLS, IMPORTS, EXTENDS, IMPLEMENTS, DEFINES, MEMBER_OF, STEP_IN_PROCESS

```cypher
MATCH (caller)-[:CodeRelation {type: 'CALLS'}]->(f:Function {name: "myFunc"})
RETURN caller.name, caller.filePath
```

<!-- gitnexus:end -->
