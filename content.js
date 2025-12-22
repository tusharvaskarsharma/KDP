// Content Script - Passive Learning Tracker
let startTime = Date.now();
let pageTitle = document.title;
let pageUrl = window.location.href;

// Learning domains ko filter karne ke liye
const LEARNING_DOMAINS = [
  'youtube.com/watch',
  'coursera.org',
  'udemy.com',
  'khanacademy.org',
  'edx.org',
  'medium.com',
  'stackoverflow.com',
  'github.com',
  'wikipedia.org',
  'freecodecamp.org'
];

// Check if current page is a learning resource
function isLearningPage() {
  return LEARNING_DOMAINS.some(domain => pageUrl.includes(domain));
}

// Extract meaningful text content
function extractContent() {
  // Remove script, style tags
  const clone = document.body.cloneNode(true);
  clone.querySelectorAll('script, style, nav, footer, header').forEach(el => el.remove());
  
  let text = clone.innerText || '';
  // Limit to 3000 characters to avoid API limits
  return text.slice(0, 3000).trim();
}

// Tab visibility change handler
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    const timeSpent = Math.floor((Date.now() - startTime) / 1000); // seconds
    
    // Only track if spent more than 30 seconds AND it's a learning page
    if (timeSpent >= 30 && isLearningPage()) {
      const content = extractContent();
      
      if (content.length > 100) { // Minimum content threshold
        chrome.runtime.sendMessage({
          action: 'trackLearning',
          data: {
            title: pageTitle,
            url: pageUrl,
            content: content,
            timeSpent: timeSpent,
            timestamp: Date.now()
          }
        });
      }
    }
    
    // Reset timer for next visit
    startTime = Date.now();
  }
});

// Initial message when content script loads
console.log('🧠 KDP Active: Tracking learning sessions...');