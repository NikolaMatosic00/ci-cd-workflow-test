import { useState, useRef, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Photo } from "../types";

interface Props {
  photos: Photo[];
  onMarkerClick: (photo: Photo) => void;
  picking: boolean;
  pickedLocation: { lat: number; lng: number } | null;
  onLocationPick: (coords: { lat: number; lng: number }) => void;
  onCenterChange: (coords: { lat: number; lng: number }) => void;
}

function timeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "exp";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return "<1m";
}

const createThumbnailIcon = (photo: Photo) =>
  L.divIcon({
    className: "",
    html: `<div class="thumb-marker-outer">
      <div class="thumb-marker-wrap" style="background-image:url('${photo.url}')"></div>
      <span class="timer-badge">${timeLeft(photo.expiresAt)}</span>
    </div>`,
    iconSize: [56, 56],
    iconAnchor: [28, 28],
  });

const createClusterIcon = (cluster: { getChildCount: () => number }) =>
  L.divIcon({
    className: "custom-cluster",
    html: `<div class="cluster-bubble">${cluster.getChildCount()}</div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });

const dragPinIcon = L.divIcon({
  className: "",
  html: `<div style="font-size:44px;line-height:1;filter:drop-shadow(0 3px 8px rgba(0,0,0,0.8));cursor:grab;user-select:none;">📍</div>`,
  iconSize: [44, 44],
  iconAnchor: [14, 42],
});

function CenterTracker({ onChange }: { onChange: (c: { lat: number; lng: number }) => void }) {
  useMapEvents({
    moveend: (e) => {
      const { lat, lng } = e.target.getCenter();
      onChange({ lat, lng });
    },
  });
  return null;
}

function LocateMeButton() {
  const map = useMap();
  const [locating, setLocating] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      L.DomEvent.disableClickPropagation(containerRef.current);
      L.DomEvent.disableScrollPropagation(containerRef.current);
    }
  }, []);

  const locate = () => {
    if (!navigator.geolocation) {
      setErrMsg("Not supported");
      return;
    }
    setLocating(true);
    setErrMsg("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        map.flyTo([coords.latitude, coords.longitude], 16, { animate: true });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setErrMsg("Location denied");
        setTimeout(() => setErrMsg(""), 3000);
      },
      { timeout: 8_000, enableHighAccuracy: true }
    );
  };

  return (
    <div ref={containerRef} style={{ position: "absolute", top: 16, right: 16, zIndex: 1000 }}>
      <button
        onClick={locate}
        title="Locate me"
        style={{
          width: 42,
          height: 42,
          borderRadius: "50%",
          background: "#1c1c2e",
          border: "1px solid #444466",
          color: locating ? "#7090f7" : "#c0c0d8",
          fontSize: 20,
          cursor: "pointer",
          boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {locating ? "…" : "◎"}
      </button>
      {errMsg && (
        <div style={{
          marginTop: 6,
          background: "rgba(0,0,0,0.8)",
          color: "#f77",
          fontSize: 11,
          padding: "3px 7px",
          borderRadius: 6,
          whiteSpace: "nowrap",
          textAlign: "center",
        }}>
          {errMsg}
        </div>
      )}
    </div>
  );
}

export default function MapView({
  photos,
  onMarkerClick,
  picking,
  pickedLocation,
  onLocationPick,
  onCenterChange,
}: Props) {
  return (
    <MapContainer
      center={[45.2671, 19.8335]}
      zoom={13}
      style={{ width: "100%", height: "100%" }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={19}
      />

      <CenterTracker onChange={onCenterChange} />
      <LocateMeButton />

      {picking && pickedLocation && (
        <Marker
          position={[pickedLocation.lat, pickedLocation.lng]}
          icon={dragPinIcon}
          draggable
          zIndexOffset={1000}
          eventHandlers={{
            dragend: (e) => {
              const { lat, lng } = e.target.getLatLng();
              onLocationPick({ lat, lng });
            },
          }}
        />
      )}

      <MarkerClusterGroup
        chunkedLoading
        iconCreateFunction={createClusterIcon}
        maxClusterRadius={60}
        showCoverageOnHover={false}
      >
        {photos.map((photo) => (
          <Marker
            key={photo.id}
            position={[photo.lat, photo.lng]}
            icon={createThumbnailIcon(photo)}
            eventHandlers={{ click: () => onMarkerClick(photo) }}
          />
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
