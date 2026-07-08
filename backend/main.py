import os
import io
import json
import zipfile
from typing import List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from PIL import Image, ImageDraw, ImageFont

app = FastAPI(title="CertFlow Core API Pipeline")

# Enable CORS middleware so your Vercel frontend can securely talk to your Render backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins. For production, you can replace with your exact Vercel domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Set up reliable relative paths for the cloud file system
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FONTS_DIR = os.path.join(BASE_DIR, "fonts")

@app.get("/")
def read_root():
    """
    Friendly landing page route verifying system status on Render.
    """
    return {
        "status": "online",
        "project": "CertFlow Core API Pipeline",
        "message": "System operational. Awaiting incoming frontend payloads."
    }

@app.post("/generate")
async def generate_certificates(
    template: UploadFile = File(...),
    names: str = Form(...),          # Accepts a comma-separated string or stringified JSON array
    box_x: int = Form(...),          # Top-left corner X coordinate of your canvas box
    box_y: int = Form(...),          # Top-left corner Y coordinate of your canvas box
    box_width: int = Form(...),      # Total width of the visual dragging bounding box
    box_height: int = Form(...),     # Total height of the visual dragging bounding box
    font_size: int = Form(...),      # Target optimal font size selected by user
    font_name: str = Form("Montserrat-Bold.ttf")
):
    try:
        # 1. Parse incoming names string payload safely
        try:
            name_list = json.loads(names)
            if not isinstance(name_list, list):
                name_list = [str(name_list)]
        except Exception:
            name_list = [n.strip() for n in names.split(",") if n.strip()]

        if not name_list:
            raise HTTPException(status_code=400, detail="No valid names provided for compilation.")

        # 2. Read the certificate base image template file into memory bytes
        template_bytes = await template.read()
        
        # 3. Locate the bundled font file path cleanly inside the container
        font_path = os.path.join(FONTS_DIR, font_name)
        if not os.path.exists(font_path):
            # Fallback check: Use any available .ttf asset if the requested file has a name mismatch
            if os.path.exists(FONTS_DIR) and os.listdir(FONTS_DIR):
                ttf_files = [f for f in os.listdir(FONTS_DIR) if f.endswith('.ttf')]
                font_path = os.path.join(FONTS_DIR, ttf_files[0]) if ttf_files else None
            else:
                font_path = None

        # 4. Initialize an in-memory byte buffer to construct a ZIP file download package
        zip_buffer = io.BytesIO()
        
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            for name in name_list:
                # Open a unique instance of the template canvas for each iteration row
                image = Image.open(io.BytesIO(template_bytes)).convert("RGB")
                draw = ImageDraw.Draw(image)
                
                current_font_size = font_size
                font = ImageFont.load_default()
                text_width, text_height = 0, 0

                # 5. Dynamic text calculation loop (Auto-scale logic down to prevent text clipping bounds)
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

                    # Fetch structural bounds measurements of text string canvas footprint
                    try:
                        bbox = draw.textbbox((0, 0), name, font=font)
                        text_width = bbox[2] - bbox[0]
                        text_height = bbox[3] - bbox[1]
                    except AttributeError:
                        # Fallback calculation if server container relies on an legacy Pillow framework version
                        text_width, text_height = draw.textsize(name, font=font)

                    # Check if text completely drops into specified width layout box parameter constraints
                    if text_width <= box_width and text_height <= box_height:
                        break
                    
                    # Iteratively shrink typography sizing constraints until string scales perfectly down
                    current_font_size -= 2

                # 6. Center alignment mapping calculations relative to target bounding boundaries
                target_x = box_x + (box_width - text_width) // 2
                target_y = box_y + (box_height - text_height) // 2

                # Stamp text onto structural canvas coordinates layer
                draw.text((target_x, target_y), name, fill=(0, 0, 0), font=font)
                
                # Compress processing canvas layer to raw binary data streams 
                img_byte_arr = io.BytesIO()
                image.save(img_byte_arr, format="JPEG", quality=95)
                img_byte_arr.seek(0)
                
                # Bundle processed file frame directly inside mounting ZIP framework container archives
                sanitized_name = "".join(c for c in name if c.isalnum() or c in (" ", "_", "-")).rstrip()
                file_name = f"Certificate_{sanitized_name.replace(' ', '_')}.jpg"
                zip_file.writestr(file_name, img_byte_arr.read())
        
        # Rewind data buffer tracks so target platform engine downloads structural data stream entries cleanly
        zip_buffer.seek(0)
        
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=CertFlow_Batch_Compilation.zip"}
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Core pipeline execution crash: {str(e)}")