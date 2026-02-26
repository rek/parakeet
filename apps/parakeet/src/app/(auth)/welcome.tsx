import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { signInWithGoogleToken, signInWithMagicLink } from '../../services/auth.service';
import { colors, spacing, radii, typography } from '../../theme';

export default function WelcomeScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID });
    }
  }, []);

  async function handleGoogleSignIn() {
    if (Platform.OS === 'web') return;
    try {
      setLoading(true);
      await GoogleSignin.hasPlayServices();
      const { data } = await GoogleSignin.signIn();
      const idToken = data?.idToken;
      if (!idToken) throw new Error('No ID token from Google');

      await signInWithGoogleToken(idToken);
    } catch (err: unknown) {
      Alert.alert('Sign-in failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailOtp() {
    if (!email.trim()) return;
    try {
      setLoading(true);
      const emailRedirectTo = Platform.OS === 'web' ? window.location.origin : Linking.createURL('/');
      await signInWithMagicLink(email.trim(), emailRedirectTo);
      Alert.alert('Check your email', `Magic link sent to ${email}`);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* Brand mark */}
      <View style={styles.brandSection}>
        <Text style={styles.wordmark}>PARAKEET</Text>
        <View style={styles.accentBar} />
        <Text style={styles.tagline}>Powerlifting. Engineered.</Text>
      </View>

      {/* Auth form */}
      <View style={styles.formSection}>
        <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignIn} disabled={loading}>
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <TextInput
          style={styles.input}
          placeholder="Email address"
          placeholderTextColor={colors.textTertiary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.emailButton, (!email.trim() || loading) && styles.buttonDisabled]}
          onPress={handleEmailOtp}
          disabled={loading || !email.trim()}
          activeOpacity={0.85}
        >
          <Text style={styles.emailButtonText}>Send magic link</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator style={styles.spinner} color={colors.primary} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing[8],
    backgroundColor: colors.bg,
  },
  // Brand
  brandSection: {
    alignItems: 'center',
    marginBottom: spacing[12],
  },
  wordmark: {
    fontSize: typography.sizes['5xl'],
    fontWeight: typography.weights.black,
    color: colors.primary,
    letterSpacing: typography.letterSpacing.widest,
    textAlign: 'center',
  },
  accentBar: {
    width: 48,
    height: 3,
    backgroundColor: colors.secondary,
    borderRadius: radii.full,
    marginTop: spacing[2],
    marginBottom: spacing[3],
  },
  tagline: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
    letterSpacing: typography.letterSpacing.wider,
    textTransform: 'uppercase',
  },
  // Form
  formSection: {
    gap: spacing[3],
  },
  googleButton: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  googleButtonText: {
    color: colors.text,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing[1],
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    marginHorizontal: spacing[3],
    color: colors.textTertiary,
    fontSize: typography.sizes.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    fontSize: typography.sizes.base,
    color: colors.text,
    backgroundColor: colors.bgSurface,
  },
  emailButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  emailButtonText: {
    color: colors.textInverse,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    letterSpacing: typography.letterSpacing.wide,
  },
  spinner: {
    marginTop: spacing[6],
  },
});
