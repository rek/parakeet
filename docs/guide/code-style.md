# Code Style Guide

## Quick Reference

The 16 rules that matter most — read this, then consult the full guide only as needed.

1. **Zero feature knowledge in screens** — `app/` screens must never contain feature-specific logic, styles, routing, or flag checks for optional features. Export a self-contained component from the module (e.g., `<VideoEntryButton>`) that handles its own feature flag gate, routing, and styles. The screen renders it with props (IDs, data) and nothing else. Removing a feature = delete the module + remove 1 import and 1 render line per screen.
2. **Single-arg objects** — `function foo({ a, b }: { a: string; b: number })`, not multiple args
2. **No explicit return types** — let TypeScript infer; never write `: Promise<Foo>`
3. **Derive types from implementations** — `Awaited<ReturnType<typeof fn>>`, `ComponentProps<typeof Comp>`
4. **No `any`** — use `unknown`, or narrow the type
5. **`as const`** for constant objects/arrays; derive union types from them
6. **Import order**: React/RN → third-party → `@modules/*` → `@platform/*` → `@shared/*` → local
7. **Module imports** — `@modules/<feature>`, never deep paths like `@modules/session/application/...`
8. **Hook return shape** — `{ data, isLoading, error }` (object, not positional array)
9. **File naming** — `PascalCase.tsx` for components, `camelCase.ts` for everything else, `use*.ts` for hooks
10. **Test with Vitest** — not Jest; run with `nx run <package>:test`
11. **No new legacy folders** — no new `lib/`, `services/`, `hooks/`, `utils/` at top-level in `src/`
12. **Module boundary** — validate with `npm run check:boundaries` after structural changes
13. **Prefer `modules/<feature>/` for new business code** — infra goes in `platform/`, cross-feature in `shared/`
14. **`FlatList` over `ScrollView`** for lists; use `keyExtractor` + `getItemLayout`
15. **Accessibility** — add `accessible`, `accessibilityLabel`, `accessibilityRole` to interactive elements
16. **Barrel exports = public API** — a module's `index.ts` exports only what external consumers need: hooks, UI components, pure functions, and types. Never export raw repository functions (`insertX`, `getX`, `deleteX`) — those are internal implementation details consumed by the module's own hooks. If an external consumer needs data, it uses a hook.

---

## TypeScript

### General Principles

- Use strict typing throughout the codebase
- Avoid `any` - use `unknown` if type is truly unknown
- Prefer type inference when the type is obvious

### Examples

**✅ Good**

Each function file follows this pattern:

```typescript
import { Dependencies } from 'packages';

/**
 * Summarise function in one line
 *
 * Explain why/how it is used
 *
 */
export function ComponentName({ param1, param2 }: { param1: string; param2: boolean }) {
  // Implementation
}
```

NOTE: used an object as the first argument, instead of multiple arguments. AKA: prefer single arity functions

```typescript
function updateProfile(profile: { id: string; name: string; email: string; avatarUrl?: string }): Promise<void> {
  // Implementation
}
```

**❌ Bad**

```typescript
function updateProfile(profile: any) {
  // Don't use any
}
```

### Type Organization

Use TypeScript's type inference utilities instead of creating separate type definitions. This keeps types co-located with their implementation and avoids duplication.

**✅ ALWAYS USE THESE PATTERNS:**

```typescript
// For function return types - use Awaited<ReturnType<>>
export async function getNotificationSettings() {
  return {
    enabled: true,
    time: '08:00',
    timezone: 'America/New_York',
  };
}

// Get the type from the function itself
type NotificationSettings = Awaited<ReturnType<typeof getNotificationSettings>>;
```

```typescript
// For component props - use ComponentProps or Parameters
export function MyComponent({ title, onPress }: { title: string; onPress: () => void }) {
  // Implementation
}

// Get props type from the component
type MyComponentProps = ComponentProps<typeof MyComponent>;
// OR
type MyComponentProps = Parameters<typeof MyComponent>[0];
```

```typescript
// For constants - use 'as const' and typeof
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'ne', name: 'Nepali' },
] as const;

// Derive types from the constant
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];
```

**DO NOT add explicit return types to functions** - let TypeScript infer them:

```typescript
// ✅ Good - return type inferred
export async function fetchUser(id: string) {
  return { id, name: 'John', email: 'john@example.com' };
}

// ❌ Bad - explicit return type
export async function fetchUser(id: string): Promise<User> {
  return { id, name: 'John', email: 'john@example.com' };
}
```

## React Native Components

### Component Structure

```typescript
// ComponentName.tsx
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

// Prefer function style with props inline
export function ComponentName({
  title,
  onPress,
  children,
}: {
  title: string;
  onPress: () => void;
}) {
  // Hooks at the top
  const [state, setState] = React.useState(false);

  // Event handlers
  const handlePress = () => {
    setState(true);
    onPress?.();
  };

  // Early returns for conditional rendering
  if (!title) {
    return null;
  }

  // Main render
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});
```

---

## Hooks

### Data Fetching Hooks

Server state is managed by React Query, not manual `useState`/`useEffect`. See [react-query-patterns.md](./react-query-patterns.md) for the full reference.

**Query definitions** live in `modules/*/data/*.queries.ts` using `queryOptions`:

```typescript
// modules/program/data/program.queries.ts
import { queryOptions, skipToken } from '@tanstack/react-query'
import { getActiveProgram } from '../application/program.service'

export const programQueries = {
  all:    () => ['program'] as const,
  active: (userId: string | undefined) => queryOptions({
    queryKey: [...programQueries.all(), 'active', userId] as const,
    queryFn:  userId ? () => getActiveProgram(userId) : skipToken,
  }),
}
```

**Hooks** wrap `queryOptions` only when they add real logic (auth, aggregation, config):

```typescript
// modules/program/hooks/useActiveProgram.ts
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@modules/auth'
import { programQueries } from '../data/program.queries'

export function useActiveProgram() {
  const { user } = useAuth()
  return useQuery(programQueries.active(user?.id))
}
```

**Mutations** use `useMutation` with invalidation:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileQueries.all() })
    },
  })
}
```

**When to skip the hook**: if it would just be `useQuery(someQueries.detail(id))` with no extras, call `queryOptions` directly from the component.

---

## App Architecture Organization

See [Project Organization](./project-organization.md) for canonical boundaries.

High-level rule:

- `app/` composes and routes
- `modules/` owns feature behavior
- `platform/` owns infra/runtime
- `shared/` owns reusable cross-feature code

### Where Code Goes

Use these placement rules:

- Feature/domain behavior: `apps/parakeet/src/modules/<feature>/...`
- Infrastructure/runtime concerns: `apps/parakeet/src/platform/...`
- Cross-feature reusable code: `apps/parakeet/src/shared/...`

Add to existing module folders before creating new top-level folders.

### No Business Logic in Components

React components (`app/`, `components/`) should only contain: state, thin event handlers, and JSX. Extract these to module `utils/` or `lib/` (or `training-engine` if pure domain math):

- **Domain calculations** — block derivation, phase mapping, severity inference, weight rounding
- **Data transformations** — draft→overrides, chart data building, session partitioning
- **Domain constants** — thresholds, presets, numeric mappings (e.g., `SORENESS_NUMERIC`)
- **Presentation constants shared across 3+ files** — color/label/icon mappings go in `modules/<feature>/ui/`

Red flags in component code: complex ternaries encoding domain rules, filter/map chains on domain data, hardcoded domain constants, duplicated presentation constants.

---

## File Organization

### File Naming

The file name should always be the same name as the single named export within.

- **Components**: `PascalCase.tsx` (e.g., `UserProfile.tsx`)
- **Hooks**: `camelCase.ts` with `use` prefix (e.g., `useAuth.ts`)
- **Utils**: `camelCase.ts` (e.g., `formatDate.ts`)
- **Tests**: `*.test.tsx` or `*.test.ts`
- **Stories**: `*.stories.tsx` or `*.stories.ts`

### Import Order

```typescript
// 1. React and React Native
import React from 'react';
import { Text, View } from 'react-native';
// 2. Third-party libraries
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
// 3. App aliases (module/platform/shared)
import { useAuth } from '@modules/auth';
import { qk } from '@platform/query';
import { formatDate } from '@shared/utils/date';
// 4. Local components/types
import { Button } from '../components/Button';
// 6. Styles
import { styles } from './ComponentName.styles';
```

### Module Organization

**One function per file** - Never create files with multiple functions grouped together. That's what folders are for.

Each module should:

- Live in the appropriate `modules/<feature>` area
- Have its own file named after the function
- Be in a folder representing the feature/domain

#### Good - Modular structure in a feature module

```text
apps/parakeet/src/modules/program/
  application/
  data/
  hooks/
  model/
  ui/
  index.ts
```

Import files directly (no barrel files):

```typescript
// From another module (public API)
import { getActiveProgram } from '@modules/program';

// Within the same module
import { hasWorkouts } from './hasWorkouts';
```

#### Bad - Monolithic service file

```text
apps/parakeet/src/modules/session/application/
  session.service.ts  // ❌ Contains too many unrelated functions in one file
```

#### Also Bad - Barrel files within library folders

```text
apps/parakeet/src/modules/program/
  application/
    index.ts  // ❌ Unnecessary re-export layer
    createProgram.ts
    ...
```

**Why avoid barrel files (within libraries):**

- Adds an unnecessary layer of indirection
- Makes it harder to trace imports
- Can lead to circular dependency issues
- The library's root `index.ts` is the only barrel you need

**Note:** Each library has a root `index.ts` (e.g., `libs/parakeet/data-parakeet/src/index.ts`) that exports the library's public API. This is the ONLY barrel file and is required by NX.

#### Benefits of modular structure

- Easy to find and edit specific functionality
- Better git history and conflict resolution
- Clearer responsibility per file
- Easier to test individual functions
- Simpler code review process
- Works well with NX's library-based architecture

---

## Async Operations

### Server State (data fetching)

Use React Query — not manual `useState`/`useEffect`. Loading, error, and data states come from `useQuery`/`useMutation`. See [react-query-patterns.md](./react-query-patterns.md).

### Client-Side Async (non-server)

For operations that aren't server state (e.g., AsyncStorage writes, local file I/O), use try/catch with `captureException`:

```typescript
const handleExport = async () => {
  try {
    await storage.setItem(KEY, JSON.stringify(data));
  } catch (err) {
    captureException(err);
    Alert.alert('Export failed');
  }
};
```

---

## Error Handling

Never swallow errors silently — always report to Sentry via `captureException`. Prefer try/catch with meaningful fallback behavior.

### Component Error Boundaries

```typescript
// ErrorBoundary.tsx
import React from 'react';
import { Text, View } from 'react-native';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <Text>Something went wrong</Text>;
    }

    return this.props.children;
  }
}
```

### Custom Errors

```typescript
// errors.ts
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

---

## Feature-Based Testing

Tests are co-located with the libraries they test. Each library must be independently testable.

See [Project Organization - Feature-Based Testing](./project-organization.md#feature-based-testing) for comprehensive strategy.

### Testing Requirements by Library Type

**Util Libraries** - Unit tests (required)

```typescript
// apps/parakeet/src/shared/utils/date.test.ts
import { formatDate } from './formatDate';

describe('formatDate', () => {
  it('formats dates correctly', () => {
    expect(formatDate('2024-01-15')).toBe('January 15, 2024');
  });
});
```

**Data-Access Libraries** - Unit tests (required)

```typescript
// apps/parakeet/src/modules/session/data/session.repository.test.ts
import { getparakeet } from './getparakeet';

// Mock external dependencies
jest.mock('@/database');

describe('getparakeet', () => {
  it('fetches parakeet by id', async () => {
    const parakeet = await getparakeet('123');
    expect(parakeet).toBeDefined();
  });
});
```

**UI Libraries** - Component tests (required)

```typescript
// apps/parakeet/src/shared/ui/Button.test.tsx
import { fireEvent, render } from '@testing-library/react-native';
import { Button } from './Button';

describe('Button', () => {
  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button onPress={onPress}>Click</Button>);

    fireEvent.press(getByText('Click'));
    expect(onPress).toHaveBeenCalled();
  });
});
```

**Feature Libraries** - Integration tests (required)

```typescript
// apps/parakeet/src/modules/history/ui/HistoryScreen.test.tsx
import { render, waitFor } from '@testing-library/react-native';
import { ArchiveScreen } from './ArchiveScreen';

// Mock data-access dependencies
jest.mock('@parakeet/data-parakeet');

describe('ArchiveScreen', () => {
  it('displays parakeet when loaded', async () => {
    const { getByText } = render(<ArchiveScreen />);

    await waitFor(() => {
      expect(getByText('My parakeet')).toBeTruthy();
    });
  });
});
```

### Running Tests

```bash
# Run all tests
nx test

# Run tests for changed code only (fast!)
nx affected:test

# Run tests for a specific library
nx test parakeet-feature-archive

# Run tests in watch mode
nx test parakeet-feature-archive --watch

# Run all tests in parallel
nx run-many -t test
```

### Test Organization

Tests live alongside the code they test:

```
libs/parakeet/feature-archive/
  src/
    lib/
      ArchiveScreen.tsx
      ArchiveScreen.test.tsx        # ✅ Co-located
      components/
        parakeetCard.tsx
        parakeetCard.test.tsx     # ✅ Co-located
```

**Benefits:**

- Easy to find related tests
- Tests run only when affected code changes (`nx affected:test`)
- Libraries are self-contained and independently testable
- Faster CI/CD pipelines

---

## Testing

### Component Tests

```typescript
// ComponentName.test.tsx
import { fireEvent, render } from '@testing-library/react-native';
import { ComponentName } from './ComponentName';

describe('ComponentName', () => {
  it('renders correctly', () => {
    const { getByText } = render(<ComponentName title="Test" />);
    expect(getByText('Test')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <ComponentName title="Test" onPress={onPress} />
    );

    fireEvent.press(getByText('Test'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
```

### Hook Tests

```typescript
// useFeature.test.ts
import { renderHook, waitFor } from '@testing-library/react-native';
import { useFeature } from './useFeature';

describe('useFeature', () => {
  it('fetches data on mount', async () => {
    const { result } = renderHook(() => useFeature('123'));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeTruthy();
  });
});
```

---

## Naming Conventions

### Variables and Functions

- **Boolean**: Prefix with `is`, `has`, `should` (e.g., `isLoading`, `hasError`)
- **Functions**: Verb-based (e.g., `fetchUser`, `handlePress`, `validateInput`)
- **Event handlers**: Prefix with `handle` (e.g., `handleSubmit`, `handleChange`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `API_BASE_URL`, `MAX_RETRIES`)

### Components

- **Container components**: `[Feature]Container` (e.g., `UserProfileContainer`)
- **Presentational**: `[Feature]` (e.g., `UserProfile`)
- **Screens**: `[Name]Screen` (e.g., `HomeScreen`, `ProfileScreen`)

---

## Comments

### When to Comment

```typescript
// ✅ Good - Explains WHY, not WHAT
// Using exponential backoff to avoid rate limiting
const retryDelay = Math.pow(2, attempt) * 1000;

// ✅ Good - Documents complex logic
// Algorithm explanation: We use a binary search here because
// the data is sorted by timestamp, making O(log n) possible
const index = binarySearch(items, target);

// ❌ Bad - Explains obvious code
// Set loading to true
setLoading(true);
```

### JSDoc for Public APIs

````typescript
/**
 * Fetches user profile data from the API
 *
 * @param userId - The unique identifier for the user
 * @param options - Optional fetch configuration
 * @returns Promise resolving to user profile data
 * @throws {ApiError} When the API request fails
 *
 * @example
 * ```ts
 * const profile = await fetchUserProfile('123');
 * ```
 */
export async function fetchUserProfile(userId: string, options?: FetchOptions): Promise<UserProfile> {
  // Implementation
}
````

---

## Performance

### Memoization

```typescript
import { useCallback, useMemo } from 'react';

// Memoize expensive computations
const sortedUsers = useMemo(() => users.sort((a, b) => a.name.localeCompare(b.name)), [users]);

// Memoize callbacks passed to child components
const handleUserSelect = useCallback((userId: string) => {
  console.log('Selected:', userId);
}, []);
```

### List Optimization

```typescript
import { FlatList } from 'react-native';

// Use keyExtractor and optimization props
<FlatList
  data={items}
  keyExtractor={(item) => item.id}
  renderItem={renderItem}
  removeClippedSubviews={true}
  maxToRenderPerBatch={10}
  windowSize={5}
/>;
```

---

## Accessibility

```typescript
import { Pressable, Text, View } from 'react-native';

<Pressable
  onPress={handlePress}
  accessible={true}
  accessibilityLabel="Submit form"
  accessibilityHint="Submits your profile information"
  accessibilityRole="button"
>
  <Text>Submit</Text>
</Pressable>;
```

---

## Don'ts

❌ Mutating state directly

```typescript
// Bad
state.users.push(newUser);

// Good
setState((prev) => [...prev, newUser]);
```

❌ Inline styles (use StyleSheet)

```typescript
// Bad
<View style={{ padding: 16, margin: 8 }} />;

// Good
const styles = StyleSheet.create({
  container: { padding: 16, margin: 8 },
});
<View style={styles.container} />;
```

❌ Hardcoded strings

```typescript
// Bad
<Text>Welcome back!</Text>

// Good - use i18n or constants
<Text>{t('welcome.message')}</Text>
```

❌ Console logs in production

```typescript
// Bad
console.log('User data:', user);

// Good - use conditional logging
if (__DEV__) {
  console.log('User data:', user);
}
```

---

## Dashboard (`apps/dashboard`) — Web-specific conventions

The dashboard is a plain React/Vite app with inline styles (no StyleSheet). Different rules apply.

### Theming

All colours live in `src/styles.css` as CSS custom properties. Import `theme.ts` in components — never write raw `rgba()` or hex literals in component files.

```ts
import { theme } from '../lib/theme';

// Good
border: `1px solid ${theme.border.accent}`
background: theme.bg.purpleDim

// Bad
border: '1px solid rgba(245,158,11,0.25)'
background: 'rgba(167,139,250,0.12)'
```

To add a new colour: add the CSS var to `:root` in `styles.css`, then add a constant to `theme.ts`.

### Interactive elements

`<div onClick>` is a lint error (oxlint a11y). Use `<button className="btn-reset">` instead.

```tsx
// Good
<button className="btn-reset" onClick={() => setOpen(!open)}>
  ...
</button>

// Bad — lint error
<div onClick={() => setOpen(!open)}>
  ...
</div>
```

`btn-reset` is defined in `styles.css` (`all: unset; display: block; width: 100%; cursor: pointer; text-align: left`).

### TypeScript guards for `unknown` in JSX

When a `Record<string, unknown>` value is used in JSX children, narrow it explicitly:

```tsx
// Bad — TS error: 'unknown' not assignable to ReactNode
{meta?.strategy && renderBadge(meta.strategy as string)}

// Good
{typeof meta?.strategy === 'string' && renderBadge(meta.strategy)}
```

### Adding a new dashboard page

When adding a page backed by its own Supabase table, also update `Logs.tsx` (Timeline): add the event type to `typeConfig`, `Stats`, `StatCard`, and the `Promise.all` query. See `docs/design/dashboard.md` for the full checklist.

### `JsonViewer` visibility

`JsonViewer` with `defaultCollapsed={true}` and no `label` is permanently hidden — the component has no toggle UI without a label. Always pass either a `label` prop or `defaultCollapsed={false}`.
