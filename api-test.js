// Quick API test - you can run this in Node.js to test the Open Library API
const testOpenLibraryAPI = async () => {
  try {
    console.log('Testing Open Library API...\n');
    
    // Test general search
    console.log('1. Testing general search for "Harry Potter":');
    const response1 = await fetch('https://openlibrary.org/search.json?q=harry+potter&limit=3&fields=key,title,author_name,cover_i,first_publish_year');
    const data1 = await response1.json();
    console.log(`Found ${data1.numFound} books`);
    data1.docs.forEach((book, index) => {
      console.log(`  ${index + 1}. ${book.title} by ${book.author_name?.join(', ') || 'Unknown'}`);
      if (book.cover_i) {
        console.log(`     Cover: https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`);
      }
    });
    
    // Test title search
    console.log('\n2. Testing title search for "The Lord of the Rings":');
    const response2 = await fetch('https://openlibrary.org/search.json?title=the+lord+of+the+rings&limit=2&fields=key,title,author_name,cover_i,first_publish_year,number_of_pages_median,publisher');
    const data2 = await response2.json();
    console.log(`Found ${data2.numFound} books`);
    data2.docs.forEach((book, index) => {
      console.log(`  ${index + 1}. ${book.title} by ${book.author_name?.join(', ') || 'Unknown'}`);
      console.log(`     Year: ${book.first_publish_year || 'Unknown'}, Pages: ${book.number_of_pages_median || 'Unknown'}`);
      console.log(`     Publisher: ${book.publisher?.[0] || 'Unknown'}`);
    });
    
    // Test author search
    console.log('\n3. Testing author search for "Stephen King":');
    const response3 = await fetch('https://openlibrary.org/search.json?author=stephen+king&limit=3&fields=key,title,author_name,cover_i,first_publish_year');
    const data3 = await response3.json();
    console.log(`Found ${data3.numFound} books`);
    data3.docs.forEach((book, index) => {
      console.log(`  ${index + 1}. ${book.title} (${book.first_publish_year || 'Unknown year'})`);
    });
    
    console.log('\n✅ API tests completed successfully!');
    
  } catch (error) {
    console.error('❌ API test failed:', error);
  }
};

// Uncomment the line below to run the test
// testOpenLibraryAPI();

console.log(`
🔍 PageStreak Enhanced Book Search API Test

This file demonstrates how the Open Library API integration works.
To test the API, uncomment the last line and run:

node api-test.js

The API provides:
- General search across titles, authors, and content
- Title-specific search
- Author-specific search
- Rich metadata including covers, publication info, ratings
- Cover images at different sizes (S, M, L)

Example URLs:
- General: https://openlibrary.org/search.json?q=harry+potter
- Title: https://openlibrary.org/search.json?title=harry+potter
- Author: https://openlibrary.org/search.json?author=jk+rowling
- Cover: https://covers.openlibrary.org/b/id/8739161-M.jpg
`);

export default testOpenLibraryAPI;
