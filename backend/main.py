import io
import re
import zipfile
import pandas as pd
import requests
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from PIL import Image, ImageDraw, ImageFont

app = FastAPI()

@app.get("/")
def read_root():
    return {
        "status": "online",
        "project": "CertFlow Core API Pipeline",
        "message": "System operational. Awaiting incoming frontend payloads."
    }

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def handle_google_sheet_url(url: str) -> pd.DataFrame:
    if "docs.google.com/spreadsheets" not in url:
        raise HTTPException(status_code=400, detail="Invalid Google Sheets URL structure.")
    match = re.search(r"/d/([a-zA-Z0-9-_]+)", url)
    if not match:
        raise HTTPException(status_code=400, detail="Could not parse Spreadsheet ID from URL.")
    
    spreadsheet_id = match.group(1)
    export_url = f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/export?format=csv"
    
    try:
        response = requests.get(export_url, timeout=10)
        if response.status_code == 200:
            return pd.read_csv(io.BytesIO(response.content))
        else:
            raise HTTPException(status_code=400, detail=f"Google Error: {response.status_code}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch Google Sheet: {str(e)}")

@app.post("/generate")
async def generate_certificates(
    template: UploadFile = File(...),
    spreadsheet_file: UploadFile = File(None),
    font_file: UploadFile = File(None),          
    spreadsheet_url: str = Form(None),
    name_column: str = Form(...),
    box_x: float = Form(...),
    box_y: float = Form(...),
    box_w: float = Form(...),
    font_size: int = Form(...),                  
    font_name: str = Form("arial.ttf"),          # NEW: Standard system font name
    display_w: float = Form(...),
    display_h: float = Form(...)
):
    if not spreadsheet_file and not spreadsheet_url:
        raise HTTPException(status_code=400, detail="Provide a spreadsheet data source.")

    if spreadsheet_url:
        df = handle_google_sheet_url(spreadsheet_url)
    else:
        file_bytes = await spreadsheet_file.read()
        filename = spreadsheet_file.filename.lower()
        if filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(file_bytes))
        else:
            df = pd.read_excel(io.BytesIO(file_bytes), engine='openpyxl')

    template_bytes = await template.read()
    font_bytes = await font_file.read() if font_file else None

    # Logic to route custom upload vs standard selection lists
    def load_chosen_font(size):
        if font_bytes:
            return ImageFont.truetype(io.BytesIO(font_bytes), int(size))
        try:
            # Pillow automatically checks standard system folders for these strings on Windows
            return ImageFont.truetype(font_name, int(size))
        except Exception:
            return ImageFont.load_default(size=int(size))

    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
        for index, row in df.iterrows():
            if pd.isna(row[name_column]):
                continue
                
            raw_name = str(row[name_column]).strip()
            clean_name = raw_name.title() 
            
            img = Image.open(io.BytesIO(template_bytes)).convert("RGB")
            orig_w, orig_h = img.size
            
            scale_x = orig_w / display_w
            scale_y = orig_h / display_h
            
            real_x = box_x * scale_x
            real_y = box_y * scale_y
            real_box_w = box_w * scale_x
            real_box_h = font_size * scale_y  # Reconstructs box container ceiling height
            
            draw = ImageDraw.Draw(img)
            
            current_font_size = font_size * scale_x
            font = load_chosen_font(current_font_size)
            
            left, top, right, bottom = draw.textbbox((0, 0), clean_name, font=font)
            text_w = right - left
            
            # Scale text down if it's too wide for the box
            while text_w > real_box_w and current_font_size > 12:
                current_font_size -= 2
                font = load_chosen_font(current_font_size)
                left, top, right, bottom = draw.textbbox((0, 0), clean_name, font=font)
                text_w = right - left
            
            # FIX: Calculate coordinates for the exact middle-bottom of the box
            center_x = real_x + (real_box_w / 2)
            bottom_y = real_y + real_box_h
            
            # FIX: Use anchor="mb" to pin text directly to the bottom line
            draw.text((center_x, bottom_y), clean_name, font=font, fill=(0, 0, 0), anchor="mb")
            
            img_io = io.BytesIO()
            img.save(img_io, "JPEG", quality=95)
            img_io.seek(0)
            
            file_name = f"Certificate_{clean_name.replace(' ', '_')}.jpg"
            zip_file.writestr(file_name, img_io.getvalue())
            
    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer, 
        media_type="application/zip", 
        headers={"Content-Disposition": "attachment; filename=certificates.zip"}
    )