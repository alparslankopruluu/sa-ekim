import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, layout, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Button } from './Button';

export interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  /** Defaults to the shared "Cancel" label. */
  cancelLabel?: string;
  /** Red confirm button for irreversible actions. */
  destructive?: boolean;
  /** Confirm in flight: both buttons lock and the confirm shows progress. */
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Bottom confirmation sheet for irreversible actions (delete data, delete account). */
export function ConfirmSheet({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel,
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={loading ? undefined : onCancel}
      statusBarTranslucent
    >
      <View style={styles.root} accessibilityViewIsModal>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={loading ? undefined : onCancel}
          accessibilityRole="button"
          accessibilityLabel={cancelLabel ?? t('common.cancel')}
        />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.sm }]}>
          <View style={styles.grabber} />
          <AppText variant="title2" accessibilityRole="header">
            {title}
          </AppText>
          <AppText variant="body" color="textSecondary">
            {body}
          </AppText>
          <View style={styles.actions}>
            <Button
              label={confirmLabel}
              onPress={onConfirm}
              variant={destructive ? 'danger' : 'primary'}
              loading={loading}
              testID="confirm-sheet-confirm"
            />
            <Button
              label={cancelLabel ?? t('common.cancel')}
              onPress={onCancel}
              variant="ghost"
              disabled={loading}
              testID="confirm-sheet-cancel"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  sheet: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    gap: spacing.md,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    borderTopStartRadius: radius.xl,
    borderTopEndRadius: radius.xl,
    backgroundColor: colors.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.strokeStrong,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.strokeStrong,
    marginBottom: spacing.sm,
  },
  actions: { gap: spacing.sm, marginTop: spacing.md },
});
