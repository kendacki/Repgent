// popup.js - FINAL STABLE VERSION (Memory & Copy Fixed)

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize & Restore Settings (MEMORY RESTORE)
  chrome.storage.local.get(['geminiKey', 'lastReply', 'lastTone', 'lastInstructions', 'lastSentiment'], (result) => {
    if (result.geminiKey) document.getElementById('apiKey').value = result.geminiKey;
    if (result.lastInstructions) document.getElementById('customInstructions').value = result.lastInstructions;
    
    // Restore Tone
    if (result.lastTone) {
      document.getElementById('toneSelector').value = result.lastTone;
      const matchingOption = document.querySelector(`.custom-option[data-value="${result.lastTone}"]`);
      if (matchingOption) updateCustomSelectUI(matchingOption.dataset.icon, matchingOption.dataset.label);
    }
    
    // Restore Last Reply (THE MEMORY FIX)
    if (result.lastReply && result.lastReply.trim() !== "") {
      document.getElementById('output').value = result.lastReply;
      
      if (result.lastSentiment) {
        const badge = document.getElementById('sentimentBadge');
        if(badge) {
            badge.innerText = result.lastSentiment;
            badge.style.display = 'block';
        }
      }
      showActionButtons();
    }
  });

  // 2. Dropdown Logic
  const trigger = document.getElementById('toneTrigger');
  const optionsWrapper = document.getElementById('toneOptions');
  const hiddenInput = document.getElementById('toneSelector');
  const options = document.querySelectorAll('.custom-option');

  if (trigger) {
    trigger.addEventListener('click', () => { 
      optionsWrapper.classList.toggle('open'); 
      trigger.classList.toggle('open'); 
    });
  }
  
  options.forEach(option => {
    option.addEventListener('click', function() {
      hiddenInput.value = this.dataset.value;
      updateCustomSelectUI(this.dataset.icon, this.dataset.label);
      optionsWrapper.classList.remove('open'); 
      trigger.classList.remove('open');
    });
  });

  // 3. Voice Logic
  const micBtn = document.getElementById('micBtn');
  if (micBtn) {
    micBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());
  }
});

// --- HELPER FUNCTIONS ---

function updateCustomSelectUI(iconSrc, labelText) { 
  const trigger = document.getElementById('toneTrigger');
  if (trigger) trigger.innerHTML = `<img src="${iconSrc || 'alien.svg'}" class="tone-icon" alt=""> <span>${labelText || 'Tone'}</span>`; 
}

function showActionButtons() {
  document.getElementById('scanBtn').style.display = 'none';
  document.getElementById('setup-section').style.display = 'none';
  document.getElementById('actionButtons').style.display = 'flex';
}

function setLoadingState(isLoading, statusText = "Analyzing Context...") {
  const btn = document.getElementById('scanBtn'); 
  const skeleton = document.getElementById('skeletonLoader'); 
  
  if (isLoading) { 
    btn.innerText = statusText; 
    btn.style.opacity = "0.7"; 
    btn.disabled = true; 
    skeleton.style.display = "flex"; 
  } else { 
    btn.innerText = "Generate Reply"; 
    btn.style.opacity = "1"; 
    btn.disabled = false; 
    skeleton.style.display = "none"; 
  }
}

// --- ROBUST COPY FUNCTION (THE COPY FIX) ---
document.getElementById('copyBtn').addEventListener('click', async () => {
  const text = document.getElementById('output').value;
  const btn = document.getElementById('copyBtn');
  
  if (!text) return;

  try {
    // Attempt Modern Copy
    await navigator.clipboard.writeText(text);
    showCopySuccess(btn);
  } catch (err) {
    // Fallback Legacy Copy (If permission denied)
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
    showCopySuccess(btn);
  }
});

function showCopySuccess(btn) {
  const originalContent = btn.innerHTML;
  btn.innerHTML = `<img src="copied.svg" class="action-icon" alt=""> Copied`; 
  setTimeout(() => btn.innerHTML = `<img src="Copy.svg" class="action-icon" alt=""> Copy Text`, 2000);
}


// --- MAIN GENERATION LOGIC ---

document.getElementById('scanBtn').addEventListener('click', async () => {
  const output = document.getElementById('output'); 
  const apiKey = document.getElementById('apiKey').value.trim();
  const tone = document.getElementById('toneSelector').value;
  const instructions = document.getElementById('customInstructions').value;

  if (!apiKey) { output.value = "Error: Please enter your Gemini API Key."; return; }

  // Save Config Immediately
  chrome.storage.local.set({ geminiKey: apiKey, lastTone: tone, lastInstructions: instructions });
  
  output.value = ""; 
  setLoadingState(true, "Connecting...");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Connection Check
    try { await chrome.tabs.sendMessage(tab.id, { action: "ping" }); } 
    catch (e) { 
      setLoadingState(false); 
      output.value = "Connection Failed: Please REFRESH the web page."; 
      return; 
    }

    setLoadingState(true, "Scanning...");

    // Scan Request
    chrome.tabs.sendMessage(tab.id, { action: "scan_page" }, async (response) => {
      if (chrome.runtime.lastError || !response || !response.success) { 
        setLoadingState(false); 
        output.value = "No Text Found: Highlight text on the page first."; 
        return; 
      }
      
      setLoadingState(true, "Thinking...");

      try {
        const modelName = await findWorkingModel(apiKey);
        const replyData = await generateReply(modelName, response.text, response.images || [], tone, instructions, apiKey);
        
        output.value = replyData.reply;
        
        // Sentiment Badge
        if (replyData.sentiment) {
            const badge = document.getElementById('sentimentBadge');
            if(badge) {
                badge.innerText = replyData.sentiment;
                badge.style.display = 'block';
            }
        }
        
        // --- CRITICAL MEMORY SAVE (THIS WAS MISSING) ---
        chrome.storage.local.set({ 
            lastReply: replyData.reply,
            lastSentiment: replyData.sentiment 
        });
        
        showActionButtons();
        setLoadingState(false);
        
      } catch (apiError) { 
        setLoadingState(false); 
        output.value = "AI Error: " + apiError.message; 
      }
    });
  } catch (e) { 
    setLoadingState(false); 
    output.value = "System Error: " + e.message; 
  }
});

// --- AI FUNCTIONS ---

async function findWorkingModel(key) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`; 
    const response = await fetch(url);
    if (!response.ok) throw new Error("Invalid API Key"); 
    const data = await response.json();
    if (!data.models) return "gemini-2.0-flash";

    const preferredModels = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash-latest"];
    for (const pref of preferredModels) {
      const found = data.models.find(m => m.name.includes(pref));
      if (found) return found.name.replace('models/', '');
    }
    const anyFlash = data.models.find(m => m.name.includes("flash"));
    return anyFlash ? anyFlash.name.replace('models/', '') : "gemini-2.0-flash"; 
  } catch (e) { return "gemini-2.0-flash"; }
}

async function generateReply(modelName, context, images, tone, instructions, key) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;
  
  let visualNote = images.length > 0 ? "IMPORTANT: I have attached visual frames. Mention you have seen them." : "";

  const promptText = `
    You are a professional freelancer.
    INPUT: Job Post: "${context.substring(0, 3000)}" 
    Tone: ${tone}
    User Instructions: ${instructions}
    ${visualNote}
    
    TASK: Write a reply. 
    OUTPUT JSON ONLY: { "sentiment": "Emoji + Vibe", "reply": "The text" }
  `;

  const parts = [{ text: promptText }];
  if (images) {
    images.forEach(base64 => {
      parts.push({ inlineData: { mimeType: "image/jpeg", data: base64 } });
    });
  }

  const response = await fetch(url, { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify({ contents: [{ parts: parts }] }) 
  });
  
  const data = await response.json(); 
  if (data.error) throw new Error(data.error.message);
  
  let rawText = data.candidates[0].content.parts[0].text.trim();
  rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
  
  try { return JSON.parse(rawText); } 
  catch (e) { return { reply: rawText, sentiment: "🤖 AI Generated" }; }
}

// Reset Logic
document.getElementById('resetBtn').addEventListener('click', () => {
    document.getElementById('scanBtn').style.display = 'flex';
    document.getElementById('setup-section').style.display = 'block';
    document.getElementById('actionButtons').style.display = 'none';
    document.getElementById('output').value = "";
    document.getElementById('sentimentBadge').style.display = 'none';
    
    // Clear Memory on Reset
    chrome.storage.local.remove(['lastReply', 'lastSentiment']);
});

// Insert Button Listener
document.getElementById('insertBtn').addEventListener('click', async () => {
  const text = document.getElementById('output').value; 
  const btn = document.getElementById('insertBtn');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  try {
    await chrome.tabs.sendMessage(tab.id, { action: "ghostwrite", text: text }); 
    btn.innerHTML = `<img src="copied.svg" class="action-icon" alt=""> Inserted`;
  } catch (err) {
    btn.innerHTML = "✕ Box Not Found"; 
  }
  setTimeout(() => btn.innerHTML = `<img src="insert.svg" class="action-icon" alt=""> Insert into Page`, 2000);
});