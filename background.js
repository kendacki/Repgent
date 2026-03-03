chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "orb_generate") {
    // Keep the service worker alive
    handleOrbRequest(request, sender.tab.id);
    return true; // Indicates async response
  }
});

async function handleOrbRequest(request, tabId) {
  try {
    const data = await chrome.storage.local.get(['geminiKey', 'lastTone', 'lastInstructions']);
    
    if (!data.geminiKey) {
      console.error("Repgent: No API Key found.");
      chrome.tabs.sendMessage(tabId, { action: "orb_complete", success: false, error: "No API Key" });
      return;
    }

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

    if (request.images) {
      request.images.forEach(base64 => {
        parts.push({ inlineData: { mimeType: "image/jpeg", data: base64 } });
      });
    }

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

    if (!result.candidates || !result.candidates[0].content) {
      throw new Error("Empty response from AI");
    }

    const reply = result.candidates[0].content.parts[0].text.trim();

    // Success! Send text back to page
    chrome.tabs.sendMessage(tabId, { action: "orb_complete", success: true, text: reply });

  } catch (e) {
    console.error("Background Worker Error:", e);
    // Notify the orb to turn red
    chrome.tabs.sendMessage(tabId, { action: "orb_complete", success: false });
  }
}