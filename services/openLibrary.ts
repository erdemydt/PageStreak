// Open Library API service

export interface OpenLibrarySearchResult {
  numFound: number;
  start: number;
  numFoundExact: boolean;
  docs: OpenLibraryDoc[];
}

export interface OpenLibraryDoc {
  key: string;
  title: string;
  author_name?: string[];
  author_key?: string[];
  first_publish_year?: number;
  number_of_pages_median?: number;
  cover_i?: number;
  publisher?: string[];
  language?: string[];
  isbn?: string[];
  subject?: string[];
  ia?: string[];
  public_scan_b?: boolean;
  has_fulltext?: boolean;
  edition_count?: number;
  ratings_average?: number;
  ratings_count?: number;
  want_to_read_count?: number;
  currently_reading_count?: number;
  already_read_count?: number;
}

export interface SearchBookResult {
  key: string;
  title: string;
  authors: string[];
  firstPublishYear?: number;
  pageCount?: number;
  coverId?: number;
  coverUrl?: string;
  publisher?: string;
  language?: string;
  isbn?: string;
  subjects?: string[];
  description?: string;
  rating?: number;
  ratingsCount?: number;
}

const BASE_URL = 'https://openlibrary.org';
const COVERS_URL = 'https://covers.openlibrary.org';

export class OpenLibraryService {
  /**
   * Search for books using the Open Library API
   */
  static async searchBooks(query: string, limit: number = 20): Promise<SearchBookResult[]> {
    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `${BASE_URL}/search.json?q=${encodedQuery}&limit=${limit}&fields=key,title,author_name,author_key,first_publish_year,number_of_pages_median,cover_i,publisher,language,isbn,subject,ratings_average,ratings_count`;
      
      console.log('Searching Open Library:', url);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: OpenLibrarySearchResult = await response.json();
      
      return data.docs.map(doc => ({
        key: doc.key,
        title: doc.title || 'Unknown Title',
        authors: doc.author_name || ['Unknown Author'],
        firstPublishYear: doc.first_publish_year,
        pageCount: doc.number_of_pages_median,
        coverId: doc.cover_i,
        coverUrl: doc.cover_i ? `${COVERS_URL}/b/id/${doc.cover_i}-M.jpg` : undefined,
        publisher: doc.publisher?.[0],
        language: doc.language?.[0] || 'eng',
        isbn: doc.isbn?.[0],
        subjects: doc.subject?.slice(0, 5), // Limit subjects to first 5
        rating: doc.ratings_average,
        ratingsCount: doc.ratings_count,
      }));
    } catch (error) {
      console.error('Error searching books:', error);
      throw new Error('Failed to search books. Please check your internet connection.');
    }
  }

  /**
   * Search by title specifically
   */
  static async searchByTitle(title: string, limit: number = 10): Promise<SearchBookResult[]> {
    try {
      const encodedTitle = encodeURIComponent(title);
      const url = `${BASE_URL}/search.json?title=${encodedTitle}&limit=${limit}&fields=key,title,author_name,author_key,first_publish_year,number_of_pages_median,cover_i,publisher,language,isbn,subject,ratings_average,ratings_count`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: OpenLibrarySearchResult = await response.json();
      
      return data.docs.map(doc => ({
        key: doc.key,
        title: doc.title || 'Unknown Title',
        authors: doc.author_name || ['Unknown Author'],
        firstPublishYear: doc.first_publish_year,
        pageCount: doc.number_of_pages_median,
        coverId: doc.cover_i,
        coverUrl: doc.cover_i ? `${COVERS_URL}/b/id/${doc.cover_i}-M.jpg` : undefined,
        publisher: doc.publisher?.[0],
        language: doc.language?.[0] || 'eng',
        isbn: doc.isbn?.[0],
        subjects: doc.subject?.slice(0, 5),
        rating: doc.ratings_average,
        ratingsCount: doc.ratings_count,
      }));
    } catch (error) {
      console.error('Error searching by title:', error);
      throw new Error('Failed to search books by title.');
    }
  }

  /**
   * Search by author specifically
   */
  static async searchByAuthor(author: string, limit: number = 10): Promise<SearchBookResult[]> {
    try {
      const encodedAuthor = encodeURIComponent(author);
      const url = `${BASE_URL}/search.json?author=${encodedAuthor}&limit=${limit}&fields=key,title,author_name,author_key,first_publish_year,number_of_pages_median,cover_i,publisher,language,isbn,subject,ratings_average,ratings_count`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: OpenLibrarySearchResult = await response.json();
      
      return data.docs.map(doc => ({
        key: doc.key,
        title: doc.title || 'Unknown Title',
        authors: doc.author_name || ['Unknown Author'],
        firstPublishYear: doc.first_publish_year,
        pageCount: doc.number_of_pages_median,
        coverId: doc.cover_i,
        coverUrl: doc.cover_i ? `${COVERS_URL}/b/id/${doc.cover_i}-M.jpg` : undefined,
        publisher: doc.publisher?.[0],
        language: doc.language?.[0] || 'eng',
        isbn: doc.isbn?.[0],
        subjects: doc.subject?.slice(0, 5),
        rating: doc.ratings_average,
        ratingsCount: doc.ratings_count,
      }));
    } catch (error) {
      console.error('Error searching by author:', error);
      throw new Error('Failed to search books by author.');
    }
  }

  /**
   * Get book cover URL by cover ID
   */
  static getCoverUrl(coverId: number, size: 'S' | 'M' | 'L' = 'M'): string {
    return `${COVERS_URL}/b/id/${coverId}-${size}.jpg`;
  }

  /**
   * Get book cover URL by ISBN
   */
  static getCoverUrlByIsbn(isbn: string, size: 'S' | 'M' | 'L' = 'M'): string {
    return `${COVERS_URL}/b/isbn/${isbn}-${size}.jpg`;
  }

  /**
   * Get author image URL by author key
   */
  static getAuthorImageUrl(authorKey: string, size: 'S' | 'M' | 'L' = 'M'): string {
    return `${COVERS_URL}/a/olid/${authorKey}-${size}.jpg`;
  }

  /**
   * Get work details by work key
   */
  static async getWorkDetails(workKey: string): Promise<any> {
    try {
      const url = `${BASE_URL}${workKey}.json`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching work details:', error);
      return null;
    }
  }

  /**
   * Extract description from work details
   */
  static extractDescription(workData: any): string | undefined {
    if (!workData?.description) return undefined;
    
    if (typeof workData.description === 'string') {
      return workData.description;
    }
    
    if (workData.description?.value) {
      return workData.description.value;
    }
    
    return undefined;
  }
}
