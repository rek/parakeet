import { Component, type ReactNode } from 'react';
import { ScrollView, Text } from 'react-native';
import { colors } from '../../theme';

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    const { error } = this.state;
    if (error) {
      return (
        <ScrollView
          style={{ flex: 1, padding: 24, backgroundColor: colors.bg }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: '700',
              color: colors.danger,
              marginBottom: 8,
            }}
          >
            Crash
          </Text>
          <Text
            style={{
              fontFamily: 'monospace',
              fontSize: 12,
              color: colors.textSecondary,
            }}
          >
            {(error as Error).message}
            {'\n\n'}
            {(error as Error).stack}
          </Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}
