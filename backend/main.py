import os
import io
import json
import zipfile
from typing import List, Dict
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont

app = FastAPI(title="CertFlow Core API Pipeline")

# Enable CORS middleware for Vercel interaction
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FONTS_DIR = os.path.join(BASE_DIR, "fonts")

# Global in-memory cache to map clean font display names to actual filenames
FONT_REGISTRY: Dict[str, str] = {}

def get_font_display_name(file_path: str) -> str:
    """
    Reads the binary metadata table inside a TTF/OTF file 
    to extract its true human-readable font name.
    """
    try:
        font = TTFont(file_path, fontNumber=0, lazy=True)
        name_table = font['name']
        # Look for Font Family Name (ID 1) or Full Font Name (ID 4)
        for record in name_table.names:
            if record.nameID in (4, 1):
                if record.isUnicode():
                    return record.toUnicode()
                else:
                    return record.string.decode('utf-8', errors='ignore')
    except Exception:
        pass
    # Fallback to filename if metadata is unreadable
    return os.path.basename(file_path)

def refresh_font_registry():
    """
    Scans the fonts directory and builds a clean mapping dictionary.
    """
    global FONT_REGISTRY
    FONT_REGISTRY.clear()
    
    if not os.path.exists(FONTS_DIR):
        os.makedirs(FONTS_DIR)
        return

    for filename in os.listdir(FONTS_DIR):
        ext = filename.lower()
        if ext.endswith(('.ttf', '.otf')):
            full_path = os.path.join(FONTS_DIR, filename)
            display_name = get_font_display_name(full_path)
            # Map the clean name (e.g., "Arial Bold") to the actual file (e.g., "arialbd.ttf")
            FONT_REGISTRY[display_name] = filename

# Initialize the registry mapping immediately on app startup
refresh_font_registry()


@app.get("/")
def read_root():
    return {
        "status": "online",
        "project": "CertFlow Core API Pipeline",
        "registered_fonts_count": len(FONT_REGISTRY)
    }


@app.get("/fonts")
def get_available_fonts():
    """
    Endpoint for your React frontend. Call this to get an array 
    of all real font names available to display in your UI dropdown.
    """
    # Force a refresh to catch any new file systems additions
    refresh_font_registry()
    return {"fonts": sorted(list(FONT_REGISTRY.keys()))}


@app.post("/generate")
async def generate_certificates(
    template: UploadFile = File(...),
    names: str = Form(...),
    box_x: int = Form(...),
    box_y: int = Form(...),
    box_width: int = Form(...),
    box_height: int = Form(...),
    font_size: int = Form(...),
    font_name: str = Form(...)  # Expects the clean display name chosen from the UI dropdown
):
    try:
        # 1. Parse name rows safely
        try:
            name_list = json.loads(names)
        except Exception:
            name_list = [n.strip() for n in names.split(",") if n.strip()]

        # 2. Resolve the requested font display name to its real system filename
        # Case-insensitive matching fallback logic
        actual_filename = FONT_REGISTRY.get(font_name)
        if not actual_filename:
            # Try to match case-insensitively if things get mismatched
            for display, file in FONT_REGISTRY.items():
                if display.lower() == font_name.lower():
                    actual_filename = file
                    break

        if actual_filename:
            font_path = os.path.join(FONTS_DIR, actual_filename)
        else:
            font_path = None

        template_bytes = await template.read()
        zip_buffer = io.BytesIO()
        
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            for name in name_list:
                image = Image.open(io.BytesIO(template_bytes)).convert("RGB")
                draw = ImageDraw.Draw(image)
                
                current_font_size = font_size
                font = ImageFont.load_default()
                text_width, text_height = 0, 0

                # 3. Dynamic layout text scaling loop
                while current_font_size > 12:
                    if font_path:
                        try:
                            font = ImageFont.truetype(font_path, size=current_font_size)
                        except Exception:
                            font = ImageFont.load_default()
                            break
                    else:
                        font = ImageFont.load_default()
                        break

                    try:
                        bbox = draw.textbbox((0, 0), name, font=font)
                        text_width = bbox[2] - bbox[0]
                        text_height = bbox[3] - bbox[1]
                    except AttributeError:
                        text_width, text_height = draw.textsize(name, font=font)

                    if text_width <= box_width and text_height <= box_height:
                        break
                    current_font_size -= 2

                # 4. Canvas centering alignment stamps
                target_x = box_x + (box_width - text_width) // 2
                target_y = box_y + (box_height - text_height) // 2
                draw.text((target_x, target_y), name, fill=(0, 0, 0), font=font)
                
                img_byte_arr = io.BytesIO()
                image.save(img_byte_arr, format="JPEG", quality=95)
                img_byte_arr.seek(0)
                
                sanitized_name = "".join(c for c in name if c.isalnum() or c in (" ", "_", "-")).rstrip()
                file_name = f"Certificate_{sanitized_name.replace(' ', '_')}.jpg"
                zip_file.writestr(file_name, img_byte_arr.read())
        
        zip_buffer.seek(0)
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=CertFlow_Batch.zip"}
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline error: {str(e)}")