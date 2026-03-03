// background.js - God Mode Brain (Dynamic Model Selection)

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "orb_generate") {
    handleOrbRequest(request, sender.tab.id);
    return true; // Keep channel open
  }
});

async function handleOrbRequest(request, tabId) {
  try {
    console.log("Orb: Request Received");

    // 1. Get Settings
    const data = await chrome.storage.local.get(['geminiKey', 'lastTone', 'lastInstructions']);
    
    if (!data.geminiKey) {
      console.error("Orb: No API Key");
      chrome.tabs.sendMessage(tabId, { action: "orb_complete", success: false, error: "No API Key" });
      return;
    }

    // 2. DYNAMICALLY FIND MODEL (Prevents "Model Not Found" crash)
    const modelName = await findWorkingModel(data.geminiKey);
    console.log("Orb: Using Model ->", modelName);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${data.geminiKey}`;
    
    const tone = data.lastTone || "Casual";
    const inst = data.lastInstructions ? `\nUSER DIRECTIVE: ${data.lastInstructions}` : "";
    
    let visualNote = "";
    if (request.images && request.images.length > 0) {
      visualNote = "IMPORTANT: I have attached visual frames (images or video snapshots). Mention you have seen them.";
    }

    // 3. Construct Prompt
    const parts = [{ text: `
      You are a professional freelancer. Write a short, punchy reply to this job post.
      Job: "${request.text}" 
      Tone: ${tone} 
      ${inst} 
      ${visualNote}
      
      Respond with ONLY the raw message text. Under 200 chars. No hashtags.
    `}];

    if (request.images) {
      request.images.forEach(base64 => {
        parts.push({ inlineData: { mimeType: "image/jpeg", data: base64 } });
      });
    }

    // 4. Call API
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: parts }] })
    });

    const result = await response.json();
    
    if (result.error) {
      console.error("Gemini API Error:", result.error);
      throw new Error(result.error.message);
    }

    const reply = result.candidates[0].content.parts[0].text.trim();

    // 5. Send Result
    chrome.tabs.sendMessage(tabId, { action: "orb_complete", success: true, text: reply });

  } catch (e) {
    console.error("Orb Failed:", e);
    chrome.tabs.sendMessage(tabId, { action: "orb_complete", success: false });
  }
}

// --- HELPER: FIND WORKING MODEL ---
async function findWorkingModel(key) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`; 
    const response = await fetch(url);
    if (!response.ok) throw new Error("Invalid API Key"); 
    
    const data = await response.json();
    if (!data.models) return "gemini-2.0-flash"; 

    // Priority List
    const preferredModels = [
      "gemini-2.5-flash", 
      "gemini-2.0-flash", 
      "gemini-1.5-flash-latest"
    ];

    for (const pref of preferredModels) {
      const found = data.models.find(m => m.name.includes(pref));
      if (found) return found.name.replace('models/', '');
    }

    const anyFlash = data.models.find(m => m.name.includes("flash"));
    return anyFlash ? anyFlash.name.replace('models/', '') : "gemini-2.0-flash"; 
  } catch (e) {
    return "gemini-2.0-flash"; // Safest fallback
  }
}