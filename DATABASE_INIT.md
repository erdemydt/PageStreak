# Database Initialization Documentation

## Overview

The PageStreak app now has a comprehensive centralized database initialization system that ensures all required tables and columns are created when the user first opens the app after installation. The system includes dynamic column checking and schema updates to handle future app updates seamlessly.

## Key Features

### 1. **Column-Level Schema Updates**
- **Dynamic Column Detection**: Checks existing tables for missing columns
- **Safe Column Addition**: Uses `ALTER TABLE ADD COLUMN` to add missing columns
- **Type Safety**: Proper column types and default values are enforced
- **Non-Destructive**: Never removes existing data during updates

### 2. **Database Version Management**
- **Version Tracking**: Maintains database schema version in `database_version` table
- **Incremental Updates**: Only applies necessary changes when version differs
- **Update Detection**: Automatically detects when schema updates are needed

### 3. **Robust Error Handling**
- **Graceful Degradation**: Handles missing tables and columns without crashing
- **Migration Safety**: Preserves existing data during all operations
- **Comprehensive Logging**: Detailed console output for debugging

## Key Changes Made

### 1. Enhanced Database Initialization (`db/db.tsx`)

- **Added `initializeDatabase()` function**: Creates all required tables with proper column checking
- **Added version management**: Tracks database schema version for future updates
- **Added column checking**: Dynamically adds missing columns to existing tables
- **Added initialization flag**: Prevents multiple initialization calls
- **Added migration logic**: Handles upgrading from old `books` table to `enhanced_books`
- **Comprehensive table creation**: All tables created with proper schema and constraints

### 2. Column-Aware Table Creation Functions

- **`createOrUpdateEnhancedBooksTable()`**: Ensures all book-related columns exist
- **`createOrUpdateUserPreferencesTable()`**: Ensures all user preference columns exist  
- **`createOrUpdateReadingSessionsTable()`**: Ensures all reading session columns exist
- **`createOrUpdateWeeklyProgressTable()`**: Ensures all progress tracking columns exist

### 3. Updated Main Entry Point (`app/index.tsx`)

- **Calls `initializeDatabase()`** before any other database operations
- **Proper error handling**: Falls back to intro screen if initialization fails
- **Streamlined user setup flow**: Database is ready before checking user preferences

### 4. Cleaned Up Component Files

- **`app/intro.tsx`**: Removed redundant table creation
- **`app/(tabs)/(books)/index.tsx`**: Removed duplicate table creation
- **`components/ReadingTimeLogger.tsx`**: Removed redundant table creation

## Database Schema

The following tables are created during initialization:

### 1. `enhanced_books`
- Comprehensive book information with Open Library API integration
- Reading status tracking (want_to_read, currently_reading, read)
- Progress tracking with current_page field
- Metadata: ISBN, cover info, publication details

### 2. `user_preferences`
- User profile and reading goals
- Reading rate progression tracking
- Weekly reading targets and increases
- Genre preferences

### 3. `reading_sessions`
- Daily reading time tracking
- Linked to specific books via foreign key
- Notes and session metadata
- Date-based organization

### 5. `database_version`
- Schema version tracking
- Update timestamps
- Enables incremental schema updates

## Column Management System

The initialization system now includes sophisticated column management:

### **Enhanced Books Table**
- **Core columns**: `id`, `name`, `author`, `page`
- **API Integration**: `isbn`, `cover_id`, `cover_url`, `first_publish_year`, `publisher`
- **Metadata**: `language`, `description`, `subjects`, `open_library_key`, `author_key`
- **Reading Progress**: `rating`, `date_added`, `date_started`, `date_finished`, `current_page`
- **Status Tracking**: `reading_status`, `notes`

### **User Preferences Table** 
- **Core**: `id`, `username`, `yearly_book_goal`
- **Preferences**: `preferred_genres`, `created_at`, `updated_at`
- **Reading Goals**: `weekly_reading_goal`, `initial_reading_rate_minutes_per_day`
- **Progress Tracking**: `end_reading_rate_goal_minutes_per_day`, `end_reading_rate_goal_date`
- **Current State**: `current_reading_rate_minutes_per_day`, `current_reading_rate_last_updated`
- **Growth Metrics**: `weekly_reading_rate_increase_minutes`, `weekly_reading_rate_increase_minutes_percentage`

### **Reading Sessions Table**
- **Core**: `id`, `book_id`, `minutes_read`, `date`, `created_at`
- **Additional**: `notes`
- **Relationships**: Foreign key to `enhanced_books`

### **Weekly Progress Table**  
- **Core**: `id`, `weeks_passed`, `target_reading_minutes`, `achieved_reading_minutes`
- **Timestamps**: `date_created`

## How Column Updates Work

1. **Table Creation**: Creates table with minimal required columns if it doesn't exist
2. **Column Detection**: Uses `PRAGMA table_info()` to check existing columns
3. **Missing Column Addition**: Uses `ALTER TABLE ADD COLUMN` for missing columns
4. **Default Value Assignment**: Applies appropriate default values for new columns
5. **Type Enforcement**: Ensures correct SQLite data types for all columns

## Version Management

- **Current Version**: Tracked in code as `CURRENT_DB_VERSION`
- **Version Storage**: Stored in `database_version` table
- **Update Detection**: Compares stored version with current version
- **Incremental Updates**: Only applies changes when version mismatch detected

## Migration Support

- **Backward compatibility**: Automatically migrates data from old `books` table
- **Column-level updates**: Adds missing columns without data loss
- **Non-destructive**: Preserves existing data during all upgrades
- **Error handling**: Gracefully handles missing old tables (new installations)
- **Version tracking**: Prevents unnecessary re-initialization

## Usage

### For App Startup
```tsx
import { initializeDatabase } from '../db/db';

// In your main app component or entry point:
await initializeDatabase();
```

### For Adding New Columns (Future Updates)

1. **Update Column Definitions**: Add new columns to the appropriate `createOrUpdateXTable()` function
2. **Increment Version**: Increase `CURRENT_DB_VERSION` in `db.tsx`
3. **Deploy Update**: The system automatically detects and applies column additions

Example of adding a new column:
```tsx
// In createOrUpdateEnhancedBooksTable()
const requiredColumns: ColumnDefinition[] = [
  // ... existing columns ...
  { name: 'new_column_name', type: 'TEXT', default: "'default_value'" }
];
```

### For Testing
```tsx
import testDatabaseInitialization from '../scripts/test-database-init';

// Verify initialization and column checking works:
const success = await testDatabaseInitialization();
```

## Benefits

1. **Future-Proof**: Handles app updates with new database columns seamlessly
2. **No Data Loss**: Existing data is preserved during all schema updates
3. **Version Control**: Database schema version tracking prevents conflicts
4. **Performance**: Only applies necessary changes, skips redundant operations
5. **Reliability**: All tables and columns guaranteed to exist before app functionality runs
6. **Maintainability**: Single source of truth for database schema
7. **Error Handling**: Comprehensive error catching and logging
8. **Migration Safe**: Handles upgrades from previous app versions

## Schema Update Process

When a user updates the app with new database requirements:

1. **Version Check**: System compares stored DB version with current version
2. **Column Detection**: Checks each table for missing columns
3. **Safe Addition**: Uses `ALTER TABLE ADD COLUMN` to add missing columns
4. **Default Values**: Applies appropriate defaults to new columns
5. **Version Update**: Updates stored version to current version
6. **Logging**: Provides detailed console output of all changes applied

## Best Practices

- **Column Additions Only**: Never remove or modify existing columns in updates
- **Safe Defaults**: Always provide sensible default values for new columns
- **Version Increment**: Always increment `CURRENT_DB_VERSION` when adding columns
- **Test Updates**: Use the test script to verify column additions work correctly
- **Graceful Handling**: System handles both new installations and updates

## Troubleshooting

If you encounter database issues:

1. Check console logs for initialization and column addition messages
2. Use the test script to verify table and column creation
3. Clear app data to force fresh initialization
4. Review error logs for specific schema update failures
5. Check database version with: `SELECT * FROM database_version`

## Future Enhancements

- **Column Type Changes**: Handle column type modifications safely
- **Index Management**: Add automatic index creation for performance
- **Backup/Restore**: Implement database backup before major updates
- **Performance Monitoring**: Track initialization and update performance
- **Migration History**: Log all applied schema changes for debugging

1. **Table Creation**: Creates table with minimal required columns if it doesn't exist
2. **Column Detection**: Uses `PRAGMA table_info()` to check existing columns
3. **Missing Column Addition**: Uses `ALTER TABLE ADD COLUMN` for missing columns
4. **Default Value Assignment**: Applies appropriate default values for new columns
5. **Type Enforcement**: Ensures correct SQLite data types for all columns

## Version Management

- **Current Version**: Tracked in code as `CURRENT_DB_VERSION`
- **Version Storage**: Stored in `database_version` table
- **Update Detection**: Compares stored version with current version
- **Incremental Updates**: Only applies changes when version mismatch detected

- **Backward compatibility**: Automatically migrates data from old `books` table
- **Non-destructive**: Preserves existing data during upgrades
- **Error handling**: Gracefully handles missing old tables (new installations)

## Usage

### For App Startup
```tsx
import { initializeDatabase } from '../db/db';

// In your main app component or entry point:
await initializeDatabase();
```

### For Testing
```tsx
import testDatabaseInitialization from '../scripts/test-database-init';

// Verify initialization works correctly:
const success = await testDatabaseInitialization();
```

## Benefits

1. **Reliability**: All tables guaranteed to exist before app functionality runs
2. **Performance**: One-time initialization with caching flag
3. **Maintainability**: Single source of truth for database schema
4. **Error Handling**: Comprehensive error catching and logging
5. **Migration Safe**: Handles upgrades from previous app versions

## Best Practices

- Database is automatically initialized on app startup
- No need to create tables in individual components
- Use the centralized `execute`, `queryAll`, `queryFirst` functions
- Migration logic handles schema updates transparently

## Troubleshooting

If you encounter database issues:

1. Check console logs for initialization errors
2. Use the test script to verify table creation
3. Clear app data to force fresh initialization
4. Review error logs for specific table creation failures

## Future Enhancements

- Consider adding version tracking for schema migrations
- Add database backup/restore functionality
- Implement database cleanup utilities
- Add performance monitoring for initialization time
