/** Horizontal, virtualized thumbnail picker for the compare screen. */
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { PressableScale } from '@/components/PressableScale';
import { resolveJourneyUri } from '@/services/journeyFiles';
import type { JourneyPhoto } from '@/stores/journey';
import { colors, radius, spacing } from '@/theme/tokens';

const THUMB = 64;

export interface PhotoStripProps {
  title: string;
  photos: readonly JourneyPhoto[];
  selectedId: string;
  onSelect: (id: string) => void;
  labelFor: (photo: JourneyPhoto) => string;
  a11yFor: (photo: JourneyPhoto) => string;
  testID?: string;
}

export function PhotoStrip({ title, photos, selectedId, onSelect, labelFor, a11yFor, testID }: PhotoStripProps) {
  return (
    <View style={styles.block}>
      <AppText variant="micro" color="textTertiary">
        {title}
      </AppText>
      <FlashList
        horizontal
        data={photos as JourneyPhoto[]}
        keyExtractor={(p) => p.id}
        extraData={selectedId}
        showsHorizontalScrollIndicator={false}
        testID={testID}
        ItemSeparatorComponent={Separator}
        renderItem={({ item }) => {
          const selected = item.id === selectedId;
          return (
            <PressableScale
              onPress={() => onSelect(item.id)}
              haptic="selection"
              accessibilityRole="radio"
              accessibilityLabel={a11yFor(item)}
              accessibilityState={{ selected, checked: selected }}
              style={[styles.thumb, selected && styles.selected]}
            >
              <Image source={{ uri: resolveJourneyUri(item.uri) }} style={styles.image} contentFit="cover" recyclingKey={item.id} />
              <View style={styles.tag}>
                <AppText variant="micro" color="textOnAccent" numberOfLines={1}>
                  {labelFor(item)}
                </AppText>
              </View>
            </PressableScale>
          );
        }}
      />
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  block: { gap: spacing.xs, height: THUMB + 24 },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.sm,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.stroke,
    backgroundColor: colors.surface,
  },
  selected: { borderColor: colors.primary },
  image: { width: '100%', height: '100%' },
  tag: { position: 'absolute', bottom: 0, start: 0, end: 0, backgroundColor: colors.scrim, paddingHorizontal: 3 },
  separator: { width: spacing.sm },
});
