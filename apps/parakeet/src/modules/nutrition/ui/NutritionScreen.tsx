import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { radii, spacing, typography } from '../../../theme';
import type { ColorScheme } from '../../../theme';
import { useTheme } from '../../../theme/ThemeContext';
import { useProtocolBundle, useProtocols } from '../hooks/useNutrition';
import { Markdown } from '../lib/markdown';
import type { DietProtocolSlug } from '../lib/macro-targets';
import { CalculatorSection } from './CalculatorSection';
import { CompareSection } from './CompareSection';
import { DailyRituals } from './DailyRituals';
import { FoodSection } from './FoodSection';
import { LifestyleSection } from './LifestyleSection';
import { MacroTargetsCard } from './MacroTargetsCard';
import { ProtocolSelector } from './ProtocolSelector';
import { SourcesSection } from './SourcesSection';
import { SupplementSection } from './SupplementSection';

type Tab =
  | 'overview'
  | 'foods'
  | 'supplements'
  | 'lifestyle'
  | 'compare'
  | 'calculator'
  | 'sources';
const TABS: Tab[] = [
  'overview',
  'foods',
  'supplements',
  'lifestyle',
  'compare',
  'calculator',
  'sources',
];
const TAB_LABELS: Record<Tab, string> = {
  overview: 'Overview',
  foods: 'Foods',
  supplements: 'Supplements',
  lifestyle: 'Lifestyle',
  compare: 'Compare',
  calculator: 'Calculator',
  sources: 'Sources',
};

export function NutritionScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const { data: protocols, isLoading: protocolsLoading, error: protocolsError } =
    useProtocols();
  const [slug, setSlug] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => {
    if (!slug && protocols && protocols.length > 0) {
      const rad = protocols.find((p) => p.slug === 'rad');
      setSlug(rad?.slug ?? protocols[0].slug);
    }
  }, [slug, protocols]);

  const { data: bundle, isLoading: bundleLoading } = useProtocolBundle(
    slug ?? '',
  );

  if (protocolsError) {
    return (
      <View style={styles.stateBox}>
        <Text style={styles.errorText}>
          Could not load nutrition data: {String(protocolsError)}
        </Text>
      </View>
    );
  }

  if (protocolsLoading || !protocols) {
    return (
      <View style={styles.stateBox}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (protocols.length === 0) {
    return (
      <View style={styles.stateBox}>
        <Text style={styles.emptyText}>
          No diet protocols seeded yet. Run the seed script:
        </Text>
        <Text style={styles.code}>npm run db:seed:diet</Text>
      </View>
    );
  }

  const showSelector = tab !== 'compare' && tab !== 'calculator';

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {showSelector && (
        <ProtocolSelector
          protocols={protocols}
          selectedSlug={slug ?? ''}
          onSelect={setSlug}
        />
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}
      >
        {TABS.map((t) => {
          const active = t === tab;
          return (
            <TouchableOpacity
              key={t}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setTab(t)}
              activeOpacity={0.75}
            >
              <Text
                style={[styles.tabLabel, active && styles.tabLabelActive]}
              >
                {TAB_LABELS[t]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {tab === 'compare' ? (
        <CompareSection />
      ) : tab === 'calculator' ? (
        <CalculatorSection
          defaultProtocol={
            slug && isMacroProtocol(slug) ? slug : 'keto'
          }
        />
      ) : bundleLoading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : bundle ? (
        <>
          {tab === 'overview' && (
            <>
              {isMacroProtocol(bundle.protocol.slug) ? (
                <MacroTargetsCard protocol={bundle.protocol.slug} />
              ) : null}
              <DailyRituals foods={bundle.foods} />
              {bundle.protocol.descriptionMd ? (
                <Markdown source={bundle.protocol.descriptionMd} />
              ) : (
                <Text style={styles.emptyText}>
                  No prose doc for this protocol yet.
                </Text>
              )}
            </>
          )}
          {tab === 'foods' && <FoodSection foods={bundle.foods} />}
          {tab === 'supplements' && (
            <SupplementSection supplements={bundle.supplements} />
          )}
          {tab === 'lifestyle' && (
            <LifestyleSection items={bundle.lifestyle} />
          )}
          {tab === 'sources' && (
            <SourcesSection descriptionMd={bundle.protocol.descriptionMd} />
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

function isMacroProtocol(slug: string): slug is DietProtocolSlug {
  return slug === 'keto' || slug === 'rad';
}

function buildStyles(colors: ColorScheme) {
  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: colors.bg },
    content: {
      padding: spacing[4],
      gap: spacing[4],
      paddingBottom: spacing[10],
    },
    tabsRow: {
      gap: spacing[1],
      backgroundColor: colors.bgSurface,
      padding: spacing[1],
      borderRadius: radii.md,
    },
    tab: {
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2],
      borderRadius: radii.sm,
    },
    tabActive: { backgroundColor: colors.primary },
    tabLabel: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.textSecondary,
    },
    tabLabelActive: { color: colors.textInverse },
    stateBox: { padding: spacing[6], alignItems: 'center', gap: spacing[2] },
    errorText: { color: colors.danger, fontSize: typography.sizes.sm },
    emptyText: {
      color: colors.textSecondary,
      fontSize: typography.sizes.sm,
      textAlign: 'center',
    },
    code: {
      fontFamily: 'Courier',
      fontSize: typography.sizes.sm,
      color: colors.primary,
      backgroundColor: colors.bgSurface,
      padding: spacing[2],
      borderRadius: radii.sm,
    },
  });
}
