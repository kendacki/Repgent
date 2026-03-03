// --- 1. THE HOLOGRAPHIC ORB SYSTEM ---
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
let selectedVisualsMemory = []; // Stores Base64 images

document.addEventListener('mouseup', async (e) => {
  const selection = window.getSelection();
  const text = selection.toString().trim();
  
  if (text.length > 5) { 
    selectedTextMemory = text;
    
    // VISUAL CORTEX: Hunt for images nearby
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer.nodeType === 1 
      ? range.commonAncestorContainer 
      : range.commonAncestorContainer.parentNode;
      
    // Find images in the immediate container or parent
    const searchArea = container.closest('article') || container.parentElement || container;
    selectedVisualsMemory = await extractVisuals(searchArea);

    const rect = range.getBoundingClientRect();
    orb.style.left = `${rect.right + window.scrollX + 10}px`;
    orb.style.top = `${rect.bottom + window.scrollY - 15}px`;
    orb.style.display = 'block';
    orb.style.transform = 'scale(0)';
    setTimeout(() => { orb.style.transform = 'scale(1)'; }, 10);
  } else if (e.target !== orb) {
    orb.style.display = 'none';
  }
});

// Helper: Find and convert images to Base64
async function extractVisuals(root) {
  const images = Array.from(root.querySelectorAll('img, video'));
  const validVisuals = [];

  for (const el of images) {
    // Skip tiny icons/avatars (usually < 50px)
    if (el.width < 50 || el.height < 50) continue;

    let src = el.currentSrc || el.src || el.poster; // Get image or video thumbnail
    if (src && !src.startsWith('data:')) {
      try {
        const base64 = await urlToBase64(src);
        if (base64) validVisuals.push(base64);
      } catch (err) {
        console.log("Visual Cortex: Could not access image", src);
      }
    }
  }
  return validVisuals.slice(0, 3); // Limit to top 3 visuals to save token usage
}

function urlToBase64(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = url;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.7).split(',')[1]); // Return raw base64 string
    };
    img.onerror = () => resolve(null);
  });
}

// --- 2. ORB CLICK (Auto-Pilot with Vision) ---
orb.addEventListener('click', () => {
  orb.style.backgroundImage = 'none';
  orb.style.borderTop = '3px solid #F2A900';
  orb.style.animation = 'repgent-spin 1s linear infinite';
  
  if (!document.getElementById('repgent-orb-style')) {
    const style = document.createElement('style');
    style.id = 'repgent-orb-style';
    style.innerHTML = `@keyframes repgent-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
  }

  chrome.runtime.sendMessage({ 
    action: "orb_generate", 
    text: selectedTextMemory,
    images: selectedVisualsMemory 
  });
});

// --- 3. COMMUNICATION HUB ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ping") { sendResponse({ status: "alive" }); return; }
  
  if (request.action === "scan_page") {
    // When popup is opened, we re-scan for visuals just in case
    const selection = window.getSelection();
    const text = selection.toString().trim();
    
    if (text) {
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentNode;
      const searchArea = container.closest('article') || container.parentElement || container;
      
      extractVisuals(searchArea).then(visuals => {
        sendResponse({ success: true, text: text, images: visuals });
      });
      return true; // Async response
    } else {
      sendResponse({ success: false });
    }
  }

  if (request.action === "ghostwrite") {
    const success = performGhostwrite(request.text);
    sendResponse({ success: success });
  }

  // Handle Orb Feedback (Success/Fail) from Background/Popup
  if (request.action === "orb_complete") {
    resetOrb(request.success);
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

function resetOrb(success = false) {
  orb.style.animation = 'none';
  orb.style.borderTop = 'none';
  orb.style.backgroundColor = success ? '#238636' : '#F85149';
  orb.style.backgroundImage = success ? 'none' : `url('${chrome.runtime.getURL("icon.png")}')`;
  orb.innerHTML = success ? `<div style="color:white; font-size:20px; display:flex; justify-content:center; align-items:center; width:100%; height:100%;">✓</div>` : '';
  setTimeout(() => { 
    orb.style.display = 'none'; 
    orb.innerHTML = ''; 
    orb.style.backgroundColor = '#0D1117';
  }, 2000);
}