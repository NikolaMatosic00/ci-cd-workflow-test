import { Photo } from "../types";

interface Props {
  photo: Photo;
  onClose: () => void;
}

function timeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return `${h}h ${m}m remaining`;
}

export default function PhotoModal({ photo, onClose }: Props) {
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <img src={photo.url} alt="photo" style={imgStyle} />
        <div style={footerStyle}>
          <span style={{ color: "#8888aa", fontSize: 13 }}>
            ⏱ {timeLeft(photo.expiresAt)}
          </span>
          <button onClick={onClose} style={closeBtnStyle}>
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.85)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 2000,
};

const modalStyle: React.CSSProperties = {
  background: "#1c1c2e",
  borderRadius: 16,
  overflow: "hidden",
  maxWidth: "92vw",
  maxHeight: "90vh",
  border: "1px solid #2e2e4a",
  display: "flex",
  flexDirection: "column",
};

const imgStyle: React.CSSProperties = {
  display: "block",
  maxWidth: "100%",
  maxHeight: "80vh",
  objectFit: "contain",
};

const footerStyle: React.CSSProperties = {
  padding: "12px 16px",
  background: "#16162a",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const closeBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#7070a0",
  cursor: "pointer",
  fontSize: 18,
  padding: 4,
};
