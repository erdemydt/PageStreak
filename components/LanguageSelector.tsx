import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLanguage } from "../contexts/LanguageContext";
import { COLORS } from "../themes/colors";

const languages = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "tr", name: "Türkçe", flag: "🇹🇷" },
];

interface LanguageSelectorProps {
  showLabels?: boolean;
}

export default function LanguageSelector({
  showLabels = true,
}: LanguageSelectorProps) {
  const { currentLanguage, changeLanguage } = useLanguage();

  return (
    <View style={styles.container}>
      {showLabels && <Text style={styles.title}>Language / Dil</Text>}
      <View style={styles.languageList}>
        {languages.map((language) => (
          <TouchableOpacity
            key={language.code}
            style={[
              styles.languageItem,
              currentLanguage === language.code && styles.selectedLanguage,
            ]}
            onPress={() => changeLanguage(language.code)}
          >
            <View style={styles.languageInfo}>
              <Text style={styles.flag}>{language.flag}</Text>
              <Text
                style={[
                  styles.languageName,
                  currentLanguage === language.code && styles.selectedText,
                ]}
              >
                {language.name}
              </Text>
            </View>
            {currentLanguage === language.code && (
              <Ionicons name="checkmark" size={20} color={COLORS.primary} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.neutral[700],
    marginBottom: 16,
  },
  languageList: {
    gap: 8,
  },
  languageItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: COLORS.neutral[50],
  },
  selectedLanguage: {
    backgroundColor: COLORS.state.primarySoft,
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  languageInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  flag: {
    fontSize: 24,
    marginRight: 12,
  },
  languageName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.neutral[700],
  },
  selectedText: {
    color: COLORS.primary,
  },
});
