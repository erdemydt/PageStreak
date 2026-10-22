import DateTimePicker from "@react-native-community/datetimepicker";
import { ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import type { BookWithStats } from "../../db/repos/books";
import { COLORS } from "../../themes/colors";
import { SPACING } from "../../themes/spacing";
import { FONTS, TYPE } from "../../themes/typography";
import { formatDate, LONG_DATE } from "../../utils/format";
import BookCover from "../ui/BookCover";
import Chip from "../ui/Chip";
import Hairline from "../ui/Hairline";

export const DAILY_PRESETS = [10, 15, 20, 30, 45, 60];

/** Title and subtitle at the top of every step */
export function StepHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.heading}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

/** A big serif number with its unit, e.g. "20 min a day" */
function MinutesInput({
  value,
  onChange,
  onSubmit,
  label,
  unit,
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  label: string;
  unit: string;
  autoFocus?: boolean;
}) {
  return (
    <View style={styles.minutesRow}>
      <TextInput
        style={styles.numeral}
        value={value}
        onChangeText={(text) => onChange(text.replace(/[^0-9]/g, ""))}
        keyboardType="number-pad"
        maxLength={3}
        returnKeyType="done"
        onSubmitEditing={onSubmit}
        autoFocus={autoFocus}
        selectTextOnFocus
        accessibilityLabel={label}
      />
      <Text style={styles.unit}>{unit}</Text>
    </View>
  );
}

export function NameStep({
  name,
  onChange,
  onSubmit,
  onRestore,
  disabled,
}: {
  name: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onRestore: () => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      <StepHeading
        title={t("intro.name.title")}
        subtitle={t("intro.name.subtitle")}
      />
      <TextInput
        style={styles.nameInput}
        placeholder={t("intro.name.placeholder")}
        placeholderTextColor={COLORS.ink.disabled}
        value={name}
        onChangeText={onChange}
        editable={!disabled}
        autoCapitalize="words"
        autoComplete="given-name"
        returnKeyType="next"
        onSubmitEditing={onSubmit}
        autoFocus
        maxLength={50}
        accessibilityLabel={t("intro.name.placeholder")}
      />
      <Pressable
        onPress={onRestore}
        disabled={disabled}
        accessibilityRole="button"
        hitSlop={8}
        style={({ pressed }) => [styles.linkWrap, pressed && styles.pressed]}
      >
        <Text style={styles.link}>{t("intro.name.restoreBackup")}</Text>
      </Pressable>
    </>
  );
}

export function DailyGoalStep({
  minutes,
  onChange,
  onSubmit,
}: {
  minutes: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <StepHeading
        title={t("intro.daily.title")}
        subtitle={t("intro.daily.subtitle")}
      />
      <MinutesInput
        value={minutes}
        onChange={onChange}
        onSubmit={onSubmit}
        label={t("intro.daily.title")}
        unit={t("intro.daily.unit")}
      />
      <View style={styles.chips}>
        {DAILY_PRESETS.map((preset) => (
          <Chip
            key={preset}
            label={t("duration.minutes", { count: preset })}
            selected={Number(minutes) === preset}
            onPress={() => onChange(String(preset))}
            style={styles.presetChip}
          />
        ))}
      </View>
    </>
  );
}

export function GrowStep({
  daily,
  grow,
  canGrow,
  onChangeGrow,
  target,
  onChangeTarget,
  goalDate,
  onChangeGoalDate,
  minimumDate,
  maximumDate,
  weeklyIncrease,
}: {
  daily: number;
  grow: boolean;
  /** false at the 480-minute cap */
  canGrow: boolean;
  onChangeGrow: (grow: boolean) => void;
  target: string;
  onChangeTarget: (value: string) => void;
  goalDate: Date;
  onChangeGoalDate: (date: Date) => void;
  minimumDate: Date;
  maximumDate: Date;
  /** Minutes added each week, 0 while the target isn't above the daily goal */
  weeklyIncrease: number;
}) {
  const { t } = useTranslation();
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const targetNumber = Number(target);
  // How big each weekly step is next to today's goal
  const stepShare = daily > 0 ? weeklyIncrease / daily : 0;
  const pace =
    stepShare <= 0.1
      ? t("intro.grow.paceGentle")
      : stepShare <= 0.25
        ? t("intro.grow.paceSteady")
        : t("intro.grow.paceSteep");

  return (
    <>
      <StepHeading
        title={t("intro.grow.title")}
        subtitle={t("intro.grow.subtitle")}
      />
      <View style={styles.chips}>
        <Chip
          grow
          label={t("intro.grow.yes")}
          selected={grow}
          disabled={!canGrow}
          onPress={() => onChangeGrow(true)}
        />
        <Chip
          grow
          label={t("intro.grow.no", { minutes: daily })}
          selected={!grow}
          onPress={() => onChangeGrow(false)}
        />
      </View>

      {grow ? (
        <View style={styles.plan}>
          <Field label={t("intro.grow.target")}>
            <MinutesInput
              value={target}
              onChange={onChangeTarget}
              label={t("intro.grow.target")}
              unit={t("intro.daily.unit")}
            />
          </Field>
          <Hairline />
          <View style={styles.dateRow}>
            <Text style={styles.fieldLabel}>{t("intro.grow.date")}</Text>
            {Platform.OS === "ios" ? (
              <DateTimePicker
                value={goalDate}
                mode="date"
                display="compact"
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                accentColor={COLORS.accent.primary}
                accessibilityLabel={t("intro.grow.date")}
                onChange={(event, date) => {
                  if (date && event.type !== "dismissed") onChangeGoalDate(date);
                }}
              />
            ) : (
              <Pressable
                onPress={() => setShowAndroidPicker(true)}
                accessibilityRole="button"
                accessibilityLabel={`${t("intro.grow.date")}, ${formatDate(goalDate, LONG_DATE)}`}
                hitSlop={8}
              >
                <Text style={styles.dateValue}>
                  {formatDate(goalDate, LONG_DATE)}
                </Text>
              </Pressable>
            )}
          </View>
          {showAndroidPicker && (
            <DateTimePicker
              value={goalDate}
              mode="date"
              minimumDate={minimumDate}
              maximumDate={maximumDate}
              onChange={(event, date) => {
                setShowAndroidPicker(false);
                if (date && event.type !== "dismissed") onChangeGoalDate(date);
              }}
            />
          )}
          <Hairline />
          {weeklyIncrease > 0 && targetNumber > daily ? (
            <View style={styles.preview} accessible>
              <Text style={styles.previewHeadline}>
                {t("intro.grow.perWeek", { minutes: weeklyIncrease })}
              </Text>
              <Text style={styles.previewLine}>
                {t("intro.grow.plan", {
                  from: daily,
                  to: targetNumber,
                  date: formatDate(goalDate, LONG_DATE),
                })}
              </Text>
              <Text style={styles.previewLine}>{pace}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <Text style={styles.note}>
          {t("intro.grow.keepNote", { minutes: daily })}
        </Text>
      )}
    </>
  );
}

export function ReminderStep({
  wantsReminders,
  onChange,
}: {
  wantsReminders: boolean;
  onChange: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <StepHeading
        title={t("intro.reminder.title")}
        subtitle={t("intro.reminder.subtitle")}
      />
      <Hairline />
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>{t("intro.reminder.switchLabel")}</Text>
        <Switch
          value={wantsReminders}
          onValueChange={onChange}
          trackColor={{ false: COLORS.line.strong, true: COLORS.accent.primary }}
          ios_backgroundColor={COLORS.line.strong}
          accessibilityLabel={t("intro.reminder.switchLabel")}
        />
      </View>
      <Hairline />
    </>
  );
}

export function FirstBookStep({ books }: { books: BookWithStats[] }) {
  const { t } = useTranslation();
  return (
    <>
      <StepHeading
        title={t("intro.firstBook.title")}
        subtitle={t("intro.firstBook.subtitle")}
      />
      {books.map((book, index) => (
        <View key={book.id}>
          {index > 0 && <Hairline />}
          <View style={styles.bookRow}>
            <BookCover uri={book.cover_url} title={book.name} author={book.author} width={44} />
            <View style={styles.bookText}>
              <Text style={styles.bookTitle} numberOfLines={2}>
                {book.name}
              </Text>
              {book.author ? (
                <Text style={styles.bookAuthor} numberOfLines={1}>
                  {book.author}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      ))}
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    gap: SPACING[3],
  },
  title: TYPE.display,
  subtitle: {
    ...TYPE.body,
    fontSize: 16,
    lineHeight: 23,
  },
  nameInput: {
    fontFamily: FONTS.serif,
    fontSize: 30,
    lineHeight: 38,
    color: COLORS.ink.primary,
    paddingVertical: SPACING[2],
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomColor: COLORS.line.strong,
  },
  linkWrap: {
    alignSelf: "flex-start",
  },
  pressed: {
    opacity: 0.6,
  },
  link: {
    ...TYPE.label,
    color: COLORS.accent.primary,
  },
  minutesRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: SPACING[3],
  },
  numeral: {
    ...TYPE.numeral,
    minWidth: 96,
    paddingVertical: 0,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomColor: COLORS.line.strong,
  },
  unit: TYPE.byline,
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING[2],
  },
  // Three to a row
  presetChip: {
    flexBasis: "30%",
    flexGrow: 1,
  },
  plan: {
    gap: SPACING[3],
  },
  field: {
    gap: SPACING[2],
  },
  fieldLabel: TYPE.label,
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
    gap: SPACING[3],
  },
  dateValue: {
    ...TYPE.label,
    color: COLORS.accent.primary,
  },
  preview: {
    gap: SPACING[1],
  },
  previewHeadline: TYPE.headline,
  previewLine: TYPE.meta,
  note: TYPE.byline,
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 56,
    gap: SPACING[3],
  },
  switchLabel: {
    ...TYPE.label,
    flex: 1,
  },
  bookRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING[3],
    paddingVertical: SPACING[3],
  },
  bookText: {
    flex: 1,
    gap: 2,
  },
  bookTitle: TYPE.headline,
  bookAuthor: TYPE.byline,
});
