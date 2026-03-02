// --- 1. THE HOLOGRAPHIC ORB SYSTEM ---

// Create the Orb UI and inject it into the page
const orb = document.createElement('div');
orb.id = "repgent-hologram";
orb.style.cssText = `
  position: absolute; display: none; z-index: 2147483647; 
  width: 32px; height: 32px; border-radius: 50%;
  background-color: #0D1117; background-image: url('${chrome.runtime.getURL("icon.png")}');
  background-size: 70%; background-position: center; background-repeat: no-repeat;
  box-shadow: 0 4px 12px rgba(242, 169, 0, 0.4), 0 0 0 1px rgba(242, 169, 0, 0.5);
  cursor: pointer; transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
`;
document.body.appendChild(orb);

let selectedTextMemory = "";

// Show Orb when text is highlighted
document.addEventListener('mouseup', (e) => {
  const selection = window.getSelection();
  const text = selection.toString().trim();
  
  if (text.length > 20) { // Only trigger for actual paragraphs
    selectedTextMemory = text;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    // Spawn orb slightly below and to the right of the selection
    orb.style.left = `${rect.right + window.scrollX + 10}px`;
    orb.style.top = `${rect.bottom + window.scrollY - 15}px`;
    orb.style.display = 'block';
    orb.style.transform = 'scale(0)';
    
    // Pop animation
    setTimeout(() => { orb.style.transform = 'scale(1)'; }, 10);
  } else if (e.target !== orb) {
    orb.style.display = 'none';
  }
});

// Holographic Orb Click Action (Auto-Pilot Mode)
orb.addEventListener('click', async () => {
  // Turn orb into a spinning loading state
  orb.style.backgroundImage = 'none';
  orb.style.borderTop = '3px solid #F2A900';
  orb.style.animation = 'repgent-spin 1s linear infinite';
  
  // Create spinning keyframe if it doesn't exist
  if (!document.getElementById('repgent-orb-style')) {
    const style = document.createElement('style');
    style.id = 'repgent-orb-style';
    style.innerHTML = `@keyframes repgent-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
  }

  // Fetch settings directly from Chrome Memory
  chrome.storage.local.get(['geminiKey', 'lastTone', 'lastInstructions'], async (data) => {
    if (!data.geminiKey) {
      alert("Repgent: Please open the extension and paste your API key first.");
      resetOrb(); return;
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`;
      const tone = data.lastTone || "Casual";
      const inst = data.lastInstructions ? `\nUSER DIRECTIVE: ${data.lastInstructions}` : "";
      
      const promptText = `
        You are a freelancer. Read this job post and write a short, punchy reply. 
        Job: "${selectedTextMemory}" | Tone: ${tone} ${inst}
        Respond with ONLY the raw message text. Under 200 characters. No hashtags.
      `;

      const response = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': data.geminiKey },
        body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
      });

      const result = await response.json();
      if (result.error) throw new Error(result.error.message);
      
      const finalReply = result.candidates[0].content.parts[0].text.trim();
      
      // Auto-Insert via Smart Hunter
      performGhostwrite(finalReply);
      
      // Show Success Checkmark on Orb
      resetOrb(true);

    } catch (e) {
      console.error("Repgent Orb Error:", e);
      resetOrb();
    }
  });
});

function resetOrb(success = false) {
  orb.style.animation = 'none';
  orb.style.borderTop = 'none';
  orb.style.backgroundColor = success ? '#238636' : '#0D1117';
  orb.style.backgroundImage = success ? 'none' : `url('${chrome.runtime.getURL("icon.png")}')`;
  if(success) orb.innerHTML = `<div style="color:white; display:flex; justify-content:center; align-items:center; width:100%; height:100%;">✓</div>`;
  setTimeout(() => { 
    orb.style.display = 'none'; 
    orb.innerHTML = ''; 
    orb.style.backgroundColor = '#0D1117';
  }, 2000);
}


// --- 2. THE SMART HUNTER (Popup Communication) ---

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ping") { sendResponse({ status: "alive" }); return; }
  if (request.action === "scan_page") {
    const text = window.getSelection().toString().trim();
    sendResponse({ success: !!text, text: text });
  }
  if (request.action === "ghostwrite") {
    const success = performGhostwrite(request.text);
    sendResponse({ success: success });
  }
});

function performGhostwrite(textToInsert) {
  let targetBox = Array.from(document.querySelectorAll('textarea')).find(el => isVisible(el));
  if (!targetBox) targetBox = Array.from(document.querySelectorAll('[contenteditable="true"], [role="textbox"]')).find(el => isVisible(el));

  if (targetBox) {
    targetBox.style.transition = "box-shadow 0.3s"; targetBox.style.boxShadow = "0 0 0 4px #00ff88";
    setTimeout(() => targetBox.style.boxShadow = "none", 1000);
    targetBox.focus();

    if (targetBox.tagName === 'TEXTAREA' || targetBox.tagName === 'INPUT') {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
      if (nativeSetter) nativeSetter.call(targetBox, textToInsert); else targetBox.value = textToInsert;
    } else { targetBox.innerText = textToInsert; }

    targetBox.dispatchEvent(new Event('input', { bubbles: true }));
    targetBox.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  return false;
}

function isVisible(elem) {
  if (!elem) return false; const style = window.getComputedStyle(elem);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && elem.offsetWidth > 0;
}