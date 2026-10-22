# PageStreak - Enhanced Book Library 📚

PageStreak is a React Native app built with Expo that helps you track your reading journey with advanced book discovery and management features. Download: https://apps.apple.com/tr/app/pagestreak/id6752559360

## New Features Added ✨

### 🔍 Comprehensive Book Search
- **Open Library API Integration**: Search through millions of books using the Open Library API
- **Multiple Search Types**: Search by general query, specific title, or author name

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


### Features
- **Offline-First**: All book data is stored locally 
- **Migration Support**: Seamlessly migrates from old book schema

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
