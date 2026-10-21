import { Alert } from "react-native";
import { listBooksWithStats } from "../db/repos/books";
import { logSession } from "../db/repos/sessions";
import { dateToLocalDateString } from "./dateUtils";
import { isDevModeEnabled } from "./devMode";
import { log } from "./logger";

// Development utility function to generate random reading data
export const generateRandomReadingData = async (): Promise<void> => {
  try {
    // Check if we're in development mode
    if (!isDevModeEnabled()) {
      log("⚠️ Random data generation is only available in development mode");
      return;
    }

    // Get currently reading books
    const currentlyReadingBooks = await listBooksWithStats({
      status: "currently_reading",
      order: "started",
    });

    if (currentlyReadingBooks.length === 0) {
      Alert.alert(
        "No Currently Reading Books",
        'Please add some books with "currently reading" status first.',
      );
      return;
    }

    // Generate 20 random reading sessions
    const sessions = [];
    const today = new Date();

    for (let i = 0; i < 20; i++) {
      // Generate random date within the last 30 days
      const daysBack = Math.floor(Math.random() * 30);
      const sessionDate = new Date(today);
      sessionDate.setDate(today.getDate() - daysBack);

      // Generate random time between 1-5 PM (13:00-17:00)
      const hour = 13 + Math.floor(Math.random() * 4); // 13, 14, 15, or 16
      const minute = Math.floor(Math.random() * 60);
      sessionDate.setHours(hour, minute, 0, 0);

      // Random reading time between 1-20 minutes
      const minutesRead = 1 + Math.floor(Math.random() * 20);

      // Random book selection
      const randomBook =
        currentlyReadingBooks[
          Math.floor(Math.random() * currentlyReadingBooks.length)
        ];

      // Format date as YYYY-MM-DD using local timezone
      const dateString = dateToLocalDateString(sessionDate);

      // Create session with timestamp including hour
      const createdAt = sessionDate.toISOString();

      sessions.push({
        book_id: randomBook.id,
        minutes_read: minutesRead,
        date: dateString,
        created_at: createdAt,
        notes: null,
      });
    }

    // Insert all sessions into the database
    for (const session of sessions) {
      await logSession({
        bookId: session.book_id,
        minutes: session.minutes_read,
        date: session.date,
        createdAt: session.created_at,
      });
    }

    log(`✅ Generated ${sessions.length} random reading sessions`);
    Alert.alert(
      "Random Data Generated",
      `Successfully added ${sessions.length} random reading sessions across different days and hours.`,
    );
  } catch (error) {
    console.error("❌ Error generating random data:", error);
    Alert.alert("Error", "Failed to generate random reading data");
  }
};
