// Popup Dashboard Logic
console.log('🎨 Popup loaded');

let currentFilter = 'all';

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ DOM loaded, initializing...');
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

  // Export button
  document.getElementById('exportBtn').addEventListener('click', exportData);
  
  // Import button
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  
  document.getElementById('importFile').addEventListener('change', importData);

  // Clear button
  document.getElementById('clearBtn').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all learning data? Consider exporting first!')) {
      chrome.storage.local.set({ learningHistory: [] }, () => {
        showToast('🧹 All data cleared');
        loadLearningData();
      });
    }
  });
}

// Load and display learning data
function loadLearningData() {
  console.log('📊 Loading learning data...');
  
  chrome.storage.local.get(['learningHistory'], (result) => {
    const history = result.learningHistory || [];
    console.log(`Found ${history.length} topics in storage`);
    
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
    console.log(`Displaying ${filtered.length} filtered topics`);
    displayMemoryCards(filtered);
  });
}

// Calculate memory retention using forgetting curve
function calculateMemoryRetention(entry) {
  const now = Date.now();
  const hoursPassed = (now - entry.learnedAt) / (1000 * 60 * 60);
  const halfLife = getHalfLife(entry.complexity);
  const retention = 100 * Math.pow(0.5, hoursPassed / halfLife);
  return Math.max(0, Math.min(100, retention));
}

// Get half-life hours based on complexity
function getHalfLife(complexity) {
  const halfLifeMap = { 1: 72, 2: 48, 3: 36, 4: 24, 5: 18 };
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
  const avgMemory = total > 0 ? entries.reduce((sum, e) => sum + e.memoryScore, 0) / total : 0;

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
  
  // Clear existing content
  container.innerHTML = '';
  
  // Create cards
  entries.forEach(entry => {
    const card = createMemoryCard(entry);
    container.appendChild(card);
  });
  
  console.log(`✅ ${entries.length} cards rendered with event listeners`);
}

// Create a single memory card element
function createMemoryCard(entry) {
  const memoryClass = getMemoryClass(entry.memoryScore);
  const timeAgo = getTimeAgo(entry.learnedAt);
  const complexityStars = '⭐'.repeat(entry.complexity);
  const reviewCount = entry.reviewCount || 0;
  const hasSubtopics = entry.subtopics && entry.subtopics.length > 0;
  const subtopicCount = hasSubtopics ? entry.subtopics.length : 0;
  
  // Create card element
  const card = document.createElement('div');
  card.className = `memory-card ${memoryClass}`;
  card.dataset.id = entry.id;
  
  card.innerHTML = `
    <div class="card-header">
      <div class="memory-score">${Math.round(entry.memoryScore)}%</div>
      <div class="complexity" title="Complexity: ${entry.complexity}/5">${complexityStars}</div>
    </div>
    
    <h3 class="card-title">${escapeHtml(truncate(entry.mainTopic, 60))}</h3>
    
    ${hasSubtopics ? `
      <div class="subtopic-badge">
        📚 ${subtopicCount} related topic${subtopicCount > 1 ? 's' : ''}
      </div>
    ` : ''}
    
    <div class="concepts">
      ${entry.concepts.map(c => `<span class="concept-tag">${escapeHtml(truncate(c, 30))}</span>`).join('')}
    </div>
    
    <p class="card-summary">${escapeHtml(truncate(entry.summary, 120))}</p>
    
    <div class="card-footer">
      <span class="time-ago">${timeAgo}</span>
      <span class="domain-tag">${escapeHtml(entry.domain)}</span>
      ${reviewCount > 0 ? `<span class="review-badge">📚 ${reviewCount}</span>` : ''}
    </div>
    
    ${hasSubtopics ? `
      <div class="subtopics-container" style="display: none;">
        <!-- Subtopics will be inserted here -->
      </div>
    ` : ''}
    
    <div class="card-actions"></div>
  `;
  
  // Add action buttons with event listeners
  const actionsDiv = card.querySelector('.card-actions');
  
  // Expand button (only if has subtopics)
  if (hasSubtopics) {
    const expandBtn = document.createElement('button');
    expandBtn.className = 'action-btn btn-expand';
    expandBtn.textContent = '📖 View Topics';
    expandBtn.addEventListener('click', () => {
      toggleSubtopics(card, entry);
    });
    actionsDiv.appendChild(expandBtn);
  }
  
  // View button (link)
  const viewLink = document.createElement('a');
  viewLink.href = entry.url;
  viewLink.target = '_blank';
  viewLink.className = 'action-btn btn-view';
  viewLink.textContent = 'View Original →';
  actionsDiv.appendChild(viewLink);
  
  // Restore button (only for forgotten topics)
  if (entry.memoryScore < 50) {
    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'action-btn btn-restore';
    restoreBtn.textContent = '💪 I Remember!';
    restoreBtn.addEventListener('click', () => {
      console.log('🔄 Restoring memory for:', entry.id);
      restoreMemory(entry.id);
    });
    actionsDiv.appendChild(restoreBtn);
  }
  
  // Delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'action-btn btn-delete';
  deleteBtn.textContent = '🗑️ Remove';
  deleteBtn.addEventListener('click', () => {
    console.log('🗑️ Deleting topic:', entry.id);
    deleteTopic(entry.id);
  });
  actionsDiv.appendChild(deleteBtn);
  
  return card;
}

// NEW: Toggle subtopics visibility
function toggleSubtopics(cardElement, entry) {
  const container = cardElement.querySelector('.subtopics-container');
  const expandBtn = cardElement.querySelector('.btn-expand');
  
  if (container.style.display === 'none') {
    // Show subtopics
    container.innerHTML = '';
    
    entry.subtopics.forEach(subtopic => {
      const subCard = createSubtopicCard(subtopic);
      container.appendChild(subCard);
    });
    
    container.style.display = 'block';
    expandBtn.textContent = '📕 Hide Topics';
  } else {
    // Hide subtopics
    container.style.display = 'none';
    expandBtn.textContent = '📖 View Topics';
  }
}

// NEW: Create subtopic card
function createSubtopicCard(subtopic) {
  const memoryScore = calculateMemoryRetention(subtopic);
  const memoryClass = getMemoryClass(memoryScore);
  const timeAgo = getTimeAgo(subtopic.learnedAt);
  const complexityStars = '⭐'.repeat(subtopic.complexity);
  
  const subCard = document.createElement('div');
  subCard.className = `subtopic-card ${memoryClass}`;
  
  subCard.innerHTML = `
    <div class="subtopic-header">
      <div class="subtopic-score">${Math.round(memoryScore)}%</div>
      <div class="subtopic-complexity">${complexityStars}</div>
    </div>
    
    <h4 class="subtopic-title">${escapeHtml(truncate(subtopic.title, 80))}</h4>
    
    <div class="subtopic-concepts">
      ${subtopic.concepts.map(c => `<span class="mini-concept">${escapeHtml(truncate(c, 25))}</span>`).join('')}
    </div>
    
    <p class="subtopic-summary">${escapeHtml(truncate(subtopic.summary, 100))}</p>
    
    <div class="subtopic-footer">
      <span class="subtopic-time">${timeAgo}</span>
      <a href="${subtopic.url}" target="_blank" class="subtopic-link">View →</a>
    </div>
  `;
  
  return subCard;
}

// Delete topic
function deleteTopic(topicId) {
  if (!confirm('Are you sure you want to remove this topic?')) {
    return;
  }
  
  console.log('Sending delete message for:', topicId);
  
  chrome.runtime.sendMessage({
    action: 'deleteTopic',
    id: topicId
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('❌ Delete error:', chrome.runtime.lastError);
      showToast('❌ Error deleting topic');
    } else {
      console.log('✅ Topic deleted successfully');
      showToast('🗑️ Topic removed successfully!');
      setTimeout(() => loadLearningData(), 300);
    }
  });
}

// Restore memory strength
function restoreMemory(topicId) {
  console.log('Sending restore message for:', topicId);
  
  chrome.runtime.sendMessage({
    action: 'updateMemory',
    id: topicId
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('❌ Restore error:', chrome.runtime.lastError);
      showToast('❌ Error updating memory');
    } else {
      console.log('✅ Memory updated successfully');
      showToast('✅ Memory updated! Topic moved to Strong category.');
      setTimeout(() => loadLearningData(), 300);
    }
  });
}

// Show toast notification
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
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

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Show empty state
function showEmptyState() {
  document.getElementById('memoryList').innerHTML = '';
  document.getElementById('emptyState').style.display = 'flex';
  document.getElementById('totalLearned').textContent = '0';
  document.getElementById('needsReview').textContent = '0';
  document.getElementById('avgMemory').textContent = '0%';
}

// NEW: Export data to JSON file
function exportData() {
  chrome.storage.local.get(['learningHistory'], (result) => {
    const history = result.learningHistory || [];
    
    if (history.length === 0) {
      showToast('❌ No data to export');
      return;
    }
    
    // Create export object with metadata
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      totalTopics: history.length,
      data: history
    };
    
    // Convert to JSON
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kdp-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast(`✅ Exported ${history.length} topics successfully!`);
    console.log('📤 Data exported:', exportData);
  });
}

// NEW: Import data from JSON file
function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  
  reader.onload = (e) => {
    try {
      const importedData = JSON.parse(e.target.result);
      
      // Validate data structure
      if (!importedData.data || !Array.isArray(importedData.data)) {
        throw new Error('Invalid file format');
      }
      
      // Ask user: Merge or Replace
      const action = confirm(
        `Found ${importedData.totalTopics} topics from ${new Date(importedData.exportDate).toLocaleDateString()}\n\n` +
        'Click OK to MERGE with existing data\n' +
        'Click Cancel to REPLACE all data'
      );
      
      chrome.storage.local.get(['learningHistory'], (result) => {
        let finalData;
        
        if (action) {
          // MERGE: Combine with existing data
          const existing = result.learningHistory || [];
          const imported = importedData.data;
          
          // Merge by ID, prioritize imported data
          const mergedMap = new Map();
          existing.forEach(item => mergedMap.set(item.id, item));
          imported.forEach(item => mergedMap.set(item.id, item));
          
          finalData = Array.from(mergedMap.values());
          showToast(`✅ Merged! Total: ${finalData.length} topics`);
        } else {
          // REPLACE: Use only imported data
          finalData = importedData.data;
          showToast(`✅ Replaced with ${finalData.length} topics`);
        }
        
        // Save to storage
        chrome.storage.local.set({ learningHistory: finalData }, () => {
          loadLearningData();
          console.log('📥 Data imported successfully');
        });
      });
      
    } catch (error) {
      console.error('Import error:', error);
      showToast('❌ Invalid file format');
    }
  };
  
  reader.readAsText(file);
  
  // Reset file input
  event.target.value = '';
}

// NEW: Auto-backup to cloud (optional enhancement)
function autoBackup() {
  chrome.storage.local.get(['learningHistory', 'lastBackup'], (result) => {
    const history = result.learningHistory || [];
    const lastBackup = result.lastBackup || 0;
    const now = Date.now();
    
    // Auto-backup every 7 days
    if (now - lastBackup > 7 * 24 * 60 * 60 * 1000 && history.length > 0) {
      console.log('🔄 Auto-backup triggered');
      exportData();
      chrome.storage.local.set({ lastBackup: now });
    }
  });
}
