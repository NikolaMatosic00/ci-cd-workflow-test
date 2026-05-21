import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
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

const createThumbnailIcon = (url: string) =>
  L.divIcon({
    className: "",
    html: `<div class="thumb-marker-wrap"><img src="${url}" alt="" /></div>`,
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

// Large draggable pin — anchor at bottom tip so the point sits on the coordinate
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
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={19}
      />

      <CenterTracker onChange={onCenterChange} />

      {picking && pickedLocation && (
        <Marker
          position={[pickedLocation.lat, pickedLocation.lng]}
          icon={dragPinIcon}
          draggable
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
            icon={createThumbnailIcon(photo.url)}
            eventHandlers={{ click: () => onMarkerClick(photo) }}
          />
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
