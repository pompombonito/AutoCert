import React, { useState, useEffect } from "react";

export default function App() {
  // --- State Management ---
  const [template, setTemplate] = useState(null);
  const [namesInput, setNamesInput] = useState("");
  const [boxX, setBoxX] = useState(100);
  const [boxY, setBoxY] = useState(200);
  const [boxWidth, setBoxWidth] = useState(400);
  const [boxHeight, setBoxHeight] = useState(100);
  const [fontSize, setFontSize] = useState(40);
  
  // Font States
  const [availableFonts, setAvailableFonts] = useState([]);
  const [selectedFont, setSelectedFont] = useState("");
  const [loadingFonts, setLoadingFonts] = useState(true);
  
  // Application Status States
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Change this to match your live Render backend URL endpoint
  const BACKEND_URL = "https://autocert-tcpy.onrender.com";

  // --- Fetch Available Fonts from Backend on Mount ---
  useEffect(() => {
    async function fetchFonts() {
      try {
        setLoadingFonts(true);
        const response = await fetch(`${BACKEND_URL}/fonts`);
        if (!response.ok) throw new Error("Failed to retrieve font collection registry.");
        
        const data = await response.json();
        setAvailableFonts(data.fonts || []);
        
        // Auto-select the first font in the list as default if available
        if (data.fonts && data.fonts.length > 0) {
          setSelectedFont(data.fonts[0]);
        }
      } catch (err) {
        console.error("Font registry fetch error:", err);
        setErrorMessage("Could not load backend fonts. Please check if backend is awake.");
      } finally {
        setLoadingFonts(false);
      }
    }
    fetchFonts();
  }, []);

  // --- Form Submission Handler ---
  const handleGenerate = async (e) => {
    e.preventDefault();
    setIsGenerating(true);
    setErrorMessage("");

    if (!template) {
      setErrorMessage("Please upload a base certificate image template.");
      setIsGenerating(false);
      return;
    }

    if (!selectedFont) {
      setErrorMessage("Please select a font style from the dropdown selection.");
      setIsGenerating(false);
      return;
    }

    try {
      // 1. Pack structural data into standard browser FormData
      const formData = new FormData();
      formData.append("template", template);
      formData.append("names", namesInput); // Sends as comma-separated layout string
      formData.append("box_x", parseInt(boxX, 10));
      formData.append("box_y", parseInt(boxY, 10));
      formData.append("box_width", parseInt(boxWidth, 10));
      formData.append("box_height", parseInt(boxHeight, 10));
      formData.append("font_size", parseInt(fontSize, 10));
      formData.append("font_name", selectedFont); // Matches the expected FastAPI parameter key

      // 2. Ship payload stream to Render API endpoint
      const response = await fetch(`${BACKEND_URL}/generate`, {
        method: "POST",
        body: formData,
      });

      // 3. Robust Error Unmasking Check
      if (!response.ok) {
        const errorData = await response.json();
        // Stringify the raw object data structure so it displays explicitly on screen
        const readableError = JSON.stringify(errorData, null, 2);
        throw new Error(readableError);
      }

      // 4. Download processed output blob stream archive
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.setAttribute("download", "CertFlow_Batch_Compilation.zip");
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      
    } catch (err) {
      console.error("Core Pipeline Exception Caught:", err.message);
      setErrorMessage(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ maxWidth: "600px", margin: "40px auto", padding: "20px", fontFamily: "sans-serif" }}>
      <h2>CertFlow Core API Control Interface</h2>
      
      {errorMessage && (
        <div style={{ padding: "15px", backgroundColor: "#ffebee", color: "#c62828", borderRadius: "4px", marginBottom: "20px", whiteSpace: "pre-wrap" }}>
          <strong>Execution Block:</strong>
          <pre style={{ margin: "5px 0 0 0", fontSize: "12px", overflowX: "auto" }}>{errorMessage}</pre>
        </div>
      )}

      <form onSubmit={handleGenerate} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
        
        <div>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>1. Base Template Image:</label>
          <input type="file" accept="image/*" onChange={(e) => setTemplate(e.target.files[0])} />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>2. Recipient Names (Comma separated):</label>
          <textarea 
            rows="3" 
            style={{ width: "100%", padding: "8px" }} 
            placeholder="John Doe, Jane Smith, Alan Turing"
            value={namesInput}
            onChange={(e) => setNamesInput(e.target.value)}
            required
          />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>3. Select Custom Typography Font:</label>
          {loadingFonts ? (
            <p style={{ margin: 0, fontSize: "14px", color: "#666" }}>Scanning cloud font registry directory...</p>
          ) : (
            <select 
              style={{ width: "100%", padding: "8px" }}
              value={selectedFont}
              onChange={(e) => setSelectedFont(e.target.value)}
              required
            >
              {availableFonts.length === 0 ? (
                <option value="">No custom fonts found on server registry</option>
              ) : (
                availableFonts.map((fontName) => (
                  <option key={fontName} value={fontName}>{fontName}</option>
                ))
              )}
            </select>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <div>
            <label style={{ display: "block", fontSize: "14px" }}>Box X Offset (px):</label>
            <input type="number" style={{ width: "100%", padding: "6px" }} value={boxX} onChange={(e) => setBoxX(e.target.value)} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "14px" }}>Box Y Offset (px):</label>
            <input type="number" style={{ width: "100%", padding: "6px" }} value={boxY} onChange={(e) => setBoxY(e.target.value)} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "14px" }}>Bounding Width (px):</label>
            <input type="number" style={{ width: "100%", padding: "6px" }} value={boxWidth} onChange={(e) => setBoxWidth(e.target.value)} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "14px" }}>Bounding Height (px):</label>
            <input type="number" style={{ width: "100%", padding: "6px" }} value={boxHeight} onChange={(e) => setBoxHeight(e.target.value)} />
          </div>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "5px" }}>Target Font Size (Max pt):</label>
          <input type="number" style={{ width: "100%", padding: "6px" }} value={fontSize} onChange={(e) => setFontSize(e.target.value)} />
        </div>

        <button 
          type="submit" 
          disabled={isGenerating}
          style={{ padding: "12px", backgroundColor: isGenerating ? "#ccc" : "#0070f3", color: "#fff", border: "none", borderRadius: "5px", cursor: isGenerating ? "not-allowed" : "pointer", fontWeight: "bold" }}
        >
          {isGenerating ? "Processing Batch Pipeline..." : "Generate Certificates"}
        </button>
      </form>
    </div>
  );
}