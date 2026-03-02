document.getElementById('grantBtn').addEventListener('click', async () => {
  const btn = document.getElementById('grantBtn');
  const status = document.getElementById('status');
  
  // 1. Give immediate visual feedback
  btn.innerText = "Waiting for you to click 'Allow' in the top left...";
  btn.style.opacity = "0.7";
  btn.style.pointerEvents = "none"; 
  status.style.display = 'none';

  try {
    // 2. Trigger Chrome's native permission box
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // 3. Stop the mic immediately
    stream.getTracks().forEach(track => track.stop());
    
    // 4. Success UI
    btn.style.display = 'none';
    status.style.display = 'block';
    status.style.color = '#238636'; // Green
    status.innerText = "✓ Access Granted! You can safely close this tab.";
    
  } catch (err) {
    // 5. Error UI (If Chrome blocked it)
    console.error("Mic Error:", err);
    btn.innerText = "Grant Microphone Access";
    btn.style.opacity = "1";
    btn.style.pointerEvents = "auto";
    
    status.style.display = 'block';
    status.style.color = '#F85149'; // Red
    status.innerText = "✕ Access Denied. Please allow mic in site settings.";
  }
});