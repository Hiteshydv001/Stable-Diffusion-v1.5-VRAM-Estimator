/**
 * VRAM Estimator Frontend Logic
 * Handles API communication and dynamic UI updates
 */

const statusBanner = document.getElementById('status-banner');
const statusText = document.getElementById('status-text');
let backendReady = false;
let backendPollTimer;
const API_BASE_URL = window.__API_BASE_URL__ || (window.location.hostname.endsWith('vercel.app') ? 'https://stable-diffusion-v1-5-vram-estimator.onrender.com' : '');

function apiUrl(path) {
    if (!API_BASE_URL) {
        return path;
    }
    return `${API_BASE_URL}${path}`;
}

/**
 * Show status updates while the Render backend warms up.
 */
function setStatus(message, variant = 'info', persist = true) {
    if (!statusBanner || !statusText) {
        return;
    }
    statusBanner.classList.remove('hidden', 'status-info', 'status-warning', 'status-success');
    statusBanner.classList.add('status-' + variant);
    statusText.textContent = message;
    statusBanner.dataset.persist = persist ? 'true' : 'false';
    if (!persist) {
        hideStatusBanner();
    }
}

function hideStatusBanner(delay = 2500) {
    if (!statusBanner) {
        return;
    }
    setTimeout(() => {
        if (statusBanner.dataset.persist === 'true') {
            return;
        }
        statusBanner.classList.add('hidden');
    }, delay);
}

async function pollBackendOnce() {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 3500);
    try {
        const response = await fetch(apiUrl('/api/health'), {
            signal: controller.signal,
            cache: 'no-store'
        });
        if (response.ok) {
            backendReady = true;
            setStatus('Render backend is ready. You can estimate now.', 'success', false);
            if (backendPollTimer) {
                window.clearInterval(backendPollTimer);
                backendPollTimer = undefined;
            }
            return true;
        }
    } catch (error) {
        // No-op: fall through to show warm-up message.
    } finally {
        window.clearTimeout(timeoutId);
    }

    backendReady = false;
    setStatus('API is waking up on Render. First response can take ~30 seconds...', 'warning');
    return false;
}

function ensureBackendPolling() {
    if (backendPollTimer) {
        return;
    }
    pollBackendOnce();
    backendPollTimer = window.setInterval(() => {
        if (backendReady) {
            window.clearInterval(backendPollTimer);
            backendPollTimer = undefined;
            return;
        }
        pollBackendOnce();
    }, 5000);
}

setStatus('Checking backend status...', 'info');
ensureBackendPolling();

/**
 * Set preset values for quick testing
 */
function setPreset(height, width, promptLength, optimization) {
    document.getElementById('height').value = height;
    document.getElementById('width').value = width;
    document.getElementById('prompt_length').value = promptLength;
    document.getElementById('optimization').checked = optimization;
    
    // Auto-calculate after setting preset
    calculateVRAM();
}

/**
 * Main calculation function - calls the API and displays results
 */
async function calculateVRAM() {
    const height = parseInt(document.getElementById('height').value);
    const width = parseInt(document.getElementById('width').value);
    const prompt_length = parseInt(document.getElementById('prompt_length').value);
    const optimization = document.getElementById('optimization').checked;
    const resultsDiv = document.getElementById('results');

    // Show loading state
    resultsDiv.style.display = 'block';
    resultsDiv.innerHTML = '<p class="loading">Calculating VRAM requirements...</p>';

    // Validate inputs client-side
    if (!height || !width || !prompt_length) {
        showError('Please fill in all fields with valid numbers.');
        return;
    }

    if (height <= 0 || width <= 0) {
        showError('Height and width must be positive numbers.');
        return;
    }

    if (prompt_length < 1 || prompt_length > 77) {
        showError('Prompt length must be between 1 and 77 tokens.');
        return;
    }

    try {
        if (!backendReady) {
            setStatus('Render API is still warming up. Hang tight...', 'warning');
            ensureBackendPolling();
        }

        const response = await fetch(apiUrl('/api/estimate'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                height, 
                width, 
                prompt_length, 
                optimization 
            }),
        });

        const data = await response.json();

        // Handle API errors
        if (data.error) {
            showError(data.error, data.details);
            return;
        }

        backendReady = true;
        setStatus('Prediction ready.', 'success', false);
        // Display successful results
        displayResults(data);

    } catch (error) {
        backendReady = false;
        ensureBackendPolling();
        setStatus('Still waking the API on Render. Retry in a few seconds...', 'warning');
        showError(
            'API Connection Failed', 
            'Could not connect to the backend server. Please ensure the FastAPI server is running.'
        );
        console.error('Fetch error:', error);
    }
}

/**
 * Display error messages
 */
function showError(errorTitle, errorDetails = '') {
    const resultsDiv = document.getElementById('results');
    resultsDiv.style.display = 'block';
    
    let errorHTML = `<div class="error-message">`;
    errorHTML += `<h2 style="margin:0 0 10px 0; font-size:1.05rem; letter-spacing:0.02rem;">Error: ${errorTitle}</h2>`;
    if (errorDetails) {
        errorHTML += `<p style="margin:0; font-size:0.9rem;">${errorDetails}</p>`;
    }
    errorHTML += `</div>`;
    
    resultsDiv.innerHTML = errorHTML;
}

/**
 * Display successful calculation results
 */
function displayResults(data) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.style.display = 'block';
    
    // Get hardware context indicator with enhanced styling
    let hardwareWarning = '';

    if (data.predicted_vram_gb > 24) {
        hardwareWarning = `<p style="margin-top:16px; padding:12px 14px; border:1px solid #111; border-radius:10px; background:#fff; color:#111; font-weight:600;">Requires enterprise-grade GPU (A100 / H100 class).</p>`;
    } else if (data.predicted_vram_gb > 12) {
        hardwareWarning = `<p style="margin-top:16px; padding:12px 14px; border:1px solid #222; border-radius:10px; background:#fdfdfd; color:#111; font-weight:600;">High-end consumer GPU recommended (RTX 3090 / 4090).</p>`;
    } else if (data.predicted_vram_gb > 8) {
        hardwareWarning = `<p style="margin-top:16px; padding:12px 14px; border:1px solid #d1d1d1; border-radius:10px; background:#fff; color:#222;">Mid-range GPU recommended (RTX 3070+).</p>`;
    } else {
        hardwareWarning = `<p style="margin-top:16px; padding:12px 14px; border:1px solid #dcdcdc; border-radius:10px; background:#fff; color:#222;">Entry-level GPU should suffice.</p>`;
    }

    resultsDiv.innerHTML = `
        <h2>Prediction Complete</h2>

        <div style="display:grid; gap:14px; margin:18px 0;">
            <div style="border:1px solid #dcdcdc; border-radius:10px; padding:14px; background:#fff;">
                <p style="margin:0 0 6px 0; font-size:0.85rem; letter-spacing:0.04rem; text-transform:uppercase; color:#666;">Attention Mode</p>
                <p style="margin:0; font-size:1rem; color:#111; font-weight:600;">${data.attention_mode}</p>
            </div>

            <div style="border:1px solid #dcdcdc; border-radius:10px; padding:14px; background:#fff;">
                <p style="margin:0 0 6px 0; font-size:0.85rem; letter-spacing:0.04rem; text-transform:uppercase; color:#666;">Fixed Base Cost</p>
                <p style="margin:0; font-size:1rem; color:#111; font-weight:600;">${data.fixed_cost_gb} GB</p>
                <p style="margin:6px 0 0 0; font-size:0.82rem; color:#777;">Model weights and framework overhead.</p>
            </div>

            <div style="border:1px solid #dcdcdc; border-radius:10px; padding:14px; background:#fff;">
                <p style="margin:0 0 6px 0; font-size:0.85rem; letter-spacing:0.04rem; text-transform:uppercase; color:#666;">Dynamic Activation Cost</p>
                <p style="margin:0; font-size:1rem; color:#111; font-weight:600;">${data.spatial_cost_gb} GB</p>
                <p style="margin:6px 0 0 0; font-size:0.82rem; color:#777;">Image-dependent feature maps and attention.</p>
            </div>
        </div>

        <hr style="border:none; border-top:1px solid #e1e1e1; margin:22px 0;">

        <p class="vram-total">${data.predicted_vram_gb} GB</p>
        <p style="text-align:center; color:#666; font-size:0.9rem; margin-top:8px;">Estimated peak VRAM demand.</p>

        ${hardwareWarning}
    `;
}

/**
 * Add keyboard shortcut for calculation (Enter key)
 */
document.addEventListener('DOMContentLoaded', function() {
    const inputs = document.querySelectorAll('input[type="number"]');
    
    inputs.forEach(input => {
        input.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                calculateVRAM();
            }
        });
    });
    
    // Also add to checkbox
    document.getElementById('optimization').addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            calculateVRAM();
        }
    });
});
