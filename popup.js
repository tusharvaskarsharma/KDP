// Popup Dashboard Logic

let currentFilter = 'all';

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
  loadLearningData();
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  // Filter tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.dataset.filter;
      loadLearningData();
    });
  });

  // Clear button
  document.getElementById('clearBtn').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all learning data?')) {
      chrome.storage.local.set({ learningHistory: [] }, () => {
        loadLearningData();
      });
    }
  });
}

// Load and display learning data
function loadLearningData() {
  chrome.storage.local.get(['learningHistory'], (result) => {
    const history = result.learningHistory || [];
    
    if (history.length === 0) {
      showEmptyState();
      return;
    }

    // Calculate memory retention for each entry
    const enrichedHistory = history.map(entry => ({
      ...entry,
      memoryScore: calculateMemoryRetention(entry)
    }));

    // Update stats
    updateStats(enrichedHistory);

    // Filter and display
    const filtered = filterEntries(enrichedHistory, currentFilter);
    displayMemoryCards(filtered);
  });
}

// Calculate memory retention using forgetting curve
function calculateMemoryRetention(entry) {
  const now = Date.now();
  const hoursPassed = (now - entry.learnedAt) / (1000 * 60 * 60);
  
  // Calculate half-life based on complexity
  const halfLife = getHalfLife(entry.complexity);
  
  // Exponential decay formula: R = 100 * 0.5^(t/h)
  const retention = 100 * Math.pow(0.5, hoursPassed / halfLife);
  
  return Math.max(0, Math.min(100, retention)); // Clamp between 0-100
}

// Get half-life hours based on complexity
function getHalfLife(complexity) {
  const halfLifeMap = {
    1: 72, // 3 days - Very Simple
    2: 48, // 2 days - Simple
    3: 36, // 1.5 days - Moderate
    4: 24, // 1 day - Complex
    5: 18  // 18 hours - Very Complex
  };
  return halfLifeMap[complexity] || 36;
}

// Filter entries based on memory score
function filterEntries(entries, filter) {
  if (filter === 'all') return entries;
  
  return entries.filter(entry => {
    const score = entry.memoryScore;
    if (filter === 'strong') return score >= 80;
    if (filter === 'review') return score >= 50 && score < 80;
    if (filter === 'forgotten') return score < 50;
    return true;
  });
}

// Update statistics
function updateStats(entries) {
  const total = entries.length;
  const needsReview = entries.filter(e => e.memoryScore < 50).length;
  const avgMemory = entries.reduce((sum, e) => sum + e.memoryScore, 0) / total;

  document.getElementById('totalLearned').textContent = total;
  document.getElementById('needsReview').textContent = needsReview;
  document.getElementById('avgMemory').textContent = Math.round(avgMemory) + '%';
}

// Display memory cards
function displayMemoryCards(entries) {
  const container = document.getElementById('memoryList');
  const emptyState = document.getElementById('emptyState');

  if (entries.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';
  
  container.innerHTML = entries.map(entry => {
    const memoryClass = getMemoryClass(entry.memoryScore);
    const timeAgo = getTimeAgo(entry.learnedAt);
    const complexityStars = '⭐'.repeat(entry.complexity);
    
    return `
      <div class="memory-card ${memoryClass}">
        <div class="card-header">
          <div class="memory-score">${Math.round(entry.memoryScore)}%</div>
          <div class="complexity" title="Complexity: ${entry.complexity}/5">${complexityStars}</div>
        </div>
        
        <h3 class="card-title">${truncate(entry.title, 60)}</h3>
        
        <div class="concepts">
          ${entry.concepts.map(c => `<span class="concept-tag">${c}</span>`).join('')}
        </div>
        
        <p class="card-summary">${truncate(entry.summary, 120)}</p>
        
        <div class="card-footer">
          <span class="time-ago">${timeAgo}</span>
          <span class="domain-tag">${entry.domain}</span>
        </div>
        
        <a href="${entry.url}" target="_blank" class="card-link">
          View Original →
        </a>
      </div>
    `;
  }).join('');
}

// Get memory class for styling
function getMemoryClass(score) {
  if (score >= 80) return 'memory-strong';
  if (score >= 50) return 'memory-review';
  return 'memory-forgotten';
}

// Format time ago
function getTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// Truncate text
function truncate(text, maxLength) {
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
}

// Show empty state
function showEmptyState() {
  document.getElementById('memoryList').innerHTML = '';
  document.getElementById('emptyState').style.display = 'flex';
  document.getElementById('totalLearned').textContent = '0';
  document.getElementById('needsReview').textContent = '0';
  document.getElementById('avgMemory').textContent = '0%';
}