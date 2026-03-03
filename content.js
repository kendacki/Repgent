// --- 1. THE HOLOGRAPHIC ORB SYSTEM ---
const orb = document.createElement('div');
orb.id = "repgent-hologram";
orb.style.cssText = `
  position: absolute; display: none; z-index: 2147483647; 
  width: 32px; height: 32px; border-radius: 50%;
  background-color: #0D1117; background-image: url('${chrome.runtime.getURL("icon.png")}');
  background-size: 70%; background-position: center; background-repeat: no-repeat;
  box-shadow: 0 4px 12px rgba(242, 169, 0, 0.4), 0 0 0 1px rgba(242, 169, 0, 0.5);
  cursor: pointer; transition: transform 0.1s cubic-bezier(0.4, 0, 0.2, 1);
`;
document.body.appendChild(orb);

let selectedTextMemory = "";
let currentSelectionRange = null; // Store range to calculate visual context later

// FAST ORB APPEARANCE (No heavy processing here)
document.addEventListener('mouseup', (e) => {
  const selection = window.getSelection();
  const text = selection.toString().trim();
  
  if (text.length > 5) { 
    selectedTextMemory = text;
    currentSelectionRange = selection.getRangeAt(0).cloneRange(); // Save location

    const rect = currentSelectionRange.getBoundingClientRect();
    
    // Calculate position (ensure it doesn't float offscreen)
    const topPos = rect.bottom + window.scrollY + 10;
    const leftPos = rect.right + window.scrollX + 5;

    orb.style.top = `${topPos}px`;
    orb.style.left = `${leftPos}px`;
    orb.style.display = 'block';
    orb.style.transform = 'scale(1)'; // Instant show
  } else if (e.target !== orb) {
    orb.style.display = 'none';
  }
});

// --- 2. ORB CLICK (Heavy Lifting happens HERE now) ---
orb.addEventListener('click', async () => {
  // 1. UI Feedback Loop
  orb.style.backgroundImage = 'none';
  orb.style.borderTop = '3px solid #F2A900';
  orb.style.animation = 'repgent-spin 0.8s linear infinite';
  
  if (!document.getElementById('repgent-orb-style')) {
    const style = document.createElement('style');
    style.id = 'repgent-orb-style';
    style.innerHTML = `@keyframes repgent-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
  }

  // 2. NOW we scan for images (Lazy Load)
  let visuals = [];
  try {
    if (currentSelectionRange) {
      const container = currentSelectionRange.commonAncestorContainer.nodeType === 1 
        ? currentSelectionRange.commonAncestorContainer 
        : currentSelectionRange.commonAncestorContainer.parentNode;
      const searchArea = container.closest('article') || container.parentElement || container;
      visuals = await extractVisuals(searchArea);
    }
  } catch (err) {
    console.warn("Visual Cortex Error:", err);
  }

  // 3. Send to Background
  chrome.runtime.sendMessage({ 
    action: "orb_generate", 
    text: selectedTextMemory,
    images: visuals 
  });
});

// Helper: Find and convert images (Optimized with Resize)
async function extractVisuals(root) {
  if (!root) return [];
  const images = Array.from(root.querySelectorAll('img, video'));
  const validVisuals = [];

  for (const el of images) {
    if (el.width < 100 || el.height < 100) continue; // Skip icons

    let src = el.currentSrc || el.src || el.poster;
    if (src && !src.startsWith('data:')) {
      try {
        const base64 = await urlToBase64(src);
        if (base64) validVisuals.push(base64);
        if (validVisuals.length >= 2) break; // Hard limit: Max 2 images to prevent crashes
      } catch (err) {
        // Ignore CORS errors silently
      }
    }
  }
  return validVisuals;
}

function urlToBase64(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = url;
    img.onload = () => {
      // RESIZE LOGIC: Max 512px to keep payload small
      const scale = Math.min(512 / Math.max(img.width, img.height), 1);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]); // 60% Quality JPG
    };
    img.onerror = () => resolve(null);
  });
}

// --- 3. COMMUNICATION HUB ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ping") { sendResponse({ status: "alive" }); return; }

  // Handle Response from Background
  if (request.action === "orb_complete") {
    if (request.success && request.text) {
      performGhostwrite(request.text);
      resetOrb(true);
    } else {
      resetOrb(false); // Turn Red on failure
    }
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
    return true;
  }
  return false;
}

function isVisible(elem) {
  if (!elem) return false; const style = window.getComputedStyle(elem);
  return style.display !== 'none' && style.visibility !== 'hidden' && elem.offsetWidth > 0;
}

function resetOrb(success = false) {
  orb.style.animation = 'none';
  orb.style.borderTop = 'none';
  orb.style.backgroundColor = success ? '#238636' : '#F85149'; // Green or Red
  orb.style.backgroundImage = success ? 'none' : `url('${chrome.runtime.getURL("icon.png")}')`;
  orb.innerHTML = success ? `<div style="color:white; font-size:20px; display:flex; justify-content:center; align-items:center; width:100%; height:100%;">✓</div>` : '';
  
  setTimeout(() => { 
    orb.style.display = 'none'; 
    orb.innerHTML = ''; 
    orb.style.backgroundColor = '#0D1117';
  }, 2000);
}