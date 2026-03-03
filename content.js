// content.js - FINAL CHOREOGRAPHED VERSION (Spin -> Green -> Wait 2s -> Insert)
console.log("Repgent: Content Active");

// --- 1. THE HOLOGRAPHIC ORB ---
const orb = document.createElement('div');
orb.id = "repgent-hologram";
orb.style.cssText = `
  position: absolute; display: none; z-index: 2147483647; 
  width: 36px; height: 36px; border-radius: 50%;
  background-color: #0D1117; 
  background-image: url('${chrome.runtime.getURL("icon.png")}');
  background-size: 65%; background-position: center; background-repeat: no-repeat;
  box-shadow: 0 4px 15px rgba(242, 169, 0, 0.5), 0 0 0 2px rgba(242, 169, 0, 0.2);
  cursor: pointer; transition: transform 0.2s ease, top 0.2s ease, left 0.2s ease;
`;
document.body.appendChild(orb);

// Inject Keyframes for Animations
const styleSheet = document.createElement("style");
styleSheet.innerText = `
  @keyframes repgent-pop { 0% { transform: scale(0); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
  @keyframes repgent-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
`;
document.head.appendChild(styleSheet);

// Orb Interactions
orb.addEventListener('mouseenter', () => {
    // Only scale if NOT currently spinning/processing
    if (orb.style.animationName !== 'repgent-spin') {
        orb.style.transform = 'scale(1.1)';
    }
});
orb.addEventListener('mouseleave', () => {
    if (orb.style.animationName !== 'repgent-spin') {
        orb.style.transform = 'scale(1)';
    }
});

// Prevent Focus Loss
orb.addEventListener('mousedown', (e) => {
  e.preventDefault(); 
  e.stopPropagation();
});

let selectedTextMemory = "";
let currentSelectionRange = null; 

// --- ORB POSITIONING ---
document.addEventListener('mouseup', (e) => {
  setTimeout(() => {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    
    if (text.length > 5) { 
      selectedTextMemory = text;
      if (selection.rangeCount > 0) {
        currentSelectionRange = selection.getRangeAt(0).cloneRange();
        const rect = currentSelectionRange.getBoundingClientRect();
        
        const topPos = rect.bottom + window.scrollY + 12;
        const leftPos = rect.right + window.scrollX + 5;

        orb.style.top = `${topPos}px`;
        orb.style.left = `${leftPos}px`;
        orb.style.display = 'block';
        
        // RESET STATE ON APPEAR (Crucial for "Black Circle" fix)
        orb.style.backgroundImage = `url('${chrome.runtime.getURL("icon.png")}')`;
        orb.style.backgroundColor = '#0D1117';
        orb.innerHTML = ''; 
        orb.style.borderTop = 'none';
        orb.style.animation = 'repgent-pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      }
    } else if (e.target !== orb) {
      orb.style.display = 'none';
    }
  }, 10);
});

// --- ORB CLICK ACTION ---
orb.addEventListener('click', async (e) => {
  e.preventDefault(); e.stopPropagation();

  // 1. IMMEDIATE SPIN (The "Rolling" Fix)
  orb.style.backgroundImage = 'none';
  orb.style.borderTop = '3px solid #F2A900'; // Gold spinner border
  orb.style.backgroundColor = '#0D1117';
  orb.innerHTML = '';
  // Force the animation
  orb.style.animation = 'none';
  orb.offsetHeight; /* trigger reflow */
  orb.style.animation = 'repgent-spin 0.8s linear infinite';

  // 2. Visual Scan (Timeout Protected)
  let visuals = [];
  try {
    const visualPromise = getVisualsFromRange(currentSelectionRange);
    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve([]), 1500));
    visuals = await Promise.race([visualPromise, timeoutPromise]);
  } catch (err) {}

  // 3. Send to Background
  chrome.runtime.sendMessage({ 
    action: "orb_generate", 
    text: selectedTextMemory,
    images: visuals 
  });
});

// --- COMMUNICATION HUB ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ping") { sendResponse({ status: "alive" }); return; }
  
  // SCAN PAGE REQUEST
  if (request.action === "scan_page") {
    const selection = window.getSelection();
    let text = selection.toString().trim();
    if (!text && selectedTextMemory) text = selectedTextMemory;
    if (text) {
      let range = selection.rangeCount > 0 ? selection.getRangeAt(0) : currentSelectionRange;
      getVisualsFromRange(range).then(visuals => { sendResponse({ success: true, text: text, images: visuals }); });
      return true; 
    } else { sendResponse({ success: false }); }
  }

  // --- THE SEQUENCE LOGIC (Sync Fix) ---
  if (request.action === "orb_complete") {
    if (request.success) {
      // STEP 1: Stop Spinning & Turn Green Immediately
      setOrbSuccessState();

      // STEP 2: Pause for 2 Seconds (while Green)
      setTimeout(() => {
        
        // STEP 3: Insert & Scroll
        universalGhostwrite(request.text);
        
        // STEP 4: Hide/Reset after a short delay (so user sees it worked)
        setTimeout(() => resetOrbToDefault(), 1500);

      }, 2000); // The 2-second pause requested
    } else {
      setOrbErrorState();
    }
  }

  if (request.action === "ghostwrite") {
    const success = universalGhostwrite(request.text);
    sendResponse({ success: success });
  }
});

// --- VISUAL STATE HELPERS ---

function setOrbSuccessState() {
  orb.style.animation = 'none'; // Stop rolling
  orb.style.borderTop = 'none';
  orb.style.backgroundColor = '#238636'; // Green
  orb.style.backgroundImage = 'none'; 
  orb.innerHTML = `<div style="color:white; font-size:20px; display:flex; justify-content:center; align-items:center; width:100%; height:100%;">✓</div>`;
}

function setOrbErrorState() {
  orb.style.animation = 'none';
  orb.style.borderTop = 'none';
  orb.style.backgroundColor = '#F85149'; // Red
  orb.innerHTML = `<div style="color:white; font-size:20px; display:flex; justify-content:center; align-items:center; width:100%; height:100%;">✕</div>`;
  setTimeout(() => resetOrbToDefault(), 2000);
}

function resetOrbToDefault() {
  orb.style.display = 'none'; 
  orb.innerHTML = ''; 
  orb.style.backgroundColor = '#0D1117';
  orb.style.borderTop = 'none';
  // Restore Icon
  orb.style.backgroundImage = `url('${chrome.runtime.getURL("icon.png")}')`;
}


// --- INSERTION & SCROLLING ---
function universalGhostwrite(text) {
  const target = findBestInput();
  if (!target) return false;

  // 1. FOCUS
  target.focus();

  // 2. SCROLL (Delayed slightly to ensure browser registers focus)
  setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);

  // 3. VISUAL FEEDBACK ON BOX
  const originalShadow = target.style.boxShadow;
  target.style.transition = "box-shadow 0.3s"; 
  target.style.boxShadow = "0 0 0 4px #238636"; // Green Glow on box
  setTimeout(() => target.style.boxShadow = originalShadow, 1000);

  // 4. INSERT TEXT
  if (target.isContentEditable || target.getAttribute('role') === 'textbox') {
    const success = document.execCommand('insertText', false, text);
    if (!success) target.innerText = text;
    target.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
  if (nativeSetter) nativeSetter.call(target, text); else target.value = text;
  target.dispatchEvent(new Event('input', { bubbles: true }));
  target.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function findBestInput() {
  const active = document.activeElement;
  if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT' || active.isContentEditable)) return active;
  const textareas = Array.from(document.querySelectorAll('textarea, [contenteditable="true"], [role="textbox"]'));
  return textareas.find(el => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 20 && window.getComputedStyle(el).visibility !== 'hidden';
  }) || null;
}


// --- VISUAL SCANNING ---
async function getVisualsFromRange(range) {
  if (!range) return [];
  try {
    const container = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentNode;
    const searchArea = container.closest('article, section, [role="main"]') || container.parentElement || container;
    return await extractMultimodalData(searchArea);
  } catch (e) { return []; }
}

async function extractMultimodalData(root) {
  if (!root) return [];
  const visuals = [];
  const videos = Array.from(root.querySelectorAll('video'));
  for (const video of videos) {
    if (video.offsetWidth < 100) continue; 
    const frames = await captureVideoFrames(video);
    if (frames.length > 0) visuals.push(...frames);
    else if (video.poster) {
      const poster = await urlToBase64(video.poster);
      if (poster) visuals.push(poster);
    }
    if (visuals.length >= 2) break;
  }
  if (visuals.length < 2) {
    const images = Array.from(root.querySelectorAll('img'));
    for (const img of images) {
      if (img.width < 100 || img.height < 100) continue;
      let src = img.currentSrc || img.src;
      if (src && !src.startsWith('data:')) {
        const base64 = await urlToBase64(src);
        if (base64) visuals.push(base64);
      }
      if (visuals.length >= 2) break;
    }
  }
  return visuals;
}

async function captureVideoFrames(videoEl) {
  try {
    if (videoEl.crossOrigin !== "anonymous") videoEl.setAttribute('crossOrigin', 'anonymous');
    const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 270;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
    return [data];
  } catch (e) { return []; }
}

function urlToBase64(url) {
  return new Promise((resolve) => {
    const img = new Image(); img.crossOrigin = 'Anonymous'; img.src = url;
    img.onload = () => {
      const scale = Math.min(512 / Math.max(img.width, img.height), 1);
      const canvas = document.createElement('canvas'); canvas.width = img.width * scale; canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.5).split(',')[1]); 
    };
    img.onerror = () => resolve(null);
  });
}