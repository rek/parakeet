This directory contains design documents and architecture decisions

## Documentation Philosophy

We follow a two-tier documentation approach:

### 📄 Design Docs (High-Level)

**Purpose**: User-focused feature documentation
**Audience**: You (the product owner), future developers, stakeholders
**Content**: WHAT and WHY

**Location**: `/docs/designs/`

**Includes**:

- Feature overview and user benefits
- Links to Figma
- User flows and interactions
- Problem statements
- Implementation status
- Future enhancements

**Excludes**:

- Code implementations
- API contracts
- Database schemas
- Component structures
- Testing strategies

### 🔵 Specs (Granular Tasks)

**Purpose**: Technical implementation tracking
**Audience**: AI assistant, developers
**Content**: HOW
**Includes**:

- Specific implementation tasks
- Technical dependencies
- Code-level details
- Progress tracking
- Task relationships

## Why This Approach?

**Design Docs** give you a clear picture of what features exist and how users experience them - without overwhelming technical noise.

**Specs** handle the nitty-gritty implementation details that change frequently and aren't needed for understanding the product.

**Result**: Clean, maintainable documentation that serves both product and technical needs.
