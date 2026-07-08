import os
import io
import re
import csv
import zipfile
import requests
import pandas as pd
from typing import List, Dict, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont

app = FastAPI(title="AutoCert — Bulk Certificate Download")

# Global CORS Policy Link matching your client hosting environments
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FONTS_DIR = os.path.join(BASE_DIR, "fonts")
FONT_REGISTRY: Dict[str, str] = {}

def get_font_display_name(file_path: str) -> str:
    """Reads embedded binary metadata tables to extract true font name."""
    try:
        font = TTFont(file_path, fontNumber=0, lazy=True)
        name_table = font['name']
        for record in name_table.names:
            if record.nameID in (4, 1):
                return record.toUnicode() if record.isUnicode() else record.string.decode('utf-8', errors='ignore')
    except Exception:
        pass
    return os.path.basename(file_path)

def refresh_font_registry():
    global FONT_REGISTRY
    FONT_REGISTRY.clear()
    if not os.path.exists(FONTS_DIR):
        os.makedirs(FONTS_DIR)
        return
    for filename in os.listdir(FONTS_DIR):
        if filename.lower().endswith(('.ttf', '.otf')):
            full_path = os.path.join(FONTS_DIR, filename)
            display_name = get_font_display_name(full_path)
            FONT_REGISTRY[display_name] = filename

# Boot up initialization and directory scanning
refresh_font_registry()

@app.get("/fonts")
def get_available_fonts():
    refresh_font_registry()
    return {"fonts": sorted(list(FONT_REGISTRY.keys()))}

@app.post("/generate")
async def generate_certificates(
    template: UploadFile = File(...),
    name_column: str = Form(...),
    box_x: int = Form(...),
    box_y: int = Form(...),
    box_w: int = Form(...),
    font_size: int = Form(...),
    font_name: str = Form(...),
    display_w: int = Form(...),
    display_h: int = Form(...),
    font_file: Optional[UploadFile] = File(None),
    spreadsheet_file: Optional[UploadFile] = File(None),
    spreadsheet_url: Optional[str] = Form(None)
):
    try:
        # --- 1. Extract Recipient Names Array From Multi-source Data Pipeline ---
        recipient_names: List[str] = []

        if spreadsheet_file:
            file_bytes = await spreadsheet_file.read()
            filename = spreadsheet_file.filename.lower()
            
            if filename.endswith('.csv'):
                stream = io.StringIO(file_bytes.decode('utf-8', errors='ignore'))
                df = pd.read_csv(stream)
            elif filename.endswith(('.xlsx', '.xls')):
                df = pd.read_excel(io.BytesIO(file_bytes))
            else:
                raise HTTPException(status_code=400, detail="Invalid extension. Provide CSV or Excel formatting.")
            
            if name_column not in df.columns:
                raise HTTPException(status_code=400, detail=f"Column target '{name_column}' missing. Found: {list(df.columns)}")
            recipient_names = df[name_column].dropna().astype(str).map(str.strip).tolist()

        elif spreadsheet_url:
            # Reconstruct Google Sheets browser links into structural clean CSV stream export vectors
            sheet_match = re.search(r"/spreadsheets/d/([a-zA-Z0-9-_]+)", spreadsheet_url)
            if not sheet_match:
                raise HTTPException(status_code=400, detail="Malformed Google Sheets URL pattern parsed.")
            
            export_url = f"https://docs.google.com/spreadsheets/d/{sheet_match.group(1)}/export?format=csv"
            response = requests.get(export_url, timeout=15)
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Target spreadsheet restricted. Share file access as 'Anyone with link can view'.")
            
            stream = io.StringIO(response.text)
            df = pd.read_csv(stream)
            if name_column not in df.columns:
                raise HTTPException(status_code=400, detail=f"Column target '{name_column}' missing in Google Sheet headers.")
            recipient_names = df[name_column].dropna().astype(str).map(str.strip).tolist()
        
        else:
            raise HTTPException(status_code=400, detail="Data source missing. Provide a spreadsheet file or Google Sheets stream link.")

        if not recipient_names:
            raise HTTPException(status_code=400, detail="Target compilation names array resolved completely empty.")

        # --- 2. Font File Override Processing Handling ---
        custom_font_bytes = await font_file.read() if font_file else None

        # --- 3. Process Structural Coordinates Transformation Math ---
        template_bytes = await template.read()
        base_image = Image.open(io.BytesIO(template_bytes)).convert("RGB")
        actual_w, actual_h = base_image.size

        # Project visual browser workspace dimensions out onto raw image resolution boundaries
        scale_x = actual_w / display_w
        scale_y = actual_h / display_h

        real_x = int(box_x * scale_x)
        real_y = int(box_y * scale_y)
        real_w = int(box_w * scale_x)
        real_base_font_size = int(font_size * scale_x)

        # --- 4. Render Engine Zip Loop Engine ---
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            for name in recipient_names:
                img = base_image.copy()
                draw = ImageDraw.Draw(img)
                
                current_size = real_base_font_size
                font = ImageFont.load_default()
                text_w, text_h = 0, 0

                # Dynamic Auto-scaling Loop Engine
                while current_size > 10:
                    try:
                        if custom_font_bytes:
                            font = ImageFont.truetype(io.BytesIO(custom_font_bytes), size=current_size)
                        else:
                            mapped_file = FONT_REGISTRY.get(font_name, font_name)
                            font_path = os.path.join(FONTS_DIR, mapped_file)
                            font = ImageFont.truetype(font_path, size=current_size) if os.path.exists(font_path) else ImageFont.load_default()
                    except Exception:
                        font = ImageFont.load_default()

                    # Measure visible bounds
                    try:
                        bbox = draw.textbbox((0, 0), name, font=font)
                        text_w, text_h = bbox[2] - bbox[0], bbox[3] - bbox[1]
                    except AttributeError:
                        text_w, text_h = draw.textsize(name, font=font)

                    if text_w <= real_w:
                        break
                    current_size -= 2

                # --- FIX: METRICS ALIGNMENT CORRECTION FOR OVERLAPPING TEXT ---
                # Centers the text bounding footprint horizontally within layout limits
                target_x = real_x + (real_w - text_w) // 2
                
                # Dynamic buffer prevents lower font parts (descenders) from breaking past the bottom border.
                baseline_safety_margin = int(current_size * 0.12)
                target_y = real_y + real_base_font_size - baseline_safety_margin

                # Render with text anchor tracking tied to Left-baseline mode ("ls")
                draw.text(
                    (target_x, target_y), 
                    name, 
                    fill=(0, 0, 0), 
                    font=font, 
                    anchor="ls"
                )
                
                out_stream = io.BytesIO()
                img.save(out_stream, format="JPEG", quality=95)
                out_stream.seek(0)
                
                # Sanitize name string inputs to keep generated directory structures healthy
                clean_filename = "".join(c for c in name if c.isalnum() or c in (" ", "_", "-")).rstrip()
                zip_file.writestr(f"Certificate_{clean_filename.replace(' ', '_')}.jpg", out_stream.read())

        zip_buffer.seek(0)
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=CertFlow_Batch_Output.zip"}
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Execution pipeline failure: {str(e)}")