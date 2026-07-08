import React, { useState, useEffect, useRef } from "react";
import Papa from "papaparse";

export default function App() {
  // --- Asset states ---
  const [template, setTemplate] = useState(null);
  const [fontFile, setFontFile] = useState(null); 
  const [selectedFontName, setSelectedFontName] = useState(""); 
  const [previewUrl, setPreviewUrl] = useState("");
  
  // --- Pipeline Source States ---
  const [sourceType, setSourceType] = useState("file");
  const [spreadsheetFile, setSpreadsheetFile] = useState(null);
  const [sheetUrl, setSheetUrl] = useState("");
  
  // --- Header parsing tracking ---
  const [headers, setHeaders] = useState([]);
  const [selectedColumn, setSelectedColumn] = useState("");
  const [manualColumnName, setManualColumnName] = useState("");
  
  // --- Workspace Canvas Coordinates ---
  const [boxX, setBoxX] = useState(50);
  const [boxY, setBoxY] = useState(150);
  const [boxW, setBoxW] = useState(400);
  const [fontSize, setFontSize] = useState(64); 
  const [isDownloading, setIsDownloading] = useState(false);

  // --- Dynamic Cloud System Font States ---
  const [availableFonts, setAvailableFonts] = useState([]);
  const [loadingFonts, setLoadingFonts] = useState(true);
  const [apiError, setApiError] = useState("");

  const imageRef = useRef(null);

  // Core Render service tracking entry point
  const BACKEND_URL = "https://autocert-tcpy.onrender.com";

  // Hydrate the live backend font directory list on application load
  useEffect(() => {
    async function fetchCloudFonts() {
      try {
        setLoadingFonts(true);
        const response = await fetch(`${BACKEND_URL}/fonts`);
        if (!response.ok) throw new Error("Could not download system typography list.");
        const data = await response.json();
        setAvailableFonts(data.fonts || []);
        if (data.fonts && data.fonts.length > 0) {
          setSelectedFontName(data.fonts[0]);
        }
      } catch (err) {
        console.error("Font registry collection down:", err);
        setApiError("Could not retrieve remote server fonts. Verify Render service status.");
      } finally {
        setLoadingFonts(false);
      }
    }
    fetchCloudFonts();
  }, []);

  const handleTemplateChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setTemplate(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSpreadsheetFile(file);
    if (file.name.toLowerCase().endsWith(".csv")) {
      Papa.parse(file, {
        header: true,
        preview: 1,
        complete: (results) => {
          if (results.data.length > 0) {
            const parsedHeaders = Object.keys(results.data[0]);
            setHeaders(parsedHeaders);
            setSelectedColumn(parsedHeaders[0]);
          }
        },
      });
    } else {
      // Clear array structures for Excel formats to let users fallback gracefully onto explicit inputs
      setHeaders([]);
      setSelectedColumn("");
    }
  };

  const handleGenerate = async () => {
    if (!template) {
      alert("Please upload a template image.");
      return;
    }

    const finalColumnName = sourceType === "file" && headers.length > 0 ? selectedColumn : manualColumnName;
    if (!finalColumnName) {
      alert("Please specify the Name Column header.");
      return;
    }

    setIsDownloading(true);
    setApiError(""); 

    const formData = new FormData();
    formData.append("template", template);
    formData.append("name_column", finalColumnName);
    formData.append("box_x", parseInt(boxX, 10));
    formData.append("box_y", parseInt(boxY, 10));
    formData.append("box_w", parseInt(boxW, 10));
    formData.append("font_size", parseInt(fontSize, 10));
    formData.append("font_name", selectedFontName);
    formData.append("display_w", imageRef.current ? imageRef.current.clientWidth : 800);
    formData.append("display_h", imageRef.current ? imageRef.current.clientHeight : 600);

    if (fontFile) {
      formData.append("font_file", fontFile); 
    }

    if (sourceType === "file") {
      if (!spreadsheetFile) {
        alert("Please upload a spreadsheet file.");
        setIsDownloading(false);
        return;
      }
      formData.append("spreadsheet_file", spreadsheetFile);
    } else {
      if (!sheetUrl) {
        alert("Please paste a valid Google Sheets URL.");
        setIsDownloading(false);
        return;
      }
      formData.append("spreadsheet_url", sheetUrl);
    }

    try {
      const response = await fetch(`${BACKEND_URL}/generate`, {
        method: "POST",
        body: formData,
      });

      // Catch error arrays cleanly so that validation feedback parses as clear text instead of [object Object]
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(JSON.stringify(errorData, null, 2));
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "CertFlow_Bulk_Compilation.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error("Pipeline Exception Trace:", err.message);
      setApiError(err.message);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif", maxWidth: "1200px", margin: "0 auto" }}>
      <h1>AutoCert — Bulk Certificate Download v1.0.1</h1>
      <p style={{ color: "#666" }}>Last Update: July 8, 2026</p>
      <hr style={{ margin: "15px 0" }} />
      
      {apiError && (
        <div style={{ padding: "15px", backgroundColor: "#ffebee", color: "#c62828", borderRadius: "4px", marginBottom: "20px" }}>
          <strong>Core Engine Compilation Error Summary:</strong>
          <pre style={{ margin: "5px 0 0 0", fontSize: "11px", whiteSpace: "pre-wrap", overflowX: "auto" }}>{apiError}</pre>
        </div>
      )}
      
      <div style={{ display: "flex", gap: "40px", marginTop: "20px" }}>
        {/* Left Side Controls Panel */}
        <div style={{ flex: "1", minWidth: "320px" }}>
          <h3>1. Asset & Typography Setup</h3>
          <label style={{ fontWeight: "bold" }}>Upload Background Template:</label>
          <input type="file" accept="image/*" onChange={handleTemplateChange} />
          
          <label style={{ fontWeight: "bold", display: "block", marginTop: "15px" }}>Choose Cloud Registry Font Style:</label>
          {loadingFonts ? (
            <p style={{ margin: "5px 0", fontSize: "12px", color: "#666" }}>Indexing remote server assets...</p>
          ) : (
            <select value={selectedFontName} onChange={(e) => setSelectedFontName(e.target.value)} style={{ width: "100%", padding: "6px" }}>
              {availableFonts.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          )}

          <label style={{ fontWeight: "bold", display: "block", marginTop: "15px", color: "#4b5563" }}>
            Optional: Upload Custom Font File (.ttf, .otf)
          </label>
          <input type="file" accept=".ttf, .otf" onChange={(e) => setFontFile(e.target.files[0])} />
          {fontFile && <p style={{ fontSize: "12px", color: "#16a34a" }}>✓ Custom font file loaded (overrides selection menu)</p>}
          
          <h3 style={{ marginTop: "25px" }}>2. Recipient Data Pipeline</h3>
          <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
            <button 
              onClick={() => setSourceType("file")}
              style={{ flex: 1, padding: "8px", cursor: "pointer", background: sourceType === "file" ? "#0070f3" : "#eee", color: sourceType === "file" ? "white" : "#333", border: "1px solid #ccc", borderRadius: "4px" }}
            >
              Local File Upload
            </button>
            <button 
              onClick={() => setSourceType("url")}
              style={{ flex: 1, padding: "8px", cursor: "pointer", background: sourceType === "url" ? "#0070f3" : "#eee", color: sourceType === "url" ? "white" : "#333", border: "1px solid #ccc", borderRadius: "4px" }}
            >
              Google Sheets Link
            </button>
          </div>

          {sourceType === "file" ? (
            <div>
              <label style={{ fontWeight: "bold" }}>Choose Spreadsheet (.csv, .xlsx, .xls):</label>
              <input type="file" accept=".csv, .xlsx, .xls" onChange={handleFileChange} />
              
              {headers.length > 0 ? (
                <div style={{ marginTop: "15px" }}>
                  <label style={{ fontWeight: "bold" }}>Select Target Column Name:</label>
                  <select value={selectedColumn} onChange={(e) => setSelectedColumn(e.target.value)} style={{ width: "100%", padding: "5px" }}>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ) : (
                spreadsheetFile && (
                  <div style={{ marginTop: "15px" }}>
                    <label style={{ fontWeight: "bold" }}>Type Exact Column Header:</label>
                    <input type="text" placeholder="e.g., Full Name" value={manualColumnName} onChange={(e) => setManualColumnName(e.target.value)} style={{ width: "100%", padding: "5px" }} />
                  </div>
                )
              )}
            </div>
          ) : (
            <div>
              <label style={{ fontWeight: "bold" }}>Paste Public Google Sheet URL:</label>
              <input type="text" placeholder="https://docs.google.com/spreadsheets/d/.../edit" value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} style={{ width: "100%", padding: "5px" }} />
              <p style={{ fontSize: "11px", color: "#666", marginTop: "3px" }}>⚠️ Sheet must be shared as "Anyone with the link can view"</p>
              
              <div style={{ marginTop: "15px" }}>
                <label style={{ fontWeight: "bold" }}>Type Exact Column Header:</label>
                <input type="text" placeholder="e.g., Full Name" value={manualColumnName} onChange={(e) => setManualColumnName(e.target.value)} style={{ width: "100%", padding: "5px" }} />
              </div>
            </div>
          )}

          <h3 style={{ marginTop: "25px" }}>3. Graphic Boundary Alignment</h3>
          <label>Horizontal Position (X): {boxX}px</label>
          <input type="range" min="0" max="1200" value={boxX} onChange={(e) => setBoxX(Number(e.target.value))} style={{ width: "100%" }} />
          
          <label>Vertical Position (Y): {boxY}px</label>
          <input type="range" min="0" max="1200" value={boxY} onChange={(e) => setBoxY(Number(e.target.value))} style={{ width: "100%" }} />
          
          <label>Text Bounding Limit Width: {boxW}px</label>
          <input type="range" min="50" max="1200" value={boxW} onChange={(e) => setBoxW(Number(e.target.value))} style={{ width: "100%" }} />

          <label>Target Font Base Size (Box Height): {fontSize}px</label>
          <input type="range" min="14" max="200" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} style={{ width: "100%" }} />

          <button 
            onClick={handleGenerate} 
            disabled={isDownloading}
            style={{ marginTop: "25px", padding: "12px 24px", background: "#22c55e", color: "white", border: "none", borderRadius: "5px", cursor: "pointer", width: "100%", fontSize: "16px", fontWeight: "bold" }}
          >
            {isDownloading ? "Processing Pipeline Payload..." : "Execute Bulk Compilation"}
          </button>
        </div>

        {/* Right Preview Panel Workspace */}
        <div style={{ flex: "2" }}>
          <h3 style={{ marginBottom: "10px" }}>Live Layout Alignment Engine</h3>
          {previewUrl ? (
            <div style={{ position: "relative", display: "inline-block", border: "2px solid #ccc", borderRadius: "4px" }}>
              <img ref={imageRef} src={previewUrl} alt="Live Workspace" style={{ maxWidth: "100%", height: "auto", display: "block" }} />
              
              <div style={{
                position: "absolute",
                left: `${boxX}px`,
                top: `${boxY}px`,
                width: `${boxW}px`,
                height: `${fontSize}px`,
                border: "2px dashed #ef4444",
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                color: "#ef4444",
                display: "flex",
                alignItems: "flex-end", 
                justifyContent: "center",
                fontSize: "11px",
                fontWeight: "bold",
                pointerEvents: "none",
                paddingBottom: "2px",
                boxSizing: "border-box"
              }}>
                [ Text Align Bottom ]
              </div>
            </div>
          ) : (
            <div style={{ width: "100%", height: "450px", border: "2px dashed #cbd5e1", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", background: "#f1f5f9" }}>
              Awaiting Template upload asset to construct interactive canvas coordinate canvas.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}