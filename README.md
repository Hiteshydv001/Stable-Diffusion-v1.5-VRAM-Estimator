dir app\static
# Stable Diffusion v1.5 VRAM Estimator

Modern toolkit for analytically predicting the peak GPU memory footprint of Stable Diffusion v1.5 inference (FP16). The project combines a FastAPI backend, a lightweight static frontend, and deployment scaffolding for Render (backend) and Vercel (frontend).

---

## Highlights

- Deterministic peak VRAM estimator derived from Stable Diffusion v1.5 architecture analysis.
- FastAPI microservice with production-ready Docker image.
- Responsive monochrome frontend (HTML/CSS/JS) deployable on static hosts.
- Ready-to-use Render (Docker) and Vercel configuration.

---

## Analytical Model

Peak VRAM is decomposed into fixed costs, prompt-dependent cache, and spatial activations:

\[
M_{peak} = C_W + C_O + (C_L \cdot L) + \big( (N_{latent} \cdot K_{iter} \cdot K_{attn}) + M_{latent} \big)
\]

| Term | Description | Notes |
| --- | --- | --- |
## Highlights
- Deterministic peak VRAM estimator derived from Stable Diffusion v1.5 architecture analysis.
- FastAPI microservice with production-ready Docker image and strict CORS rules for hosted frontend.
- Responsive JS frontend that auto-detects deployment target and falls back to inline styles when static assets are unreachable.
- Ready-to-use Render (Docker) and Vercel configuration; Render cold-start banner guides users during wake-up.
| \(K_{iter}\) | UNet iteration factor | 20,000 |
| \(K_{attn}\) | Attention multiplier | 1.0 (optimized) / 1.25 (standard) |
| \(M_{latent}\) | Latent storage | \(N_{latent} \times 4 \times 2\) bytes |

├── Dockerfile                     # Backend container (Render-ready)
├── vercel.json                    # Vercel static deployment config + proxy to backend static
├── requirements.txt               # Global dependency lock (FastAPI stack)
---

## Repository Layout

```
.
├── Dockerfile                     # Backend container (Render-ready)
├── vercel.json                    # Vercel static deployment config
├── requirements.txt               # Global dependency lock (FastAPI stack)
├── vram_estimator/
│   ├── app/
│   │   ├── main.py                # FastAPI application + estimator logic
│   │   └── static/
│   │       ├── index.html         # UI
│   │       ├── script.js          # API interaction + UX
│   │       └── style.css          # Monochrome theme
1. **Create virtualenv (recommended)**
    ```powershell
    python -m venv .venv
    .\.venv\Scripts\Activate.ps1
    ```
│   └── requirements.txt           # Backend dependency list
└── README.md
```

---

## Local Development

1. **Install prerequisites**
   ```powershell
   cd vram_estimator
   pip install -r requirements.txt
   ```

2. **Run the API**
   ```powershell
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

    - Domain: `https://stable-diffusion-v1-5-vram-estimator.onrender.com` (used by the frontend loader).
3. **Open the UI**
   Visit `http://localhost:8000/` to load the estimator page.

4. **Health check**
   ```powershell
   curl http://localhost:8000/api/health
   ```


## Deployment

### Backend on Render (Docker)

1. **Build and push**
   ```powershell
   docker build -t <registry>/sd-vram-estimator .
   docker push <registry>/sd-vram-estimator
   ```

2. **Create Render service**
   - New Web Service → Deploy an existing image.
   - Image: `<registry>/sd-vram-estimator`
   - Start command: (use Docker CMD) `uvicorn app.main:app --host 0.0.0.0 --port 8000 --app-dir vram_estimator`
   - Expose port `8000`.

3. **Configure environment**
   - Auto-deploy on image update.
   - Optional: add environment variables for logging, secrets, etc.

### Frontend on Vercel

1. **Repo import**: Connect GitHub repo in Vercel dashboard.
2. **Build settings**: Vercel reads `vercel.json` and serves `vram_estimator/app/static` as a static site.
3. **Environment variables**: None required; backend URL is referenced in `script.js` (update if deployed backend differs).
4. **Deploy**: Trigger production build; Vercel handles CDN distribution.

---

## API Reference

### `POST /api/estimate`

- Request:
  ```json
  {
    "height": 512,
    "width": 512,
    "prompt_length": 60,
    "optimization": true
  }
  ```
- Response:
  ```json
  {
    "predicted_vram_gb": 3.87,
    "attention_mode": "Optimized (Linear Scaling)",
    "fixed_cost_gb": 2.45,
    "spatial_cost_gb": 1.42
  }
  ```
- Errors:
  - Non-multiple-of-8 dimensions → 400 with guidance message.
  - Prompt length outside 1-77 → 400.

### `GET /api/health`

Returns `{ "status": "healthy", "service": "VRAM Estimator API" }` for monitoring pings.

---

## Frontend Usage

- Set image dimensions (multiples of 8) and prompt length.
- Toggle optimization to simulate xFormers / PyTorch 2.0 attention.
- Quick preset buttons instantly test common resolutions.
- Result panel reports fixed cost, spatial cost, total, and recommended GPU tier.

---

## Validation Playbook

| Scenario | Inputs | Expected Peak VRAM |
| --- | --- | --- |
| Baseline | 512x512, L=77, optimized | ~4.0 GB |
| Non-optimized | 512x512, L=77, standard | ~4.7 GB |
| HD | 768x768, L=77, optimized | ~7.5 GB |
| Ultra | 2048x2048, L=77, standard | ~27 GB |

Use `nvidia-smi` during inference to compare analytical vs measured peaks.

---

## Troubleshooting

- **Dimension error**: ensure height and width are multiples of 8.
- **Module import issues**: re-run `pip install -r requirements.txt`.
- **Port conflict**: change `--port` or terminate prior instances.
- **Frontend cannot reach backend**: update API base URL inside `script.js` when deploying.

---

## Roadmap Ideas

- Extend estimator constants for SD v2, SDXL, ControlNet pipelines.
- Batch-size awareness (currently assumes batch=1).
- Mixed precision variants (FP32, FP8) with calibrated multipliers.
- Automated benchmarking harness for ground-truth validation.

---

## License and Attribution

Released for research and educational purposes. Cite the repository if this model aids your work. Contributions welcome via pull requests.
