import { useState, useRef, useEffect } from "react";

interface Props {
  onUpload: () => void;
  onPickingChange: (picking: boolean) => void;
  pickedLocation: { lat: number; lng: number } | null;
  mapCenter: { lat: number; lng: number };
  onRequestInitialPin: () => void;
}

type Step = "locating" | "pick-location" | "photo" | "uploading" | "error";

export default function UploadButton({ onUpload, onPickingChange, pickedLocation, onRequestInitialPin }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("locating");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onPickingChange(open && step === "pick-location");
  }, [open, step, onPickingChange]);

  const handleOpen = () => {
    setOpen(true);
    setStep("locating");
    setErrorMsg("");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStep("photo");
      },
      () => {
        setStep("pick-location");
        onRequestInitialPin(); // place draggable pin at current map center
      },
      { timeout: 8_000, enableHighAccuracy: true }
    );
  };

  const confirmLocation = () => {
    if (!pickedLocation) return;
    setCoords(pickedLocation);
    setStep("photo");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleUpload = async () => {
    if (!file || !coords) return;
    setStep("uploading");

    const formData = new FormData();
    formData.append("image", file);
    formData.append("lat", String(coords.lat));
    formData.append("lng", String(coords.lng));

    try {
      const res = await fetch("/api/photos", { method: "POST", body: formData });
      const text = await res.text();
      let data: { success?: boolean; error?: string };
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Server error: ${text.slice(0, 120)}`);
      }
      if (!data.success) throw new Error(data.error || "Upload failed");
      onUpload();
      handleClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Upload failed");
      setStep("error");
    }
  };

  const handleClose = () => {
    setOpen(false);
    setStep("locating");
    setCoords(null);
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setErrorMsg("");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <>
      <button onClick={handleOpen} style={fabStyle} aria-label="Share photo">
        +
      </button>

      {open && (
        <div style={panelStyle}>
          <div style={panelHeaderStyle}>
            <span style={{ color: "#fff", fontWeight: 600, fontSize: 16 }}>
              {step === "pick-location" ? "Tap the map to pin location" : "Share a moment"}
            </span>
            <button onClick={handleClose} style={iconBtnStyle}>✕</button>
          </div>

          {step === "locating" && (
            <p style={mutedStyle}>📡 Getting your location...</p>
          )}

          {step === "pick-location" && (
            <>
              <p style={mutedStyle}>
                {pickedLocation
                  ? `📍 ${pickedLocation.lat.toFixed(5)}, ${pickedLocation.lng.toFixed(5)} — drag the pin to adjust`
                  : "Setting pin..."}
              </p>
              <button
                onClick={confirmLocation}
                disabled={!pickedLocation}
                style={{ ...primaryBtnStyle, opacity: pickedLocation ? 1 : 0.4 }}
              >
                Confirm location ✓
              </button>
            </>
          )}

          {(step === "photo" || step === "uploading" || step === "error") && (
            <>
              {coords && (
                <p style={mutedStyle}>
                  📍 {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                </p>
              )}

              {step === "error" && (
                <p style={errorStyle}>{errorMsg}</p>
              )}

              {!preview ? (
                <button onClick={() => fileRef.current?.click()} style={secondaryBtnStyle}>
                  Choose photo
                </button>
              ) : (
                <img src={preview} alt="preview" style={previewStyle} />
              )}

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />

              {preview && (
                <button
                  onClick={handleUpload}
                  disabled={step === "uploading"}
                  style={primaryBtnStyle}
                >
                  {step === "uploading" ? "Uploading..." : "Post to map ↑"}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}

const fabStyle: React.CSSProperties = {
  position: "fixed",
  bottom: 28,
  left: "50%",
  transform: "translateX(-50%)",
  width: 60,
  height: 60,
  borderRadius: "50%",
  background: "#4f8ef7",
  color: "#fff",
  fontSize: 34,
  lineHeight: 1,
  border: "none",
  cursor: "pointer",
  boxShadow: "0 4px 18px rgba(0,0,0,0.45)",
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const panelStyle: React.CSSProperties = {
  position: "fixed",
  bottom: 0,
  left: 0,
  right: 0,
  background: "#1a1a1a",
  borderRadius: "20px 20px 0 0",
  padding: "20px 20px 36px",
  boxShadow: "0 -4px 32px rgba(0,0,0,0.7)",
  zIndex: 1000,
  border: "1px solid #2e2e2e",
  borderBottom: "none",
};

const panelHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 16,
};

const iconBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#666",
  cursor: "pointer",
  fontSize: 17,
  padding: 4,
};

const mutedStyle: React.CSSProperties = {
  color: "#777",
  fontSize: 13,
  marginBottom: 14,
  lineHeight: 1.5,
};

const errorStyle: React.CSSProperties = {
  color: "#f55",
  fontSize: 13,
  marginBottom: 14,
  wordBreak: "break-word",
};

const previewStyle: React.CSSProperties = {
  width: "100%",
  maxHeight: 160,
  objectFit: "cover",
  borderRadius: 10,
  marginBottom: 12,
  display: "block",
};

const secondaryBtnStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px",
  background: "#262626",
  color: "#ccc",
  border: "1px solid #3a3a3a",
  borderRadius: 10,
  cursor: "pointer",
  fontSize: 14,
  marginBottom: 10,
};

const primaryBtnStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  background: "#4f8ef7",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  cursor: "pointer",
  fontSize: 15,
  fontWeight: 600,
  marginTop: 4,
};
