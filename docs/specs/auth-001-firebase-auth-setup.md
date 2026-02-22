# Spec: Firebase Auth Setup

**Status**: Planned
**Domain**: Auth & Users

## What This Covers

Firebase Authentication configuration for both the mobile app (Google + Apple OAuth) and the API (JWT verification middleware).

## Tasks

**Firebase project setup:**
- Enable Google Sign-In provider in Firebase console
- Enable Apple Sign-In provider (requires Apple Developer account configuration)
- Add iOS and Android app registrations in Firebase console
- Download `google-services.json` (Android) and `GoogleService-Info.plist` (iOS)
- Configure Firebase Admin SDK service account for the API

**Mobile (`apps/mobile`):**
- Install `@react-native-firebase/app`, `expo-auth-session`, `expo-crypto`
- Implement Google Sign-In using `expo-auth-session` with Firebase credential exchange
- Implement Apple Sign-In using `expo-apple-authentication`
- Store Firebase ID token in `expo-secure-store` after successful sign-in
- Implement auth state listener: redirect to `/(auth)/welcome` if signed out, `/(tabs)/today` if signed in
- Implement token refresh: check token expiry before each API request; refresh silently if within 5 minutes of expiry
- Sign-out: clear SecureStore token, call Firebase `signOut()`, redirect to welcome

**API (`apps/api/src/plugins/auth.ts`):**
- Install `firebase-admin` npm package
- Initialize Firebase Admin SDK from `FIREBASE_ADMIN_SDK_JSON` environment variable (parsed from Secret Manager)
- Implement Fastify plugin that verifies `Authorization: Bearer <token>` header on every request
- Extract `uid` from verified token, look up `users.firebase_uid` to resolve internal `user_id`
- Attach `user_id` and `firebase_uid` to `request.user` for use in route handlers
- Return `401 Unauthorized` with appropriate error code for missing, invalid, or expired tokens
- Exclude public routes from auth check: `GET /health`, `GET /v1/healthz`

## Dependencies

- [infra-002-gcp-project-bootstrap.md](./infra-002-gcp-project-bootstrap.md)
- [infra-001-nx-monorepo-setup.md](./infra-001-nx-monorepo-setup.md)
