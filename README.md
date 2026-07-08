# AutoCert — Bulk Certificate Download v1.0.1

AutoCert is a high-throughput, web-based administrative tool designed to automate the generation of customized certificates at scale. By combining a dynamic React frontend workspace with an asynchronous FastAPI processing pipeline, CertFlow allows users to visually map text boundaries onto graphic templates and compile hundreds of personalized certificates into a single deployment-ready ZIP package in seconds.

---

## Core Features

* **Live Layout Alignment Engine:** An interactive visual canvas that lets you adjust text placement (X/Y coordinates), bounding box limits, and target font base sizing with live bounding-box updates.
* **Intelligent Auto-Scaling Logic:** Text dynamically shrinks down *only* if a recipient's name overflows the custom-configured bounding width constraint, preventing text clipping.
* **Middle-Bottom Alignment (Baseline Snap):** Uses precision anchoring (`anchor="mb"`) to ensure text consistently sits perfectly on the designated baseline floor, maintaining design uniformity regardless of font scaling.
* **Multi-Source Data Ingestion:** Supports local file uploads (`.csv`, `.xlsx`, `.xls`) with automatic header parsing, as well as live streaming from public Google Sheets URLs.
* **Canva-Style Typography Suite:** Built-in support for core system typefaces (Arial, Times New Roman, Georgia, Impact, etc.) alongside a custom `.ttf` / `.otf` font file upload override mechanism.

---

## Tech Stack

### Backend
* **FastAPI:** High-performance, asynchronous ASGI web framework for Python.
* **Pillow (PIL):** Specialized image processing library for canvas rendering and typography layout modeling.
* **Pandas & OpenPyXL:** Data analysis engine for structured spreadsheet parsing.

### Frontend
* **React (Vite):** Fast, modern SPA build tooling for the user interface.
* **PapaParse:** Fast client-side CSV parser for instant data preview and column mapping.

---

## Local Installation & Setup

### Prerequisites
* Python 3.10+ (Fully compatible up to Python 3.14)
* Node.js (v18+)

### 1. Backend Architecture Setup
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
