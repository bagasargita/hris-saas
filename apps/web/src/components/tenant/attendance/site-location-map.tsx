'use client';

import { useEffect } from 'react';
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Default Leaflet marker icons break under bundlers; use CDN assets.
const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function MapClickHandler({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function Recenter({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([latitude, longitude], map.getZoom(), { animate: true });
  }, [latitude, longitude, map]);
  return null;
}

export function SiteLocationMap({
  latitude,
  longitude,
  radiusMeters,
  onPick,
}: {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  onPick: (lat: number, lng: number) => void;
}) {
  const lat = Number.isFinite(latitude) ? latitude : -6.2;
  const lng = Number.isFinite(longitude) ? longitude : 106.816666;
  const radius = Number.isFinite(radiusMeters) && radiusMeters > 0 ? radiusMeters : 150;

  return (
    <MapContainer
      center={[lat, lng]}
      zoom={16}
      className="h-64 w-full rounded-md z-0"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recenter latitude={lat} longitude={lng} />
      <MapClickHandler onPick={onPick} />
      <Marker position={[lat, lng]} icon={markerIcon} />
      <Circle
        center={[lat, lng]}
        radius={radius}
        pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.2, weight: 2 }}
      />
    </MapContainer>
  );
}
