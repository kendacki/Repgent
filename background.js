// background.js - The Invisible Brain

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "orb_generate") {
    handleOrbRequest(request, sender.tab.id);
  }
});

async function handleOrbRequest(request, tabId) {
  // 1. Get Settings from Memory
  const data = await chrome.storage.local.get(['geminiKey', 'lastTone', 'lastInstructions']);
  
  if (!data.geminiKey) {
    console.error("Repgent: No API Key found.");
    chrome.tabs.sendMessage(tabId, { action: "orb_complete", success: false });
    return;
  }

  try {
    // 2. Prepare the Payload
    const modelName = "gemini-1.5-flash"; 
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${data.geminiKey}`;
    
    const tone = data.lastTone || "Casual";
    const inst = data.lastInstructions ? `\nUSER DIRECTIVE: ${data.lastInstructions}` : "";
    const visualNote = (request.images && request.images.length > 0) ? "NOTE: Use the attached images for context." : "";

    const parts = [{ text: `
      You are a freelancer. Write a short, punchy reply to this job post.
      Job: "${request.text}" | Tone: ${tone} ${inst} ${visualNote}
      Respond with ONLY the raw message text. Under 200 chars. No hashtags.
    `}];

    // Add visuals if they exist
    if (request.images) {
      request.images.forEach(base64 => {
        parts.push({ inlineData: { mimeType: "image/jpeg", data: base64 } });
      });
    }

    // 3. Call Gemini
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: parts }] })
    });

    const result = await response.json();
    if (result.error) throw new Error(result.error.message);

    const reply = result.candidates[0].content.parts[0].text.trim();

    // 4. Send Result Back to Page
    chrome.tabs.sendMessage(tabId, { action: "ghostwrite", text: reply });
    chrome.tabs.sendMessage(tabId, { action: "orb_complete", success: true });

  } catch (e) {
    console.error("Orb Generation Failed:", e);
    chrome.tabs.sendMessage(tabId, { action: "orb_complete", success: false });
  }
}