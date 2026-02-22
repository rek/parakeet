# ADR-002: Expo and React Native for Cross-Platform Mobile Development

**Date**: 2025-10-14
**Status**: Accepted

## Context

We need to build a mobile dailyProvisions app for iOS and Android with native features (notifications, haptics, storage) while maintaining a single codebase and fast development velocity.

## Decision

Use **Expo SDK 54** with **React Native 0.81.4** and **TypeScript 5.9**.

Key components:

- Expo Router for file-based navigation
- React 19.1 for latest React features
- Expo modules for native device APIs

## Rationale

### Pros

- Single codebase for iOS, Android, and potentially web
- Fast development with hot reload and excellent DX
- No native code required for most features
- OTA updates for quick bug fixes
- Strong TypeScript support
- Team already knows React
- Large ecosystem and community

### Cons

- Larger app bundle size than native
- Performance ceiling for heavy graphics/computations
- Dependent on Expo's release cycle for new native features
- May need to eject for very advanced native requirements

## Alternatives Considered

### Alternative 1: Native Development (Swift/Kotlin)

- **Why not chosen:** Double the development effort, requires platform-specific expertise, slower iteration

### Alternative 2: Flutter

- **Why not chosen:** Team has React expertise, smaller ecosystem, Dart learning curve

### Alternative 3: React Native CLI (Bare)

- **Why not chosen:** More complex setup, no OTA updates, can eject to this later if needed

## Consequences

### Positive

- Rapid MVP development and iteration
- Lower barrier to entry for React developers
- Simplified CI/CD with EAS Build
- Cost-effective single-team maintenance

### Negative

- Need to monitor and optimize bundle size
- May require performance optimization for complex features
- Must test OTA updates carefully

## Implementation Notes

**Development:**

```bash
npm start        # Start dev server
npm run ios      # iOS simulator
npm run android  # Android emulator
```

**Performance best practices:**

- Use Hermes JavaScript engine
- Implement code splitting with Expo Router
- Use React.memo() for expensive components
- Lazy load heavy screens

**Migration path:** If advanced native features needed, use Expo development client or eject to bare workflow.

## References

- [React Native Documentation](https://reactnative.dev/)
- [Expo Documentation](https://docs.expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [EAS Build/Update](https://docs.expo.dev/build/introduction/)
