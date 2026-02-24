# Code Style Guide

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
export function ComponentName({
  param1,
  param2,
}: {
  param1: string;
  param2: boolean;
}) {
  // Implementation
}
```

NOTE: used an object as the first argument, instead of multiple arguments. AKA: prefer single arity functions

```typescript
function updateProfile(profile: {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}): Promise<void> {
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

**CRITICAL: AVOID CREATING SEPARATE TYPES FILES**

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
export function MyComponent({
  title,
  onPress,
}: {
  title: string;
  onPress: () => void;
}) {
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

**❌ NEVER DO THIS:**

```typescript
// DON'T create separate type files
// types.ts
export type NotificationSettings = {
  enabled: boolean;
  time: string;
  timezone: string;
};
```

**When you MUST define a type (rare):**

1. Define it inline in the same file where it's used
2. Use `type` (not `interface`) and do NOT export it
3. Only export if it's part of a public API contract (e.g., database schema)

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

### Custom Hook Pattern

```typescript
// useFeature.ts
import { useEffect, useState } from 'react';

export const useFeature = (
  id: string
): {
  data: Data | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
} => {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const result = await api.fetch(id);
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
};
```

---

## NX Library Organization

This project uses NX monorepo architecture. See [Project Organization](./PROJECT_ORGANIZATION.md) for comprehensive details.

### Library Types Quick Reference

| Type          | Purpose                                    | Can Import From       |
| ------------- | ------------------------------------------ | --------------------- |
| `feature`     | Smart components, business logic, features | ui, data-access, util |
| `ui`          | Presentational components                  | util only             |
| `data-access` | API calls, state management                | util only             |
| `util`        | Pure functions, helpers                    | nothing               |

**Apps are shells** - routing and config only. All features belong in `libs/`.

### When to Create a New Library

**Create a new library when:**

- Starting a new feature (`feature-*`)
- Building reusable UI components (`ui-*`)
- Adding data fetching/state management (`data-access-*`)
- Creating shared utilities (`util-*`)

**Add to existing library when:**

- Extending an existing feature's functionality
- Adding a variant of an existing component
- Adding related utility functions

**Decision Tree:**

```
Is it a user-facing feature/page?
  └─ Yes → Create `feature-*` library
  └─ No → Continue...

Is it a reusable UI component with no business logic?
  └─ Yes → Create `ui-*` library (or add to existing ui lib)
  └─ No → Continue...

Does it fetch data or manage state?
  └─ Yes → Create `data-access-*` library (or add to existing)
  └─ No → Continue...

Is it a pure utility/helper function?
  └─ Yes → Create `util-*` library (or add to existing)
  └─ No → Re-evaluate your approach
```

### Library Structure

Each library follows this structure:

```
libs/{scope}/{type}-{name}/
  src/
    lib/              # Library code goes here
    index.ts          # Public API exports
  project.json        # NX project config with tags
  tsconfig.json
```

**Important:** Library tags in `project.json` must include:

- `type:{feature|ui|data-access|util}`
- `scope:{dailyProvisions|shared}`

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
// 3. Local components
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
// 4. Hooks
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import type { User } from '@/types/User';
// 5. Utils and types
import { formatDate } from '@/utils/formatDate';
// 6. Styles
import { styles } from './ComponentName.styles';
```

### Module Organization

**Important:** In NX monorepos, organize code into libraries first (see [NX Library Organization](#nx-library-organization) above), then apply these module organization principles within each library.

**One function per file** - Never create files with multiple functions grouped together. That's what folders are for.

Each module should:

- Live in the appropriate NX library (feature, ui, data-access, or util)
- Have its own file named after the function
- Be in a folder representing the feature/domain within the library

#### Good - Modular structure within libraries

```text
libs/dailyProvisions/data-dailyProvisions/src/lib/
  getDevotionalsByDate.ts
  seeddailyProvisions.ts
  getDevotionalsCount.ts
  hasDevotionals.ts
```

Import files directly (no barrel files):

```typescript
// From other libraries
import { hasDevotionals } from '@choiganz/dailyProvisions/data-dailyProvisions';
// This resolves to the library's index.ts which exports public API

// Within the same library
import { hasDevotionals } from './hasDevotionals';
```

#### Bad - Monolithic service file

```text
libs/dailyProvisions/data-dailyProvisions/src/lib/
  dailyProvisionservice.ts  // ❌ Contains 6+ functions in one file
```

#### Also Bad - Barrel files within library folders

```text
libs/dailyProvisions/data-dailyProvisions/src/lib/
  services/
    index.ts  // ❌ Unnecessary re-export layer
    getDevotionalsByDate.ts
    ...
```

**Why avoid barrel files (within libraries):**

- Adds an unnecessary layer of indirection
- Makes it harder to trace imports
- Can lead to circular dependency issues
- The library's root `index.ts` is the only barrel you need

**Note:** Each library has a root `index.ts` (e.g., `libs/dailyProvisions/data-dailyProvisions/src/index.ts`) that exports the library's public API. This is the ONLY barrel file and is required by NX.

#### Benefits of modular structure

- Easy to find and edit specific functionality
- Better git history and conflict resolution
- Clearer responsibility per file
- Easier to test individual functions
- Simpler code review process
- Works well with NX's library-based architecture

---

## Async Operations

### Promise Handling

```typescript
// ✅ Good - with proper error handling
const fetchUser = async (id: string): Promise<User> => {
  try {
    const response = await api.get(`/users/${id}`);
    return response.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw new Error(`Failed to fetch user: ${error.message}`);
    }
    throw error;
  }
};
```

### Loading States

```typescript
const [loading, setLoading] = useState(false);
const [error, setError] = useState<Error | null>(null);

const handleSubmit = async () => {
  setLoading(true);
  setError(null);

  try {
    await submitData();
  } catch (err) {
    setError(err as Error);
  } finally {
    setLoading(false);
  }
};
```

---

## Error Handling

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
  constructor(message: string, public field: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

---

## Feature-Based Testing

Tests are co-located with the libraries they test. Each library must be independently testable.

See [Project Organization - Feature-Based Testing](./PROJECT_ORGANIZATION.md#feature-based-testing) for comprehensive strategy.

### Testing Requirements by Library Type

**Util Libraries** - Unit tests (required)

```typescript
// libs/dailyProvisions/util-display/src/lib/formatDate.test.ts
import { formatDate } from './formatDate';

describe('formatDate', () => {
  it('formats dates correctly', () => {
    expect(formatDate('2024-01-15')).toBe('January 15, 2024');
  });
});
```

**Data-Access Libraries** - Unit tests (required)

```typescript
// libs/dailyProvisions/data-dailyProvisions/src/lib/getdailyProvisions.test.ts
import { getdailyProvisions } from './getdailyProvisions';

// Mock external dependencies
jest.mock('@/database');

describe('getdailyProvisions', () => {
  it('fetches dailyProvisions by id', async () => {
    const dailyProvisions = await getdailyProvisions('123');
    expect(dailyProvisions).toBeDefined();
  });
});
```

**UI Libraries** - Component tests (required)

```typescript
// libs/shared/ui-button/src/lib/Button.test.tsx
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
// libs/dailyProvisions/feature-archive/src/lib/ArchiveScreen.test.tsx
import { render, waitFor } from '@testing-library/react-native';
import { ArchiveScreen } from './ArchiveScreen';

// Mock data-access dependencies
jest.mock('@choiganz/dailyProvisions/data-dailyProvisions');

describe('ArchiveScreen', () => {
  it('displays dailyProvisions when loaded', async () => {
    const { getByText } = render(<ArchiveScreen />);

    await waitFor(() => {
      expect(getByText('My dailyProvisions')).toBeTruthy();
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
nx test dailyProvisions-feature-archive

# Run tests in watch mode
nx test dailyProvisions-feature-archive --watch

# Run all tests in parallel
nx run-many -t test
```

### Test Organization

Tests live alongside the code they test:

```
libs/dailyProvisions/feature-archive/
  src/
    lib/
      ArchiveScreen.tsx
      ArchiveScreen.test.tsx        # ✅ Co-located
      components/
        dailyProvisionsCard.tsx
        dailyProvisionsCard.test.tsx     # ✅ Co-located
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
export async function fetchUserProfile(
  userId: string,
  options?: FetchOptions
): Promise<UserProfile> {
  // Implementation
}
````

---

## Performance

### Memoization

```typescript
import { useCallback, useMemo } from 'react';

// Memoize expensive computations
const sortedUsers = useMemo(
  () => users.sort((a, b) => a.name.localeCompare(b.name)),
  [users]
);

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
