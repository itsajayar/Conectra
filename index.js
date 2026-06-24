// Theme Toggling
const themeToggle = document.getElementById("theme-toggle");
const body = document.body;

// Retrieve saved theme preference
const savedTheme = localStorage.getItem("theme") || "dark";
if (savedTheme === "light") {
    body.classList.add("light-theme");
    body.classList.remove("dark-theme");
} else {
    body.classList.add("dark-theme");
    body.classList.remove("light-theme");
}

themeToggle.addEventListener("click", () => {
    if (body.classList.contains("dark-theme")) {
        body.classList.replace("dark-theme", "light-theme");
        localStorage.setItem("theme", "light");
    } else {
        body.classList.replace("light-theme", "dark-theme");
        localStorage.setItem("theme", "dark");
    }
});

// Toast notification function
function showToast(message) {
    const toast = document.getElementById("copy-toast");
    toast.textContent = message;
    toast.classList.remove("hidden");
    toast.classList.add("show");
    
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.classList.add("hidden"), 300);
    }, 2500);
}

// State variables
let currentDirectLink = "";

// Link Extraction Handler
async function handleExtraction() {
    const urlInput = document.getElementById("gphotos-url");
    const extractBtn = document.getElementById("extract-btn");
    const errorDiv = document.getElementById("url-error");
    const loadingPanel = document.getElementById("loading-panel");
    const resultPanel = document.getElementById("result-panel");
    const playerContainer = document.getElementById("player-container");
    
    const url = urlInput.value.trim();
    
    // Reset states
    errorDiv.style.display = "none";
    errorDiv.textContent = "";
    resultPanel.classList.add("hidden");
    playerContainer.innerHTML = "";
    
    // Simple validation
    if (!url) {
        showError("Please enter a Google Photos URL!");
        return;
    }
    
    if (!url.includes("photos.app.goo.gl") && !url.includes("photos.google.com")) {
        showError("Please enter a valid Google Photos shared link (should contain photos.app.goo.gl or photos.google.com)");
        return;
    }
    
    // Set UI loading
    extractBtn.disabled = true;
    extractBtn.classList.add("loading");
    urlInput.disabled = true;
    loadingPanel.classList.remove("hidden");
    
    const statusMsg = document.getElementById("loading-status");
    statusMsg.textContent = "Connecting to Google Photos...";
    
    // Dynamic status messages to make it feel responsive
    const statusInterval = setInterval(() => {
        if (statusMsg.textContent.includes("Connecting")) {
            statusMsg.textContent = "Resolving redirects...";
        } else if (statusMsg.textContent.includes("Resolving")) {
            statusMsg.textContent = "Extracting video stream link...";
        } else if (statusMsg.textContent.includes("Extracting")) {
            statusMsg.textContent = "Configuring 10Gbps CDN route...";
        }
    }, 1500);
    
    try {
        const response = await fetch("/api/extract", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ url: url })
        });
        
        clearInterval(statusInterval);
        const result = await response.json();
        
        if (!response.ok || result.error) {
            throw new Error(result.error || "Failed to extract link");
        }
        
        // Success! Populate result panel
        currentDirectLink = result.direct_link;
        
        document.getElementById("media-title").textContent = result.title;
        const badge = document.getElementById("media-badge");
        
        const streamUrl = `/api/stream?url=${encodeURIComponent(result.direct_link)}`;
        const downloadUrl = `/api/download-page?url=${encodeURIComponent(result.direct_link)}`;
        
        if (result.is_video) {
            badge.textContent = "VIDEO";
            badge.style.backgroundColor = "rgba(6, 182, 212, 0.15)";
            badge.style.color = "var(--accent-secondary)";
            
            // Render video player
            playerContainer.innerHTML = `
                <video id="video-player" controls preload="metadata" playsinline>
                    <source src="${streamUrl}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
            `;
        } else {
            badge.textContent = "IMAGE";
            badge.style.backgroundColor = "rgba(139, 92, 246, 0.15)";
            badge.style.color = "var(--accent-primary)";
            
            // Render high-res image
            playerContainer.innerHTML = `
                <div style="width:100%; height:100%; overflow:auto; display:flex; justify-content:center; align-items:center; background:#111;">
                    <img src="${streamUrl}" style="max-width:100%; max-height:100%; object-fit:contain;" alt="${result.title}">
                </div>
            `;
        }
        
        // Setup buttons
        const downloadBtn = document.getElementById("btn-download");
        downloadBtn.href = downloadUrl;
        
        // Play in VLC (VLC can open network streams using protocol handler vlc://http://...)
        const hostUrl = window.location.origin;
        const fullStreamUrl = `${hostUrl}${streamUrl}`;
        const externalBtn = document.getElementById("btn-external");
        externalBtn.href = `vlc://${fullStreamUrl}`;
        
        // Show result panel
        resultPanel.classList.remove("hidden");
        
        // Scroll to results smoothly
        setTimeout(() => {
            resultPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
        
    } catch (err) {
        clearInterval(statusInterval);
        showError(err.message);
    } finally {
        // Reset loading UI
        extractBtn.disabled = false;
        extractBtn.classList.remove("loading");
        urlInput.disabled = false;
        loadingPanel.classList.add("hidden");
    }
}

// Error Helper
function showError(message) {
    const errorDiv = document.getElementById("url-error");
    errorDiv.textContent = message;
    errorDiv.style.display = "block";
    errorDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Copy to clipboard
function copyStreamLink() {
    if (!currentDirectLink) return;
    
    const streamUrl = `/api/stream?url=${encodeURIComponent(currentDirectLink)}`;
    const fullUrl = `${window.location.origin}${streamUrl}`;
    
    navigator.clipboard.writeText(fullUrl).then(() => {
        showToast("Stream URL copied to clipboard!");
    }).catch(err => {
        showToast("Failed to copy link. Please copy manually.");
    });
}
