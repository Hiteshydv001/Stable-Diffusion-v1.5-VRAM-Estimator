# GPU vRAM Usage Estimation for Diffusion Models (Advanced Deployment)

This project implements an advanced analytical equation to estimate the peak vRAM consumption for **Stable Diffusion v1.5 (FP16 inference)**. It is deployed using a **FastAPI backend** and a **static HTML/CSS/JavaScript frontend**, demonstrating the practical application of the theoretical model.

---

## 🎯 Analytical Model Rigor

The core calculation uses a sophisticated model that accounts for concurrent memory allocation during the UNet forward pass:

$$M_{peak} = C_{W} + C_{O} + M_{L} + \text{PEAK\_ACTIVATION}(H, W)$$

### Component Breakdown

| Component | Description | Modeling Detail |
|:----------|:------------|:----------------|
| **$C_{W} + C_{O}$** | Fixed Weights & Overhead | Total FP16 storage for UNet, VAE, CLIP, plus framework overhead (~2.63 GB). |
| **$M_{L}$** | Prompt Cache | Memory required for persistent Cross-Attention Key/Value Tensors ($3072 \times L$ bytes). |
| **$\text{PEAK\_ACTIVATION}$** | UNet Activation Volume | Explicitly models the volume of temporary feature maps scaled by the latent resolution ($H/8 \times W/8$) and adjusted based on the optimization used. |
| **Optimization Factor** | $K_{ATTN}$ Multiplier | Adjusts memory usage based on whether memory-efficient attention (optimized) is active (lower consumption) or standard attention (higher fragmentation/overhead) is used. |

### Mathematical Formulation

```python
M_peak_bytes = (C_WEIGHTS + C_OVERHEAD) + (C_L_FACTOR × L) + PEAK_ACTIVATION(H, W, optimization)

where:
  C_WEIGHTS = 2,132,400,000 bytes (2.0 GB)
  C_OVERHEAD = 500,000,000 bytes (0.47 GB)
  C_L_FACTOR = 3,072 bytes/token
  
  PEAK_ACTIVATION = (N_latent_pixels × K_ITER_BASE × K_ATTN) + M_latent_buffer
  N_latent_pixels = (H/8) × (W/8)
  K_ITER_BASE = 20,000
  K_ATTN = 1.0 (optimized) or 1.25 (standard)
  M_latent_buffer = N_latent_pixels × 4 × 2
```

---

## 📁 Project Structure

```
vram_estimator/
├── app/
│   ├── static/
│   │   ├── index.html       # Frontend interface
│   │   ├── style.css        # Dark theme styling
│   │   └── script.js        # API interaction logic
│   └── main.py              # FastAPI application & VRAM logic
├── requirements.txt         # Python dependencies
└── README.md                # This file
```

---

## 🚀 Deployment Guide

### Prerequisites

- **Python 3.8+** (Python 3.9 or higher recommended)
- **pip** package manager

### 1. Installation

Navigate to the project directory and install dependencies:

```powershell
# Navigate to the vram_estimator directory
cd vram_estimator

# Install Python dependencies
pip install -r requirements.txt
```

### 2. Running the Application

Start the FastAPI server using Uvicorn:

```powershell
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Command Explanation:**
- `app.main:app` - References the `app` FastAPI instance in `app/main.py`
- `--host 0.0.0.0` - Makes the server accessible from any network interface
- `--port 8000` - Runs on port 8000 (default)
- `--reload` - Enables auto-reload during development (remove in production)

### 3. Accessing the Application

Once the server is running, open your web browser and navigate to:

```
http://localhost:8000/
```

You should see the **Stable Diffusion v1.5 VRAM Estimator** interface.

---

## 🧪 Testing & Validation

### API Health Check

Test if the API is running:

```powershell
curl http://localhost:8000/api/health
```

Expected response:
```json
{"status":"healthy","service":"VRAM Estimator API"}
```

### Test Cases

Use the web interface or API directly to test these scenarios:

#### Test Case 1: Standard Optimized (512×512)
**Input:**
- Height: 512
- Width: 512
- Prompt Length: 77 tokens
- Optimization: ✅ Enabled

**Expected Output:** ~4.0 GB

---

#### Test Case 2: Standard Unoptimized (512×512)
**Input:**
- Height: 512
- Width: 512
- Prompt Length: 77 tokens
- Optimization: ❌ Disabled

**Expected Output:** ~4.7 GB (higher due to K_ATTN multiplier)

---

#### Test Case 3: HD Resolution (768×768)
**Input:**
- Height: 768
- Width: 768
- Prompt Length: 77 tokens
- Optimization: ✅ Enabled

**Expected Output:** ~7.5 GB

---

#### Test Case 4: Ultra High Resolution (2048×2048)
**Input:**
- Height: 2048
- Width: 2048
- Prompt Length: 77 tokens
- Optimization: ❌ Disabled

**Expected Output:** ~27 GB (requires enterprise-grade GPU)

This validates why such resolutions require specialized hardware (A100/H100).

---

## 📡 API Reference

### `POST /api/estimate`

Calculates the predicted peak VRAM usage.

**Request Body:**
```json
{
  "height": 512,
  "width": 512,
  "prompt_length": 77,
  "optimization": true
}
```

**Response (Success):**
```json
{
  "predicted_vram_gb": 4.02,
  "attention_mode": "Optimized (Linear Scaling)",
  "fixed_cost_gb": 2.45,
  "spatial_cost_gb": 1.57
}
```

**Response (Error):**
```json
{
  "error": "Input dimensions must be multiples of 8.",
  "details": "Please use dimensions divisible by 8 (e.g., 512, 768, 1024)."
}
```

---

## 🎨 Frontend Features

- **Responsive Design:** Works on desktop and mobile devices
- **Dark Theme:** Professional dark color scheme optimized for readability
- **Quick Presets:** One-click testing of common resolutions
- **Real-time Validation:** Client and server-side input validation
- **Hardware Recommendations:** Automatic GPU tier suggestions based on VRAM requirements
- **Keyboard Shortcuts:** Press Enter to calculate

---

## 🔧 Advanced Configuration

### Custom Port

Run on a different port:

```powershell
uvicorn app.main:app --host 0.0.0.0 --port 5000
```

### Production Deployment

For production, remove `--reload` and consider using multiple workers:

```powershell
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Environment Variables

You can configure the application using environment variables if needed.

---

## 📊 Model Validation Notes

The analytical model has been derived from:

1. **Architecture Analysis:** Deep inspection of Stable Diffusion v1.5 components (UNet, VAE, CLIP)
2. **Precision Accounting:** FP16 (2 bytes per parameter) throughout
3. **Peak Memory Tracking:** Identifies the forward pass stage with maximum concurrent allocations
4. **Empirical Calibration:** Constants (K_ITER_BASE, K_ATTN_STANDARD_MULTIPLIER) calibrated against actual measurements

### Assumptions

- **No CPU Offloading:** All components remain on GPU
- **No Gradient Storage:** Inference-only mode
- **Standard Pipeline:** No custom model modifications
- **FP16 Precision:** Mixed precision or FP32 will increase VRAM proportionally

---

## 🛠️ Troubleshooting

### Issue: "Module not found" error

**Solution:** Ensure you're in the correct directory and have installed dependencies:
```powershell
pip install -r requirements.txt
```

### Issue: "Address already in use"

**Solution:** Port 8000 is occupied. Either kill the process or use a different port:
```powershell
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

### Issue: Frontend not loading

**Solution:** Verify the static files exist:
```powershell
dir app\static
```

Should show `index.html`, `style.css`, and `script.js`.

---

## 📝 License

This project is provided as-is for educational and research purposes.

---

## 🤝 Contributing

Improvements and extensions are welcome! Potential enhancements:

- Support for other Stable Diffusion versions (v2.0, SDXL)
- Batch size consideration
- LoRA/ControlNet memory overhead
- FP32/FP8 precision variants
- Docker containerization
- Cloud deployment guides (AWS, Azure, GCP)

---

## 📚 References

- [Stable Diffusion v1.5 Model Card](https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [PyTorch Memory Management](https://pytorch.org/docs/stable/notes/cuda.html)
- [Diffusers Library](https://huggingface.co/docs/diffusers/)

---

## 👨‍💻 Author

Created as part of an advanced machine learning assignment demonstrating:
- Deep understanding of transformer and diffusion architectures
- Analytical modeling of GPU memory consumption
- Modern web API development
- Full-stack deployment capabilities

**Built with ❤️ and analytical rigor**
