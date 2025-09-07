# PageStreak - Enhanced Book Library 📚

PageStreak is a React Native app built with Expo that helps you track your reading journey with advanced book discovery and management features.

## New Features Added ✨

### 🔍 Comprehensive Book Search
- **Open Library API Integration**: Search through millions of books using the Open Library API
- **Multiple Search Types**: Search by general query, specific title, or author name
- **Rich Book Information**: Get detailed information including cover images, publication year, publisher, ratings, and subjects
- **Intelligent Search Results**: Books are displayed with covers, metadata, and relevance scoring

### 📖 Enhanced Book Cards
- **Beautiful Book Covers**: Display actual book cover images from Open Library
- **Rich Metadata Display**: Show publication year, publisher, page count, and more
- **Reading Status Tracking**: Track books as "Want to Read", "Currently Reading", or "Read"
- **Reading Progress**: Visual progress bars for books you're currently reading
- **Compact & Full Views**: Optimized layouts for different screen contexts

### 🗄️ Enhanced Database Schema
The app now uses an enhanced SQLite database schema that stores:
- Basic book information (title, author, pages)
- Open Library metadata (ISBN, cover ID, publication year, publisher)
- Reading tracking (status, current page, reading dates)
- Personal notes and ratings
- Book subjects and descriptions

### 🏠 Improved Home Screen
- **Reading Statistics**: See books read, currently reading, and want-to-read counts
- **Beautiful Book Grid**: Display recent books with cover images
- **Progress Tracking**: Visual progress towards yearly reading goals
- **Quick Discovery**: Direct link to book search functionality

## API Integration

### Open Library API
The app integrates with the Open Library API to provide:

```typescript
// Search examples
https://openlibrary.org/search.json?q=the+lord+of+the+rings
https://openlibrary.org/search.json?title=the+lord+of+the+rings
https://openlibrary.org/search.json?author=tolkien&sort=new
```

### Book Covers
Cover images are retrieved using Open Library's cover API:
```typescript
https://covers.openlibrary.org/b/id/{cover_id}-M.jpg
https://covers.openlibrary.org/b/isbn/{isbn}-M.jpg
```

## Technical Implementation

### Key Components

1. **BookSearchModal.tsx** - Advanced search interface with multiple search types
2. **BookCard.tsx** - Reusable book display component with cover images
3. **openLibrary.ts** - Service layer for API integration
4. **Enhanced Database Schema** - Extended SQLite schema for rich book data

### Database Schema

```sql
CREATE TABLE enhanced_books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  author TEXT NOT NULL,
  page INTEGER NOT NULL,
  isbn TEXT,
  cover_id INTEGER,
  cover_url TEXT,
  first_publish_year INTEGER,
  publisher TEXT,
  language TEXT DEFAULT 'eng',
  description TEXT,
  subjects TEXT,
  open_library_key TEXT,
  author_key TEXT,
  rating REAL,
  date_added TEXT DEFAULT CURRENT_TIMESTAMP,
  date_started TEXT,
  date_finished TEXT,
  current_page INTEGER DEFAULT 0,
  reading_status TEXT DEFAULT 'want_to_read',
  notes TEXT
);
```

### Features
- **Offline-First**: All book data is stored locally in SQLite
- **Image Caching**: Book covers are cached for offline viewing
- **Migration Support**: Seamlessly migrates from old book schema
- **Error Handling**: Robust error handling for network requests
- **Loading States**: Beautiful loading animations and states
- **TypeScript**: Fully typed for better development experience

## Usage

### Adding Books
1. **Search Online**: Tap "🔍 Search Books" to discover books via Open Library
2. **Manual Entry**: Tap "✏️ Add Manually" to add books without internet
3. **Multiple Search Types**: Use general, title, or author-specific searches

### Managing Books
- **View Details**: Tap any book to see full information
- **Delete Books**: Swipe or tap delete button to remove books
- **Track Progress**: Update reading status and current page
- **Add Notes**: Personal notes and ratings for each book

### Home Dashboard
- Monitor reading progress towards yearly goals
- Quick access to recently added books
- Statistics on reading habits
- Direct links to book discovery

## Dependencies Added
- Enhanced SQLite schema support
- Image loading and caching
- Network request handling
- Animation libraries (already included with Expo)

This enhanced version transforms PageStreak from a simple book tracker into a comprehensive reading companion with professional-grade book discovery and management capabilities! 🎉
