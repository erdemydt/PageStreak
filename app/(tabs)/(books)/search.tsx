<<<<<<< HEAD
import { Redirect } from "expo-router";
=======
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Alert,
    Animated,
    FlatList,
    Image,
    Keyboard,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import BookStatusModal, {
    BookStatus,
} from "../../../components/books/BookStatusModal";
import { execute } from "../../../db/db";
import {
    OpenLibraryService,
    SearchBookResult,
} from "../../../services/openLibrary";
import { COLORS } from "../../../themes/colors";
import { SPACING } from "../../../themes/spacing";
import { TYPE } from "../../../themes/typography";
>>>>>>> origin/xccBuild

// Search moved into the Add book sheet (Library "+"; Phase 8.3). Kept so old
// links still land somewhere; remove after a couple of releases.
export default function SearchRedirect() {
  return <Redirect href="/(tabs)/(books)" />;
}
