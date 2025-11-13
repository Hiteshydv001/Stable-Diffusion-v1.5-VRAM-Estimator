from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import os
from fastapi.middleware.cors import CORSMiddleware

# --- ADVANCED VRAM ESTIMATION LOGIC (Simplified from notebook for API) ---

# --- CORE CONSTANTS (Derived from FP16 Stable Diffusion v1.5 Architecture) ---
C_WEIGHTS_BYTES = 2_132_400_000 
C_OVERHEAD_BYTES = 500_000_000 
C_L_FACTOR = 3072
K_ITER_BASE = 20000 
K_ATTN_STANDARD_MULTIPLIER = 1.25 

def bytes_to_gb(b):
    """Converts bytes to gigabytes for readability."""
    return b / (1024**3)

def f_estimate(h: int, w: int, prompt_length: int, use_optimized: bool) -> tuple[float, str]:
    """
    Core VRAM estimation function.
    
    Args:
        h: Image height in pixels
        w: Image width in pixels
        prompt_length: Tokenized prompt length (max 77)
        use_optimized: Whether memory-efficient attention is enabled
    
    Returns:
        Tuple of (estimated_vram_gb, attention_mode_description)
    """
    
    # 1. Fixed Costs
    M_fixed = C_WEIGHTS_BYTES + C_OVERHEAD_BYTES

    # 2. Prompt Cost (M_CAP)
    M_prompt = C_L_FACTOR * prompt_length 
    
    # 3. Dynamic Activation Cost
    latent_h = h / 8
    latent_w = w / 8
    
    if latent_h != int(latent_h) or latent_w != int(latent_w):
        return -1.0, "Input dimensions must be multiples of 8."

    N_latent_pixels = latent_h * latent_w 
    M_latent_buffer = N_latent_pixels * 4 * 2  # Latent storage
    M_unet_intermediate = N_latent_pixels * K_ITER_BASE

    if use_optimized:
        attn_multiplier = 1.0
        mode_str = "Optimized (Linear Scaling)"
    else:
        attn_multiplier = K_ATTN_STANDARD_MULTIPLIER 
        mode_str = "Standard (Quadratic Overhead)"
        
    M_unet_intermediate_adjusted = M_unet_intermediate * attn_multiplier
    M_peak_activation = M_unet_intermediate_adjusted + M_latent_buffer

    M_peak_bytes = M_fixed + M_prompt + M_peak_activation
    
    return bytes_to_gb(M_peak_bytes), mode_str

# --- FASTAPI SETUP ---

app = FastAPI(
    title="SD v1.5 VRAM Estimator",
    description="Analytical prediction of peak vRAM usage for Stable Diffusion v1.5 (FP16 inference)",
    version="1.0.0"
)

allowed_origins = [
    "https://stable-diffusion-v1-5-vram-estimato.vercel.app",
    "https://stable-diffusion-v1-5-vram-estimator.onrender.com",
    "http://localhost",
    "http://localhost:8000",
    "http://127.0.0.1",
    "http://127.0.0.1:8000"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the static files (HTML, CSS, JS) directory
current_dir = os.path.dirname(os.path.abspath(__file__))
static_path = os.path.join(current_dir, "static")

# Ensure static directory exists
if os.path.exists(static_path):
    app.mount("/static", StaticFiles(directory=static_path), name="static")

class VramRequest(BaseModel):
    height: int
    width: int
    prompt_length: int
    optimization: bool

@app.get("/", response_class=HTMLResponse)
async def serve_frontend():
    """Serves the main HTML page."""
    index_path = os.path.join(current_dir, "static", "index.html")
    try:
        with open(index_path, 'r', encoding='utf-8') as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(
            content="<h1>Error: Frontend not found</h1><p>Please ensure static/index.html exists.</p>",
            status_code=404
        )

@app.post("/api/estimate")
async def estimate_vram_endpoint(request: VramRequest):
    """
    API endpoint to calculate VRAM usage.
    
    Args:
        request: VramRequest containing height, width, prompt_length, and optimization flag
    
    Returns:
        JSON response with predicted VRAM and breakdown
    """
    
    # Validate inputs
    if request.height <= 0 or request.width <= 0:
        return {"error": "Invalid dimensions", "details": "Height and width must be positive integers."}
    
    if request.prompt_length < 1 or request.prompt_length > 77:
        return {"error": "Invalid prompt length", "details": "Prompt length must be between 1 and 77 tokens."}
    
    # Run the advanced model
    result_gb, mode = f_estimate(
        request.height,
        request.width,
        request.prompt_length,
        request.optimization
    )

    if result_gb < 0:
        return {"error": mode, "details": "Please use dimensions divisible by 8 (e.g., 512, 768, 1024)."}
    
    fixed_cost_gb = bytes_to_gb(C_WEIGHTS_BYTES + C_OVERHEAD_BYTES)
    
    # Return detailed breakdown
    return {
        "predicted_vram_gb": round(result_gb, 2),
        "attention_mode": mode,
        "fixed_cost_gb": round(fixed_cost_gb, 2),
        "spatial_cost_gb": round(result_gb - fixed_cost_gb, 2)
    }

@app.get("/api/health")
async def health_check():
    """Simple health check endpoint."""
    return {"status": "healthy", "service": "VRAM Estimator API"}

# To run: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
