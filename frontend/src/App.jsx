import React, { useState, useRef } from "react";
import Papa from "papaparse";

export default function App() {
  const [template, setTemplate] = useState(null);
  const [fontFile, setFontFile] = useState(null); 
  const [selectedFontName, setSelectedFontName] = useState("arial.ttf"); // Default font value configuration
  const [previewUrl, setPreviewUrl] = useState("");
  
  const [sourceType, setSourceType] = useState("file");
  const [spreadsheetFile, setSpreadsheetFile] = useState(null);
  const [sheetUrl, setSheetUrl] = useState("");
  
  const [headers, setHeaders] = useState([]);
  const [selectedColumn, setSelectedColumn] = useState("");
  const [manualColumnName, setManualColumnName] = useState("");
  
  const [boxX, setBoxX] = useState(50);
  const [boxY, setBoxY] = useState(150);
  const [boxW, setBoxW] = useState(400);
  const [fontSize, setFontSize] = useState(64); 
  const [isDownloading, setIsDownloading] = useState(false);

  const imageRef = useRef(null);

  // Core system fonts matching Microsoft Word / Canva baseline layouts
  const builtInFonts = [
    { name: "Arial (Standard Sans)", value: "arial.ttf" },
    { name: "Times New Roman (Serif)", value: "times.ttf" },
    { name: "Courier New (Monospace)", value: "cour.ttf" },
    { name: "Georgia (Elegant Serif)", value: "georgia.ttf" },
    { name: "Verdana (Clean Sans)", value: "verdana.ttf" },
    { name: "Impact (Bold Header)", value: "impact.ttf" }
  ];

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
    const formData = new FormData();
    formData.append("template", template);
    formData.append("name_column", finalColumnName);
    formData.append("box_x", boxX);
    formData.append("box_y", boxY);
    formData.append("box_w", boxW);
    formData.append("font_size", fontSize);
    formData.append("font_name", selectedFontName); // Sends selected font configuration
    formData.append("display_w", imageRef.current.clientWidth);
    formData.append("display_h", imageRef.current.clientHeight);

    if (fontFile) {
      formData.append("font_file", fontFile); // Uploaded custom override file
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
      const response = await fetch("http://127.0.0.1:8000/generate", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Generation failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "certificates.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif", maxWidth: "1200px", margin: "0 auto" }}>
      <h1>CertFlow — Bulk Certificate Utility</h1>
      <p style={{ color: "#666" }}>Tailored for administrative scale workflows.</p>
      <hr style={{ margin: "15px 0" }} />
      
      <div style={{ display: "flex", gap: "40px", marginTop: "20px" }}>
        {/* Left Side Controls Panel */}
        <div style={{ flex: "1", minWidth: "320px" }}>
          <h3>1. Asset & Typography Setup</h3>
          <label style={{ fontWeight: "bold" }}>Upload Background Template:</label>
          <input type="file" accept="image/*" onChange={handleTemplateChange} />
          
          {/* New Font Dropdown Utility */}
          <label style={{ fontWeight: "bold", display: "block", marginTop: "15px" }}>Choose Core Interface Font Style:</label>
          <select value={selectedFontName} onChange={(e) => setSelectedFontName(e.target.value)}>
            {builtInFonts.map((f) => <option key={f.value} value={f.value}>{f.name}</option>)}
          </select>

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
              <label style={{ fontWeight: "bold" }}>Choose Spreadsheet (.csv, .xlsx):</label>
              <input type="file" accept=".csv, .xlsx, .xls" onChange={handleFileChange} />
              
              {headers.length > 0 ? (
                <div style={{ marginTop: "15px" }}>
                  <label style={{ fontWeight: "bold" }}>Select Target Column Name:</label>
                  <select value={selectedColumn} onChange={(e) => setSelectedColumn(e.target.value)}>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ) : (
                spreadsheetFile && (
                  <div style={{ marginTop: "15px" }}>
                    <label style={{ fontWeight: "bold" }}>Type Exact Column Header:</label>
                    <input type="text" placeholder="e.g., Full Name" value={manualColumnName} onChange={(e) => setManualColumnName(e.target.value)} />
                  </div>
                )
              )}
            </div>
          ) : (
            <div>
              <label style={{ fontWeight: "bold" }}>Paste Public Google Sheet URL:</label>
              <input type="text" placeholder="https://docs.google.com/spreadsheets/d/.../edit" value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} />
              <p style={{ fontSize: "11px", color: "#666", marginTop: "3px" }}>⚠️ Sheet must be shared as "Anyone with the link can view"</p>
              
              <div style={{ marginTop: "15px" }}>
                <label style={{ fontWeight: "bold" }}>Type Exact Column Header:</label>
                <input type="text" placeholder="e.g., Full Name" value={manualColumnName} onChange={(e) => setManualColumnName(e.target.value)} />
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
            {isDownloading ? "Compiling Server Assets..." : "Execute Bulk Compilation"}
          </button>
        </div>

        {/* Right Preview Panel Workspace */}
        <div style={{ flex: "2" }}>
          <h3 style={{ marginBottom: "10px" }}>Live Layout Alignment Engine</h3>
          {previewUrl ? (
            <div style={{ position: "relative", display: "inline-block", border: "2px solid #ccc", borderRadius: "4px" }}>
              <img ref={imageRef} src={previewUrl} alt="Live Workspace" style={{ maxWidth: "100%", height: "auto", display: "block" }} />
              
              {/* FIX: Changed alignItems to flex-end so text tracking snaps directly to the bottom floor wire frame */}
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