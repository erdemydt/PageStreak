import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  KeyboardTypeOptions,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { COLORS } from "../../themes/colors";
import { RADIUS, SPACING } from "../../themes/spacing";
import { FONTS, TYPE } from "../../themes/typography";
import Button from "./Button";
import Sheet from "./Sheet";

/**
 * Edit one value in a sheet (a name, a yearly goal). `onSave` returns an
 * error message to keep the sheet open, or nothing to close it.
 */
export default function FieldSheet({
  visible,
  title,
  hint,
  initialValue,
  keyboardType = "default",
  maxLength,
  large = false,
  onSave,
  onClose,
}: {
  visible: boolean;
  title: string;
  hint?: string;
  initialValue: string;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
  /** A big serif numeral input (numbers) instead of a text field */
  large?: boolean;
  onSave: (value: string) => Promise<string | void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setValue(initialValue);
    // Only when it opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const save = async () => {
    setSaving(true);
    try {
      const error = await onSave(value);
      if (error) {
        Alert.alert(t("error"), error);
      } else {
        onClose();
      }
    } catch (e) {
      console.error("Failed to save:", e);
      Alert.alert(t("error"), t("profile.error.message"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      dismissible={!saving}
      closeButton={false}
      title={title}
      footer={
        <>
          <Button
            title={t("components.bookDetailModal.cancel")}
            variant="secondary"
            onPress={onClose}
            disabled={saving}
          />
          <Button
            title={t("components.bookDetailModal.save")}
            onPress={save}
            loading={saving}
            grow
          />
        </>
      }
    >
      <View style={styles.body}>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        <TextInput
          style={large ? styles.large : styles.input}
          value={value}
          onChangeText={setValue}
          keyboardType={keyboardType}
          maxLength={maxLength}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={save}
          editable={!saving}
          accessibilityLabel={title}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: SPACING[3],
  },
  hint: TYPE.meta,
  input: {
    minHeight: 48,
    paddingHorizontal: SPACING[3],
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.line.strong,
    backgroundColor: COLORS.paper.raised,
    fontFamily: FONTS.sans,
    fontSize: 17,
    color: COLORS.ink.primary,
  },
  large: {
    fontFamily: FONTS.serif,
    fontSize: 40,
    lineHeight: 48,
    color: COLORS.ink.primary,
    paddingVertical: SPACING[2],
    paddingHorizontal: SPACING[4],
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.line.strong,
    backgroundColor: COLORS.paper.raised,
    fontVariant: ["tabular-nums"],
  },
});
