import { useState, useEffect, useCallback } from "react";
import { Photo } from "./types";
import MapView from "./components/MapView";
import UploadButton from "./components/UploadButton";
import PhotoModal from "./components/PhotoModal";

const NOVI_SAD = { lat: 45.2671, lng: 19.8335 };

export default function App() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selected, setSelected] = useState<Photo | null>(null);
  const [picking, setPicking] = useState(false);
  const [pickedLocation, setPickedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState(NOVI_SAD);

  const fetchPhotos = useCallback(async () => {
    try {
      const res = await fetch("/api/photos");
      const data = await res.json();
      setPhotos(Array.isArray(data) ? data : []);
    } catch {
      // silently ignore network errors
    }
  }, []);

  useEffect(() => {
    fetchPhotos();

    // Real-time updates via Server-Sent Events
    const es = new EventSource("/api/events");
    es.addEventListener("new-photo", fetchPhotos);

    // Fallback polling every 60s in case SSE drops
    const poll = setInterval(fetchPhotos, 60_000);

    return () => {
      es.close();
      clearInterval(poll);
    };
  }, [fetchPhotos]);

  const handlePickingChange = (active: boolean) => {
    setPicking(active);
    if (!active) {
      setPickedLocation(null);
      setFlyTarget(null);
    }
  };

  const handleInitialPin = (coords: { lat: number; lng: number }) => {
    setPickedLocation(coords);
    setFlyTarget(coords);
  };

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <MapView
        photos={photos}
        onMarkerClick={setSelected}
        picking={picking}
        pickedLocation={pickedLocation}
        onLocationPick={setPickedLocation}
        onCenterChange={setMapCenter}
        flyTarget={flyTarget}
      />

      <UploadButton
        onUpload={fetchPhotos}
        onPickingChange={handlePickingChange}
        pickedLocation={pickedLocation}
        mapCenter={mapCenter}
        onRequestInitialPin={() => handleInitialPin(mapCenter)}
        onLocationPick={handleInitialPin}
      />

      {selected && (
        <PhotoModal photo={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
