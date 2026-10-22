import { Image } from "expo-image";
import { useState } from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { COLORS } from "../../themes/colors";
import { RADIUS } from "../../themes/spacing";
import { FONTS } from "../../themes/typography";
import { toAppUpperCase } from "../../utils/format";

type Props = {
  uri?: string | null;
  title: string;
  author?: string | null;
  /** Height is 1.5 × width */
  width: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * A book cover with Folio's book-object shadow. Books without a cover image (or
 * whose image fails to load) get a drawn cover: a spine color picked from the
 * title, the title in serif italic, and the author in spaced capitals. The drawn
 * cover also sits under a loading image (Open Library covers redirect to
 * archive.org and can take seconds), so a slow cover never shows a blank tile.
 */
export default function BookCover({ uri, title, author, width, style }: Props) {
  const [failed, setFailed] = useState(false);
  const height = Math.round(width * 1.5);
  const size = { width, height };

  return (
    <View
      style={[styles.frame, size, style]}
      accessibilityRole="image"
      accessibilityLabel={title}
    >
      <View
        style={[
          styles.drawn,
          size,
          {
            backgroundColor: spineColor(title),
            paddingVertical: width * 0.14,
            paddingHorizontal: width * 0.09,
          },
        ]}
      >
        <Text
          style={[styles.drawnTitle, { fontSize: Math.max(10, width * 0.19) }]}
          numberOfLines={3}
          adjustsFontSizeToFit
        >
          {title}
        </Text>
        {author ? (
          <Text
            style={[
              styles.drawnAuthor,
              { fontSize: Math.max(5, width * 0.075) },
            ]}
            numberOfLines={2}
          >
            {toAppUpperCase(author)}
          </Text>
        ) : null}
      </View>
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={[styles.image, size]}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={150}
          onError={() => setFailed(true)}
        />
      ) : null}
      <View style={styles.spineHighlight} pointerEvents="none" />
    </View>
  );
}

function spineColor(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = (hash * 31 + title.charCodeAt(i)) | 0;
  }
  return COLORS.cover.spines[Math.abs(hash) % COLORS.cover.spines.length];
}

const styles = StyleSheet.create({
  frame: {
    borderTopLeftRadius: RADIUS.cover - 1,
    borderBottomLeftRadius: RADIUS.cover - 1,
    borderTopRightRadius: RADIUS.cover + 2,
    borderBottomRightRadius: RADIUS.cover + 2,
    backgroundColor: COLORS.paper.sunken,
    shadowColor: COLORS.ink.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 6,
  },
  image: {
    position: "absolute",
    top: 0,
    left: 0,
    borderTopLeftRadius: RADIUS.cover - 1,
    borderBottomLeftRadius: RADIUS.cover - 1,
    borderTopRightRadius: RADIUS.cover + 2,
    borderBottomRightRadius: RADIUS.cover + 2,
  },
  drawn: {
    borderTopLeftRadius: RADIUS.cover - 1,
    borderBottomLeftRadius: RADIUS.cover - 1,
    borderTopRightRadius: RADIUS.cover + 2,
    borderBottomRightRadius: RADIUS.cover + 2,
    justifyContent: "space-between",
    alignItems: "center",
  },
  drawnTitle: {
    fontFamily: FONTS.serifItalic,
    color: COLORS.cover.ink,
    textAlign: "center",
  },
  drawnAuthor: {
    fontFamily: FONTS.sansMedium,
    letterSpacing: 1.2,
    color: COLORS.cover.ink,
    textAlign: "center",
  },
  // The crease where the cover meets the spine
  spineHighlight: {
    position: "absolute",
    left: 4,
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth * 2,
    backgroundColor: COLORS.cover.crease,
  },
});
