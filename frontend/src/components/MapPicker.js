import React, { useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// إصلاح أيقونة العلامة الافتراضية
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const homeIcon = L.divIcon({
  html: `<div style="background:#4338CA;width:40px;height:40px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center">
    <div style="transform:rotate(45deg);font-size:18px">🏠</div>
  </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  className: '',
});

const storeIcon = L.divIcon({
  html: `<div style="background:#F97316;width:40px;height:40px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center">
    <div style="transform:rotate(45deg);font-size:18px">🏪</div>
  </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  className: '',
});

// مكوّن داخلي: يتحرك الخريطة إلى الموقع الجديد
const MapController = ({ position }) => {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView([position.lat, position.lng], 15);
  }, [position, map]);
  return null;
};

// مكوّن داخلي: يستمع لأحداث الخريطة
const LocationListener = ({ onLocationPick }) => {
  useMapEvents({
    click(e) {
      onLocationPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

// مكوّن داخلي: علامة قابلة للسحب
const DraggableMarker = ({ position, icon, onDragEnd }) => {
  const markerRef = useRef(null);
  const eventHandlers = {
    dragend() {
      const m = markerRef.current;
      if (m) {
        const pos = m.getLatLng();
        onDragEnd(pos.lat, pos.lng);
      }
    },
  };
  return (
    <Marker
      draggable
      eventHandlers={eventHandlers}
      position={[position.lat, position.lng]}
      icon={icon}
      ref={markerRef}
    />
  );
};

/**
 * MapPicker — خريطة لاختيار موقع
 * Props:
 *   position: { lat, lng } | null
 *   onChange: (lat, lng) => void
 *   iconType: 'home' | 'store'  (افتراضي: 'home')
 *   height: string (افتراضي: '320px')
 */
const MapPicker = ({ position, onChange, iconType = 'home', height = '320px' }) => {
  const icon = iconType === 'store' ? storeIcon : homeIcon;

  const defaultCenter = position
    ? [position.lat, position.lng]
    : [23.5859, 58.4059]; // مسقط، عُمان

  return (
    <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #E2E8F0' }}>
      <MapContainer
        center={defaultCenter}
        zoom={position ? 15 : 12}
        style={{ height, width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationListener onLocationPick={onChange} />
        {position && (
          <>
            <MapController position={position} />
            <DraggableMarker position={position} icon={icon} onDragEnd={onChange} />
          </>
        )}
      </MapContainer>
    </div>
  );
};

export default MapPicker;
export { homeIcon, storeIcon };
