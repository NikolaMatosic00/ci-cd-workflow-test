import { useEffect } from "react";
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
  flyTarget: { lat: number; lng: number } | null;
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

function FlyTo({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 15), { animate: true });
  }, [target, map]);
  return null;
}

export default function MapView({
  photos,
  onMarkerClick,
  picking,
  pickedLocation,
  onLocationPick,
  onCenterChange,
  flyTarget,
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
      <FlyTo target={flyTarget} />

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
