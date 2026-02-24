# AI-Assisted Development Workflow

This guide explains how to effectively use AI (Claude) to build features in this project.

## The 4-Phase Development Process

### Phase 1: Design 📋

**Goal**: Create a clear blueprint before writing any code.

**Steps**:

1. Start with a prompt like:

   ```
   I want to build [feature]. Let's create a design document first.
   Use the template in docs/designs/_TEMPLATE.md
   ```

2. AI will create `/docs/designs/[feature-name].md` covering:

   - Problem statement
   - Technical approach
   - Component structure
   - Data flow
   - API contracts
   - Testing strategy

3. **Review the design** - This is critical! Check:

   - Does it solve the right problem?
   - Is the approach sound?
   - Are dependencies identified?
   - Is it aligned with project architecture?

4. **Iterate** - Refine the design based on your review

**Why this matters**:

- Catches issues before code is written
- Provides a reference during implementation
- Makes AI prompts more effective (AI can reference the design)

---

### Phase 2: Planning 📝

**Goal**: Break the design into concrete, actionable tasks.

**Steps**:

1. Prompt:

   ```
   The design for [feature] is approved. Create an implementation plan.
   Break it down into a todo list following the design doc.
   ```

2. AI will create a task list with:

   - Specific implementation steps (to go into Beads)
   - Logical ordering (dependencies first)
   - Testing checkpoints

3. **Review the plan** - Ensure:
   - Tasks are small and focused
   - Order makes sense
   - Nothing is missing

---

### Phase 3: Implementation 💻

**Goal**: Write code incrementally following the approved design.

**Steps**:

1. Prompt:

   ```
   Let's implement [feature] following /docs/designs/[feature-name].md
   Start with [first component/task]
   ```

2. **Incremental Development**:

   - Implement one component/task at a time
   - Test after each step
   - Commit working code frequently
   - Reference the design doc if AI deviates

3. **Keep AI on track**:

   - "Follow the design in /docs/designs/[feature-name].md"
   - "This should match the [Component] structure we designed"
   - "Check this against our data flow diagram"

4. **Course correct** when needed:
   - If implementation reveals design issues, update the design doc first
   - Keep the design doc as the source of truth

---

### Phase 4: Review & Polish ✅

**Goal**: Ensure quality and completeness.

**Steps**:

1. Prompt:

   ```
   Let's review the [feature] implementation:
   1. Check against design doc
   2. Run type checking and linting
   3. Verify all tests pass
   4. Check for edge cases
   ```

2. **AI-Assisted Review**:

   - Compare implementation to design
   - Check for TypeScript errors
   - Review test coverage
   - Identify missing error handling

3. **Manual Review**:
   - Test user flows manually
   - Check UI on both iOS and Android
   - Verify edge cases
   - Review code quality

---

## Effective Prompting Techniques

### 1. Provide Context

**Bad**: "Add authentication"
**Good**: "Add authentication to this React Native app. We're using Expo. Reference the design in /docs/designs/auth.md"

### 2. Reference Existing Code

**Bad**: "Make it work with the navigation"
**Good**: "Integrate with the existing navigation setup in /src/navigation/AppNavigator.tsx"

### 3. Be Explicit About Constraints

**Good**: "Use TypeScript strict mode. Must work offline. Keep bundle size under 50KB."

### 4. Ask for Design First

**Bad**: "Build a user profile screen"
**Good**: "Let's design a user profile screen first. Create a design doc covering layout, data requirements, and offline support."

### 5. Request Incremental Changes

**Bad**: "Implement the entire authentication system"
**Good**: "Let's start by implementing the login form component from the auth design doc"

---

## Common Patterns

### Starting a New Feature (NX Monorepo)

```
I want to add [feature description].

Before we start, determine:
1. What library type is needed? (feature, ui, data-access, util)
2. What scope? (dailyProvisions, shared)
3. Will this require multiple libraries working together?

Then follow our workflow:
1. Create a design document in /docs/designs/[feature-name].md
2. Include:
   - Problem statement
   - Technical approach
   - Which NX libraries will be created/modified
   - Library dependencies (following PROJECT_ORGANIZATION.md rules)
   - Component structure
   - Data flow
3. Get my approval before implementing

Use the template at /docs/designs/_TEMPLATE.md
```

**NX-Specific Feature Prompts:**

```
Generate a new feature library for [feature name] in the dailyProvisions app.

Steps:
1. Create library: libs/dailyProvisions/feature-[name]
2. Add tags: "type:feature" and "scope:dailyProvisions"
3. This feature can import from ui, data-access, and util libraries
4. Create the main [FeatureName]Screen component
```

```
Create a new UI component library for [component name].

Steps:
1. Create library: libs/shared/ui-[name]
2. Add tags: "type:ui" and "scope:shared"
3. This library can ONLY import from util libraries
4. Create pure presentational components with no business logic
```

```
Set up a data-access library for [data domain].

Steps:
1. Create library: libs/dailyProvisions/data-[name]
2. Add tags: "type:data-access" and "scope:dailyProvisions"
3. This library can ONLY import from util libraries
4. Add functions for fetching, storing, and managing [data domain] data
```

### Making an Architecture Decision

```
We need to decide [decision topic].

Create an ADR in /docs/decisions/ covering:
- Context and constraints
- Options considered
- Recommendation with pros/cons

Use the template at /docs/decisions/_TEMPLATE.md
```

### Debugging an Issue

```
[Describe the issue and steps to reproduce]

Let's debug systematically:
1. Identify the likely cause
2. Check relevant code in [file path]
3. Propose a fix
4. Explain why it will work
```

### Refactoring

```
I want to refactor [component/module].

First, let's:
1. Document current behavior (create design doc if needed)
2. Identify what we want to improve
3. Plan the refactor steps
4. Ensure tests exist before changing code
```

---

## Quality Checklist

Before considering a feature "done":

- [ ] Design document exists and is up-to-date
- [ ] Implementation matches design
- [ ] TypeScript compiles with no errors
- [ ] ESLint passes
- [ ] Unit tests written and passing
- [ ] Tested on iOS and Android
- [ ] Edge cases handled
- [ ] Error states handled
- [ ] Loading states implemented
- [ ] Code reviewed (by you or team)
- [ ] Commits follow conventional commits format
- [ ] Documentation updated if needed

---

## Anti-Patterns to Avoid

### ❌ Skipping Design Phase

**Don't**: "Just build a login screen"
**Do**: "Create a design doc for the login flow first"

### ❌ Implementing Everything at Once

**Don't**: "Build the entire feature in one go"
**Do**: "Let's implement this component by component, testing as we go"

### ❌ Vague Prompts

**Don't**: "This doesn't work, fix it"
**Do**: "The user list isn't refreshing after adding a user. The issue seems to be in UserList.tsx. The state isn't updating."

### ❌ Accepting Code Without Understanding

**Don't**: Accept generated code you don't understand
**Do**: Ask "Explain how this code works and why you chose this approach"

### ❌ Ignoring Design Drift

**Don't**: Let implementation drift from design without updating docs
**Do**: Update design doc when implementation reveals better approaches

### ❌ Add extra function 'just in case'

**Don't**: Add unused code hoping it will be used in the future
**Do**: Follow the "you ain't going to need it" approach and only implement functions when they are needed

---

## Tips for Success

1. **Design documents are living documents** - Update them as you learn
2. **Commit frequently** - Small commits are easier to review and revert
3. **Test incrementally** - Don't wait until everything is built
4. **Ask "why"** - Understand AI's reasoning, don't blindly accept code
5. **Keep context** - Reference relevant files and previous decisions
6. **Use the templates** - They ensure consistency and completeness
7. **Review AI output** - AI makes mistakes, you're the final reviewer

---

## Example: Complete Feature Development (NX Monorepo)

Let's walk through building a "User Profile Edit" feature in an NX monorepo:

### 1. Design Phase

```
Prompt: "I want to add user profile editing. Let's create a design doc using
/docs/designs/_TEMPLATE.md.

The user should be able to edit their name, bio, and avatar.
Changes should save locally first and sync when online.

Include which NX libraries we'll need:
- A feature library for the profile edit screen
- Possibly a ui library for reusable components
- Possibly a data-access library for profile data management
- Any util libraries for helpers

Follow PROJECT_ORGANIZATION.md dependency rules."
```

→ AI creates `/docs/designs/user-profile-edit.md`
→ Design specifies:

- `libs/dailyProvisions/feature-profile-edit` (main feature)
- `libs/dailyProvisions/data-profile` (profile data management)
- `libs/shared/ui-avatar-picker` (reusable avatar picker)
  → You review and approve

### 2. Planning Phase

```
Prompt: "The design is approved. Create an implementation plan as a todo list.

Break it down by library:
1. Create the required NX libraries with proper tags
2. Implement data-access layer first (bottom-up)
3. Then UI components
4. Finally the feature screen that ties it together"
```

→ AI creates task breakdown organized by library
→ You review the order and dependencies
→ AI saves steps and snippets into Beads instead of Markdown for technical steps. Run \`bd quickstart\` to see how.

### 3. Implementation Phase

```
Prompt: "Let's implement user profile editing following /docs/designs/user-profile-edit.md.

Step 1: Create the data-access library

nx g @nx/react-native:lib data-profile \
  --directory=libs/dailyProvisions/data-profile \
  --tags='type:data-access,scope:dailyProvisions'

Add functions: getProfile, updateProfile, saveProfileOffline"
```

→ AI creates data-access library with functions
→ You test and commit

```
Prompt: "Step 2: Create the avatar picker UI component library

nx g @nx/react-native:lib ui-avatar-picker \
  --directory=libs/shared/ui-avatar-picker \
  --tags='type:ui,scope:shared'

This should be a pure presentational component with no data fetching."
```

→ AI creates UI library following ui restrictions (util imports only)
→ You test and commit

```
Prompt: "Step 3: Create the profile edit feature library

nx g @nx/react-native:lib feature-profile-edit \
  --directory=libs/dailyProvisions/feature-profile-edit \
  --tags='type:feature,scope:dailyProvisions'

Create ProfileEditScreen that:
- Imports from @choiganz/dailyProvisions/data-profile
- Imports from @choiganz/shared/ui-avatar-picker
- Handles the user flow and state management"
```

→ AI creates feature library that orchestrates data and UI
→ You test and commit

### 4. Review Phase

```
Prompt: "Let's review the profile edit implementation:
1. Check it matches /docs/designs/user-profile-edit.md
2. Verify library dependencies follow PROJECT_ORGANIZATION.md rules
3. Run: nx affected:lint
4. Run: nx affected:test
5. Check that each library is independently testable
6. Visualize the dependency graph: nx graph"
```

→ AI reviews and identifies gaps
→ Checks that:

- feature-profile-edit only imports from ui, data-access, util (✅)
- ui-avatar-picker only imports from util (✅)
- data-profile only imports from util (✅)
  → You fix any issues and do final manual testing
  → Feature complete!

### Key Differences from Non-NX Approach

- **Modular:** Code is split across purpose-specific libraries
- **Reusable:** Avatar picker can be used in other features
- **Testable:** Each library can be tested independently
- **Enforced:** Dependency rules prevent architectural violations
- **Efficient:** `nx affected` runs only relevant tests/builds

---

## Questions?

If you're unsure about the workflow:

1. Check this document
2. Look at existing design docs for examples
3. When in doubt, ask for a design doc first
