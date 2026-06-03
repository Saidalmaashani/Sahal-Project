import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ثبّت الأيقونة الافتراضية
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const driverIcon = L.divIcon({
  html: `<div style="background:#4338CA;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.3);font-size:22px">🚗</div>`,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
  className: '',
});

const destIcon = L.divIcon({
  html: `<div style="background:#F97316;width:44px;height:44px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.3)">
    <span style="transform:rotate(45deg);font-size:20px">🏠</span>
  </div>`,
  iconSize: [44, 50],
  iconAnchor: [22, 50],
  className: '',
});

const merchantIcon = L.divIcon({
  html: `<div style="background:#10B981;width:36px;height:36px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.25)">
    <span style="transform:rotate(45deg);font-size:16px">🏪</span>
  </div>`,
  iconSize: [36, 42],
  iconAnchor: [18, 42],
  className: '',
});

const orderIcon = (isAssigned) => L.divIcon({
  html: `<div style="background:${isAssigned ? '#10B981' : '#F97316'};color:white;padding:4px 8px;border-radius:8px;font-size:12px;font-family:Tajawal,sans-serif;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.3)">${isAssigned ? 'طلبي' : 'متاح'}</div>`,
  className: '',
  iconAnchor: [30, 10],
});

// مكوّن لضبط حدود الخريطة تلقائياً
const BoundsFitter = ({ positions }) => {
  const map = useMap();
  useEffect(() => {
    const valid = positions.filter(p => p);
    if (valid.length > 1) {
      map.fitBounds(valid.map(p => [p.lat, p.lng]), { padding: [50, 50] });
    } else if (valid.length === 1) {
      map.setView([valid[0].lat, valid[0].lng], 15);
    }
  }, [positions, map]);
  return null;
};

/**
 * MapTrack — خريطة لتتبع الطلبات
 *
 * Props:
 *   driverPos: { lat, lng } | null  — موقع المندوب
 *   destPos: { lat, lng } | null    — موقع التسليم
 *   myPos: { lat, lng } | null      — موقعي (للمندوب)
 *   orders: [{ merchant_lat, merchant_lng, driver_id, total_amount, order_id }]
 *   height: string
 */
const MapTrack = ({
  driverPos = null,
  destPos = null,
  myPos = null,
  orders = [],
  height = '420px',
}) => {
  const allPositions = [driverPos, destPos, myPos].filter(Boolean);
  orders.forEach(o => {
    if (o.merchant_lat && o.merchant_lng)
      allPositions.push({ lat: o.merchant_lat, lng: o.merchant_lng });
  });

  const defaultCenter = allPositions[0]
    ? [allPositions[0].lat, allPositions[0].lng]
    : [23.5859, 58.4059];

  return (
    <MapContainer
      center={defaultCenter}
      zoom={12}
      style={{ height, width: '100%' }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <BoundsFitter positions={allPositions} />

      {/* موقعي (للمندوب) */}
      {myPos && (
        <CircleMarker
          center={[myPos.lat, myPos.lng]}
          radius={14}
          pathOptions={{ color: '#4338CA', fillColor: '#4338CA', fillOpacity: 1 }}
        />
      )}

      {/* موقع المندوب */}
      {driverPos && (
        <Marker position={[driverPos.lat, driverPos.lng]} icon={driverIcon} />
      )}

      {/* موقع التسليم */}
      {destPos && (
        <Marker position={[destPos.lat, destPos.lng]} icon={destIcon} />
      )}

      {/* خط بين المندوب والوجهة */}
      {driverPos && destPos && (
        <Polyline
          positions={[
            [driverPos.lat, driverPos.lng],
            [destPos.lat, destPos.lng],
          ]}
          pathOptions={{ color: '#4338CA', weight: 3, dashArray: '8,8', opacity: 0.7 }}
        />
      )}

      {/* طلبات المندوب */}
      {orders.map(o =>
        o.merchant_lat && o.merchant_lng ? (
          <Marker
            key={o.order_id}
            position={[o.merchant_lat, o.merchant_lng]}
            icon={orderIcon(!!o.driver_id)}
          />
        ) : null
      )}
    </MapContainer>
  );
};

export default MapTrack;
