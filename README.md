<div style="font-family: 'Poppins', sans-serif; color: #E6E6E6; line-height: 1.6;">

<div align="center">
  <img src="icon.png" alt="Repgent Logo" width="120" />
  <h1 style="color: #F2A900; margin-top: 15px;">Repgent 🔮</h1>
  <p><b>The Next-Generation AI Reply Agent for Elite Freelancers</b></p>
  
  [![Version](https://img.shields.io/badge/version-4.1-gold.svg)](#)
  [![Manifest](https://img.shields.io/badge/Manifest-V3-brightgreen.svg)](#)
  [![AI](https://img.shields.io/badge/Powered_by-Google_Gemini-blue.svg)](#)
</div>

<hr style="border: 1px solid rgba(255,255,255,0.1);" />

##  Overview

**Repgent** is a futuristic Chrome Extension built to eliminate friction in client acquisition. It doesn't just generate text; it analyzes client psychology, adapts to specific freelance platforms, and auto-injects tailored proposals directly into the browser DOM. 

Designed with a premium "Midnight Slate & Sovereign Gold" UI, Repgent acts as a proactive AI teammate living directly inside your screen.

## God-Tier Features

* 🔮 **The Holographic Orb (DOM Teleportation):** Highlight a job post on any website, and a floating gold orb appears. Click it to auto-generate and inject a perfect reply directly into the page's text box—without ever opening the extension popup.
* 🎙️ **JARVIS Voice Mode:** Don't type your strategy; speak it. Click the mic icon to dictate custom constraints (e.g., *"Tell them I can start tomorrow for $500"*), powered by the Web Speech API.
* 👁️ **Psycho-Sentiment Analysis:** Repgent splits its brain. Before replying, it analyzes the client's emotional state (e.g., 🚨 *Urgent & Stressed*, 👔 *Highly Corporate*) and displays a psychological badge to give you the upper hand.
* 🦎 **The Chameleon:** Automatically detects if you are on Upwork, LinkedIn, Contra, or Fiverr, instantly formatting the reply length and style to match the platform's unwritten rules.
* 👻 **Smart Hunter (DOM Injection):** Built-in intelligent script that hunts down React/content-editable text boxes and types the reply for you letter-by-letter.
* 🧠 **Persistent Memory:** Auto-saves your API key, preferred tone, voice instructions, and last generated reply to `chrome.storage.local`.

## Installation (Developer Mode)

1. Clone or download this repository to your local machine.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Toggle **"Developer mode"** in the top right corner.
4. Click **"Load unpacked"** in the top left.
5. Select the `repgent` folder.
6. Pin the Repgent gold "R" icon to your toolbar!

## Configuration

1. **API Key:** Click the Repgent extension icon. Paste your [Google Gemini API Key](https://aistudio.google.com/app/apikey) in the setup field.
2. **Microphone Setup:** To use JARVIS Voice Mode, click the Mic icon. A secure settings tab will open. Click "Grant Microphone Access" to permanently allow voice dictation.

## Tech Stack

* **Architecture:** Chrome Extension Manifest V3
* **Frontend:** HTML5, CSS3 (Glassmorphism, Custom Animations), JavaScript (ES6+)
* **AI Engine:** Google Gemini 2.5 Flash API (REST via Fetch)
* **APIs Used:** Web Speech API, Chrome Storage API, Chrome Scripting API, Chrome Tabs API

## Security & Privacy (Zero-Knowledge)

Repgent is designed with absolute privacy in mind:
* **No Middleman Servers:** Your API key and proposal data are never sent to a third-party database. All API calls are made directly from your local browser to Google's endpoints.
* **Local Storage:** Your API key is stored securely in your browser's local sandbox environment (`chrome.storage.local`).
* **XSS Protection:** The DOM injector uses `element.value` and `element.innerText`, strictly avoiding `innerHTML` to prevent cross-site scripting attacks.

## UI/UX Design

Repgent features a premium, accessible interface:
* **Palette:** Midnight Slate (`#0D1117`) and Sovereign Gold (`#F2A900`).
* **Typography:** Inter (UI hierarchy) and JetBrains Mono (Data output).
* **Feedback:** Skeleton loading shimmers, haptic button scaling, and smooth CSS cubic-bezier transitions.

---

<div align="center">
  <p>Engineered and Designed by <b>[Cryptzarr]</b></p>
  <p>UX Engineer & Product Developer</p>
</div>

</div>
