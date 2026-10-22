<<<<<<< HEAD
import { Redirect } from "expo-router";
=======
import { Ionicons } from "@expo/vector-icons";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Alert,
    Animated,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import BookCard from "../../../components/books/BookCard";
import BookStatusModal, {
    BookStatus,
} from "../../../components/books/BookStatusModal";
import { EnhancedBook, execute, queryAll } from "../../../db/db";
import { COLORS } from "../../../themes/colors";
import { SPACING } from "../../../themes/spacing";
import { TYPE } from "../../../themes/typography";
import {
    getBookReadingTime,
    initializeReadingSessions,
} from "../../../utils/readingProgress";
>>>>>>> origin/xccBuild

// Merged into the Library (Phase 8.3). Kept so old links still land somewhere;
// remove after a couple of releases.
export default function MyBooksRedirect() {
  return <Redirect href="/(tabs)/(books)" />;
}
