// Background Service Worker - The AI Brain

// ⚠️ IMPORTANT: Replace with your actual Gemini API key
const GEMINI_API_KEY = 'AIzaSyAYmMRNR3nFOrfO3xxF5sYgQgBCSMOxFC8';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// Listen to messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'trackLearning') {
    processLearningData(message.data);
  }
  return true; // Important for async response
});

// Process learning data with Gemini AI
async function processLearningData(data) {
  try {
    console.log('📥 Processing learning data:', data.title);
    
    // Call Gemini API
    const analysis = await analyzeWithGemini(data);
    
    if (analysis) {
      // Save to storage with unique ID
      const entry = {
        id: generateId(),
        title: data.title,
        url: data.url,
        timeSpent: data.timeSpent,
        learnedAt: data.timestamp,
        concepts: analysis.concepts,
        summary: analysis.summary,
        complexity: analysis.complexity,
        domain: analysis.domain
      };
      
      await saveLearningEntry(entry);
      console.log('✅ Learning session saved:', entry.concepts);
      
      // Show notification (optional)
      showNotification(entry);
    }
  } catch (error) {
    console.error('❌ Error processing learning:', error);
  }
}

// Gemini AI Analysis
async function analyzeWithGemini(data) {
  // Check if API key is set
  if (GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    console.warn('⚠️ Gemini API key not set. Using fallback analysis.');
    return getFallbackAnalysis(data);
  }

  const prompt = `You are a cognitive learning expert. Analyze this learning content and return a JSON response.

Content Title: ${data.title}
Content: ${data.content.substring(0, 2000)}
Time Spent: ${data.timeSpent} seconds

Return ONLY a valid JSON object with this exact structure (no markdown, no extra text):
{
  "concepts": ["concept1", "concept2", "concept3"],
  "summary": "2-3 sentence summary of what was learned",
  "complexity": 3,
  "domain": "programming"
}

Complexity scale:
1 = Very Simple (basic facts)
2 = Simple (straightforward concepts)
3 = Moderate (requires understanding)
4 = Complex (multiple interconnected ideas)
5 = Very Complex (abstract/advanced concepts)

Extract 3-5 key concepts maximum.`;

  try {
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 500
        }
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.candidates || !result.candidates[0]) {
      throw new Error('Invalid API response');
    }
    
    const text = result.candidates[0].content.parts[0].text;
    
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return validateAnalysis(parsed);
    }
    
    throw new Error('No valid JSON found in response');
  } catch (error) {
    console.error('Gemini API Error:', error.message);
    return getFallbackAnalysis(data);
  }
}

// Fallback analysis when API fails or not configured
function getFallbackAnalysis(data) {
  const title = data.title.toLowerCase();
  let domain = 'general';
  let complexity = 3;
  
  // Simple domain detection
  if (title.includes('python') || title.includes('javascript') || title.includes('code')) {
    domain = 'programming';
    complexity = 4;
  } else if (title.includes('math') || title.includes('calculus') || title.includes('algebra')) {
    domain = 'mathematics';
    complexity = 4;
  } else if (title.includes('tutorial') || title.includes('learn')) {
    complexity = 3;
  }
  
  return {
    concepts: [data.title.substring(0, 50)],
    summary: `Learning session: ${data.title}`,
    complexity: complexity,
    domain: domain
  };
}

// Validate analysis object
function validateAnalysis(analysis) {
  return {
    concepts: Array.isArray(analysis.concepts) ? analysis.concepts.slice(0, 5) : ['General Topic'],
    summary: typeof analysis.summary === 'string' ? analysis.summary : 'Learning session',
    complexity: (analysis.complexity >= 1 && analysis.complexity <= 5) ? analysis.complexity : 3,
    domain: typeof analysis.domain === 'string' ? analysis.domain : 'general'
  };
}

// Save learning entry to storage
async function saveLearningEntry(entry) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get(['learningHistory'], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        
        const history = result.learningHistory || [];
        
        // Check for duplicates (same URL within 5 minutes)
        const isDuplicate = history.some(item => 
          item.url === entry.url && 
          (entry.learnedAt - item.learnedAt) < 300000 // 5 minutes
        );
        
        if (!isDuplicate) {
          history.unshift(entry); // Add to beginning
          
          // Keep only last 100 entries
          const trimmed = history.slice(0, 100);
          
          chrome.storage.local.set({ learningHistory: trimmed }, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        } else {
          console.log('⏭️ Duplicate entry skipped');
          resolve();
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Show notification (optional feature)
function showNotification(entry) {
  if (chrome.notifications) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: '🧠 Learning Tracked',
      message: `"${entry.title.substring(0, 60)}..." - Complexity: ${'⭐'.repeat(entry.complexity)}`,
      priority: 0
    });
  }
}

// Generate unique ID
function generateId() {
  return `learn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Install event - welcome message
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('🎉 Knowledge Decay Predictor installed successfully!');
    console.log('💡 Visit educational sites to start tracking your learning.');
  }
});

console.log('🚀 KDP Background Service Active');