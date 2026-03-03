document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['geminiKey', 'lastReply', 'lastTone', 'lastInstructions', 'lastSentiment'], (result) => {
    if (result.geminiKey) document.getElementById('apiKey').value = result.geminiKey;
    if (result.lastInstructions) document.getElementById('customInstructions').value = result.lastInstructions;
    
    if (result.lastTone) {
      document.getElementById('toneSelector').value = result.lastTone;
      const matchingOption = document.querySelector(`.custom-option[data-value="${result.lastTone}"]`);
      if (matchingOption) updateCustomSelectUI(matchingOption.dataset.icon, matchingOption.dataset.label);
    }
    
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

  // --- UI SETUP (Dropdowns, Voice, etc) ---
  const trigger = document.getElementById('toneTrigger');
  const optionsWrapper = document.getElementById('toneOptions');
  const hiddenInput = document.getElementById('toneSelector');
  const options = document.querySelectorAll('.custom-option');

  trigger.addEventListener('click', () => { optionsWrapper.classList.toggle('open'); trigger.classList.toggle('open'); });
  options.forEach(option => {
    option.addEventListener('click', function() {
      hiddenInput.value = this.dataset.value;
      updateCustomSelectUI(this.dataset.icon, this.dataset.label);
      optionsWrapper.classList.remove('open'); trigger.classList.remove('open');
    });
  });
  document.addEventListener('click', (e) => { if (!document.getElementById('customToneSelect').contains(e.target)) { optionsWrapper.classList.remove('open'); trigger.classList.remove('open'); } });

  // JARVIS Voice
  const micBtn = document.getElementById('micBtn');
  const instructionInput = document.getElementById('customInstructions');
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.continuous = false; recognition.interimResults = true;
    let isListening = false;
    micBtn.addEventListener('click', async () => { 
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        isListening ? recognition.stop() : recognition.start();
      } catch (err) {
        console.warn("Mic blocked.", err);
        chrome.runtime.openOptionsPage();
      }
    });
    recognition.onstart = () => { isListening = true; micBtn.classList.add('listening'); instructionInput.placeholder = "Listening..."; instructionInput.value = ""; };
    recognition.onresult = (event) => { instructionInput.value = Array.from(event.results).map(r => r[0].transcript).join(''); };
    recognition.onend = () => { micBtn.classList.remove('listening'); instructionInput.placeholder = "Speak or type instructions..."; isListening = false; };
  } else { micBtn.style.display = 'none'; }
});

function updateCustomSelectUI(iconSrc, labelText) { document.getElementById('toneTrigger').innerHTML = `<img src="${iconSrc}" class="tone-icon" alt=""> <span>${labelText}</span>`; }
function showActionButtons() { document.getElementById('scanBtn').style.display = 'none'; document.getElementById('setup-section').style.display = 'none'; document.getElementById('actionButtons').style.display = 'flex'; }
function resetUI() { document.getElementById('scanBtn').style.display = 'flex'; document.getElementById('setup-section').style.display = 'block'; document.getElementById('actionButtons').style.display = 'none'; document.getElementById('output').value = ""; document.getElementById('sentimentBadge').style.display = 'none'; chrome.storage.local.remove(['lastReply', 'lastSentiment']); }

function setLoadingState(isLoading) {
  const btn = document.getElementById('scanBtn'); const skeleton = document.getElementById('skeletonLoader'); const dot = document.getElementById('statusDot');
  if (isLoading) { btn.innerText = "Analyzing Visuals..."; btn.style.opacity = "0.7"; btn.disabled = true; skeleton.style.display = "flex"; dot.className = "status-dot active"; document.getElementById('sentimentBadge').style.display = 'none'; } 
  else { btn.innerText = "Generate Reply"; btn.style.opacity = "1"; btn.disabled = false; skeleton.style.display = "none"; }
}

document.getElementById('resetBtn').addEventListener('click', resetUI);
document.getElementById('copyBtn').addEventListener('click', () => { navigator.clipboard.writeText(document.getElementById('output').value); const btn = document.getElementById('copyBtn'); btn.innerHTML = `<img src="copied.svg" class="action-icon" alt=""> Copied`; setTimeout(() => btn.innerHTML = `<img src="Copy.svg" class="action-icon" alt=""> Copy Text`, 2000); });
document.getElementById('insertBtn').addEventListener('click', async () => {
  const text = document.getElementById('output').value; const btn = document.getElementById('insertBtn');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try { await chrome.tabs.sendMessage(tab.id, { action: "ghostwrite", text: text }); btn.innerHTML = `<img src="copied.svg" class="action-icon" alt=""> Inserted`; } 
  catch (err) { btn.innerHTML = "✕ Box Not Found"; }
  setTimeout(() => btn.innerHTML = `<img src="insert.svg" class="action-icon" alt=""> Insert into Page`, 2000);
});

// --- MAIN GENERATION LOGIC ---
document.getElementById('scanBtn').addEventListener('click', async () => {
  const output = document.getElementById('output'); const tone = document.getElementById('toneSelector').value; 
  const instructions = document.getElementById('customInstructions').value.trim(); const apiKey = document.getElementById('apiKey').value.trim();
  const badge = document.getElementById('sentimentBadge');

  if (!apiKey) { output.value = "System Error: API Key missing."; return; }
  chrome.storage.local.set({ geminiKey: apiKey, lastTone: tone, lastInstructions: instructions });
  output.value = ""; setLoadingState(true);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    let platform = "General"; const url = tab.url || "";
    if (url.includes("upwork.com")) platform = "Upwork"; else if (url.includes("linkedin.com")) platform = "LinkedIn"; else if (url.includes("contra.com")) platform = "Contra";

    try { await chrome.tabs.sendMessage(tab.id, { action: "ping" }); } catch (err) { await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] }); await new Promise(r => setTimeout(r, 100)); }

    // SCAN FOR TEXT AND IMAGES
    chrome.tabs.sendMessage(tab.id, { action: "scan_page" }, async (response) => {
      if (chrome.runtime.lastError || !response || !response.success) { setLoadingState(false); output.value = "Action Required: Highlight the job post text first."; return; }
      
      try {
        const modelName = await findWorkingModel(apiKey);
        // PASS IMAGES TO GENERATE FUNCTION
        const data = await generateReply(modelName, response.text.substring(0, 5000), response.images || [], tone, instructions, platform, apiKey);
        
        output.value = data.reply;
        badge.innerText = data.sentiment;
        badge.style.display = 'block';
        chrome.storage.local.set({ lastReply: data.reply, lastSentiment: data.sentiment });
        setLoadingState(false); showActionButtons();
      } catch (innerError) { setLoadingState(false); output.value = "API Error: " + innerError.message; }
    });
  } catch (e) { setLoadingState(false); output.value = "System Error: " + e.message; }
});

// LISTENER FOR ORB BACKGROUND REQUESTS
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "orb_generate") {
    handleOrbRequest(request, sender.tab.id);
  }
});

async function handleOrbRequest(request, tabId) {
  chrome.storage.local.get(['geminiKey', 'lastTone', 'lastInstructions'], async (data) => {
    if (!data.geminiKey) return; // Silent fail if no key
    try {
      const modelName = await findWorkingModel(data.geminiKey);
      const result = await generateReply(modelName, request.text, request.images || [], data.lastTone || "Casual", data.lastInstructions || "", "General", data.geminiKey);
      
      // Inject reply back into page
      chrome.tabs.sendMessage(tabId, { action: "ghostwrite", text: result.reply });
      chrome.tabs.sendMessage(tabId, { action: "orb_complete", success: true });
    } catch (e) {
      console.error("Orb Error", e);
      chrome.tabs.sendMessage(tabId, { action: "orb_complete", success: false });
    }
  });
}

async function findWorkingModel(key) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models`; 
  const response = await fetch(url, { method: 'GET', headers: { 'x-goog-api-key': key } });
  if (!response.ok) throw new Error("Invalid API Key"); 
  const data = await response.json();
  const validModel = data.models.find(m => m.name.includes("flash")); 
  return (validModel || data.models[0]).name.replace('models/', '');
}

async function generateReply(modelName, context, images, tone, instructions, platform, key) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
  
  let platformRules = "Constraint: Under 150 characters. Punchy.";
  if (platform === "Upwork") platformRules = "Constraint: Structured cover letter opening. ~200 chars.";
  else if (platform === "LinkedIn") platformRules = "Constraint: Conversational DM. ~150 chars.";

  let customDirective = instructions ? `\nCRITICAL USER DIRECTIVE: ${instructions} (Weave this naturally into the text).` : "";
  let visualNote = images.length > 0 ? "NOTE: Use the attached images/screenshots for context. Mention specific details from them if relevant (e.g., 'I see your React error...')." : "";

  // BUILD MULTIMODAL PAYLOAD
  const parts = [{ text: `
    You are a professional freelancer replying on ${platform}.
    INPUT: Job Post: "${context}" | Desired Tone: ${tone}${customDirective}
    ${visualNote}
    
    INSTRUCTIONS:
    1. Perform a psychological sentiment analysis.
    2. Write a reply matching the tone.
    3. ${platformRules}
    
    You MUST respond strictly in valid JSON format:
    { "sentiment": "Emoji + Vibe", "reply": "Text" }
  `}];

  // Add Base64 Images to Payload
  images.forEach(base64 => {
    parts.push({ inlineData: { mimeType: "image/jpeg", data: base64 } });
  });

  const response = await fetch(url, { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, 
    body: JSON.stringify({ contents: [{ parts: parts }] }) 
  });
  
  const data = await response.json(); 
  if (data.error) throw new Error(data.error.message);
  
  let rawText = data.candidates[0].content.parts[0].text.trim();
  rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(rawText);
}