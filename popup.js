document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['geminiKey', 'lastReply', 'lastTone', 'lastInstructions', 'lastSentiment'], (result) => {
    if (result.geminiKey) document.getElementById('apiKey').value = result.geminiKey;
    if (result.lastInstructions) document.getElementById('customInstructions').value = result.lastInstructions;
    
    // Restore the custom dropdown visual state
    if (result.lastTone) {
      document.getElementById('toneSelector').value = result.lastTone;
      const matchingOption = document.querySelector(`.custom-option[data-value="${result.lastTone}"]`);
      if (matchingOption) updateCustomSelectUI(matchingOption.dataset.icon, matchingOption.dataset.label);
    }
    
    // Restore the last generated reply and sentiment badge
    if (result.lastReply && result.lastReply.length > 0) {
      document.getElementById('output').value = result.lastReply;
      if (result.lastSentiment) {
        const badge = document.getElementById('sentimentBadge');
        badge.innerText = result.lastSentiment;
        badge.style.display = 'block';
      }
      showActionButtons();
    }
  });

  // --- CUSTOM DROPDOWN LOGIC ---
  const trigger = document.getElementById('toneTrigger');
  const optionsWrapper = document.getElementById('toneOptions');
  const hiddenInput = document.getElementById('toneSelector');
  const options = document.querySelectorAll('.custom-option');

  trigger.addEventListener('click', () => { 
    optionsWrapper.classList.toggle('open'); 
    trigger.classList.toggle('open'); 
  });
  
  options.forEach(option => {
    option.addEventListener('click', function() {
      hiddenInput.value = this.dataset.value;
      updateCustomSelectUI(this.dataset.icon, this.dataset.label);
      optionsWrapper.classList.remove('open'); 
      trigger.classList.remove('open');
    });
  });
  
  document.addEventListener('click', (e) => { 
    if (!document.getElementById('customToneSelect').contains(e.target)) { 
      optionsWrapper.classList.remove('open'); 
      trigger.classList.remove('open'); 
    } 
  });

  // --- JARVIS VOICE ENGINE (FIXED PERMISSIONS) ---
  const micBtn = document.getElementById('micBtn');
  const instructionInput = document.getElementById('customInstructions');
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.continuous = false; 
    recognition.interimResults = true;
    let isListening = false;

    micBtn.addEventListener('click', async () => { 
      try {
        // Force the browser to request microphone permissions
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop()); // Stop immediately, we just needed to verify
        
        // If we get here, permission is granted! Start listening.
        if (isListening) {
          recognition.stop();
        } else {
          recognition.start();
        }
      } catch (err) {
        // Chrome blocked it! Automatically open our Permission Bridge (options.html)
        console.warn("Mic blocked. Opening Options page...", err);
        instructionInput.value = "Opening mic settings...";
        chrome.runtime.openOptionsPage();
      }
    });

    recognition.onstart = () => {
      isListening = true; micBtn.classList.add('listening');
      instructionInput.placeholder = "Listening..."; instructionInput.value = ""; 
    };

    recognition.onresult = (event) => {
      let text = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) text += event.results[i][0].transcript;
      instructionInput.value = text; 
    };

    recognition.onerror = () => { micBtn.classList.remove('listening'); instructionInput.placeholder = "Speak or type instructions..."; isListening = false; };
    recognition.onend = () => { micBtn.classList.remove('listening'); instructionInput.placeholder = "Speak or type instructions..."; isListening = false; };
  } else {
    micBtn.style.display = 'none'; // Hide if browser doesn't support Voice API
  }
});

function updateCustomSelectUI(iconSrc, labelText) { 
  document.getElementById('toneTrigger').innerHTML = `<img src="${iconSrc}" class="tone-icon" alt=""> <span>${labelText}</span>`; 
}

function showActionButtons() {
  document.getElementById('scanBtn').style.display = 'none';
  document.getElementById('setup-section').style.display = 'none';
  document.getElementById('actionButtons').style.display = 'flex';
}

function resetUI() {
  document.getElementById('scanBtn').style.display = 'flex';
  document.getElementById('setup-section').style.display = 'block';
  document.getElementById('actionButtons').style.display = 'none';
  document.getElementById('output').value = "";
  document.getElementById('sentimentBadge').style.display = 'none';
  chrome.storage.local.remove(['lastReply', 'lastSentiment']);
}

function setLoadingState(isLoading) {
  const btn = document.getElementById('scanBtn'); 
  const skeleton = document.getElementById('skeletonLoader'); 
  const dot = document.getElementById('statusDot');
  if (isLoading) { 
    btn.innerText = "Analyzing Context..."; btn.style.opacity = "0.7"; btn.disabled = true; 
    skeleton.style.display = "flex"; dot.className = "status-dot active"; 
    document.getElementById('sentimentBadge').style.display = 'none'; 
  } else { 
    btn.innerText = "Generate Reply"; btn.style.opacity = "1"; btn.disabled = false; 
    skeleton.style.display = "none"; 
  }
}

document.getElementById('resetBtn').addEventListener('click', resetUI);

// --- ACTION BUTTONS (SVG SWITCHING LOGIC) ---
document.getElementById('copyBtn').addEventListener('click', () => { 
  navigator.clipboard.writeText(document.getElementById('output').value); 
  const btn = document.getElementById('copyBtn'); 
  // Swap to copied.svg on success
  btn.innerHTML = `<img src="copied.svg" class="action-icon" alt=""> Copied`; 
  setTimeout(() => btn.innerHTML = `<img src="Copy.svg" class="action-icon" alt=""> Copy Text`, 2000); 
});

document.getElementById('insertBtn').addEventListener('click', async () => {
  const text = document.getElementById('output').value; const btn = document.getElementById('insertBtn');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    await chrome.tabs.sendMessage(tab.id, { action: "ghostwrite", text: text }); 
    // Swap to copied.svg on success
    btn.innerHTML = `<img src="copied.svg" class="action-icon" alt=""> Inserted`;
  } catch (err) {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] }); 
    await new Promise(r => setTimeout(r, 100)); 
    try { 
      await chrome.tabs.sendMessage(tab.id, { action: "ghostwrite", text: text }); 
      btn.innerHTML = `<img src="copied.svg" class="action-icon" alt=""> Inserted`; 
    } catch (e) { 
      btn.innerHTML = "✕ Box Not Found"; 
    }
  }
  // Revert back to insert.svg after 2 seconds
  setTimeout(() => btn.innerHTML = `<img src="insert.svg" class="action-icon" alt=""> Insert into Page`, 2000);
});

// --- GENERATION ENGINE ---
document.getElementById('scanBtn').addEventListener('click', async () => {
  const output = document.getElementById('output'); 
  const tone = document.getElementById('toneSelector').value; 
  const instructions = document.getElementById('customInstructions').value.trim(); 
  const apiKey = document.getElementById('apiKey').value.trim();
  const badge = document.getElementById('sentimentBadge');

  if (!apiKey) { output.value = "System Error: API Key missing."; return; }

  chrome.storage.local.set({ geminiKey: apiKey, lastTone: tone, lastInstructions: instructions });
  output.value = ""; 
  setLoadingState(true);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Chameleon: Auto-detect the platform from the URL
    let platform = "General"; const url = tab.url || "";
    if (url.includes("upwork.com")) platform = "Upwork"; 
    else if (url.includes("linkedin.com")) platform = "LinkedIn"; 
    else if (url.includes("contra.com")) platform = "Contra"; 
    else if (url.includes("fiverr.com")) platform = "Fiverr";

    // Self-healing DOM script check
    try { 
      await chrome.tabs.sendMessage(tab.id, { action: "ping" }); 
    } catch (err) { 
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] }); 
      await new Promise(r => setTimeout(r, 100)); 
    }

    // Read the page and generate reply
    chrome.tabs.sendMessage(tab.id, { action: "scan_page" }, async (response) => {
      if (chrome.runtime.lastError || !response || !response.success) { 
        setLoadingState(false); output.value = "Action Required: Highlight the job post text first."; return; 
      }
      
      try {
        const modelName = await findWorkingModel(apiKey);
        const data = await generateReply(modelName, response.text.substring(0, 5000), tone, instructions, platform, apiKey);
        
        output.value = data.reply;
        badge.innerText = data.sentiment;
        badge.style.display = 'block';
        
        // Save success state to memory
        chrome.storage.local.set({ lastReply: data.reply, lastSentiment: data.sentiment });
        setLoadingState(false); 
        showActionButtons();
      } catch (innerError) { 
        setLoadingState(false); output.value = "API Error: " + innerError.message; 
      }
    });
  } catch (e) { 
    setLoadingState(false); output.value = "System Error: " + e.message; 
  }
});

// --- AI FUNCTIONS ---
async function findWorkingModel(key) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models`; 
  const response = await fetch(url, { method: 'GET', headers: { 'x-goog-api-key': key } });
  if (!response.ok) throw new Error("Invalid API Key"); 
  const data = await response.json();
  const validModel = data.models.find(m => m.name.includes("flash")); 
  return (validModel || data.models[0]).name.replace('models/', '');
}

async function generateReply(modelName, context, tone, instructions, platform, key) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
  
  // Specific lengths and formats based on the detected website
  let platformRules = "Constraint: Under 150 characters. Punchy.";
  if (platform === "Upwork") platformRules = "Constraint: Structured cover letter opening. ~200 chars.";
  else if (platform === "LinkedIn") platformRules = "Constraint: Conversational DM. ~150 chars.";
  else if (platform === "Fiverr") platformRules = "Constraint: Highly direct and service-oriented. Under 150 chars.";

  let customDirective = instructions ? `\nCRITICAL USER DIRECTIVE: ${instructions} (Weave this naturally into the text).` : "";

  // The Prompt demands JSON for the Psycho-Sentiment engine
  const promptText = `
    You are a professional freelancer replying on ${platform}.
    INPUT: Job Post: "${context}" | Desired Tone: ${tone}${customDirective}
    
    INSTRUCTIONS:
    1. Perform a psychological sentiment analysis of the client based on the Job Post (e.g., 🚨 Urgent & Stressed, 👔 Highly Corporate).
    2. Write a reply IN THE SAME LANGUAGE as the Job Post, matching the "${tone}" tone.
    3. ${platformRules}
    
    You MUST respond strictly in valid JSON format exactly like this:
    {
      "sentiment": "Emoji + 2-3 word vibe description",
      "reply": "Your actual generated text"
    }
  `;

  const response = await fetch(url, { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, 
    body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] }) 
  });
  
  const data = await response.json(); 
  if (data.error) throw new Error(data.error.message);
  
  // Clean JSON markup sometimes returned by LLM
  let rawText = data.candidates[0].content.parts[0].text.trim();
  rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(rawText);
}