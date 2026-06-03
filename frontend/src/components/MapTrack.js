import React, { useEffect, useRef } from 'react';
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

// أيقونة المندوب — مع حلقة نبضية تُضاف عند وضع live
const makeLiveDriverIcon = () => L.divIcon({
  html: `
    <div style="position:relative;width:56px;height:56px">
      <div style="position:absolute;inset:0;border-radius:50%;background:rgba(67,56,202,0.18);animation:sahal-pulse 1.8s ease-out infinite"></div>
      <div style="position:absolute;inset:6px;border-radius:50%;background:#4338CA;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 3px 12px rgba(67,56,202,0.5);font-size:20px">🚗</div>
    </div>
  `,
  iconSize: [56, 56],
  iconAnchor: [28, 28],
  className: '',
});

const makeStaticDriverIcon = () => L.divIcon({
  html: `<div style="background:#94A3B8;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.2);font-size:20px">🚗</div>`,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
  className: '',
});

const destIcon = L.divIcon({
  html: `<div style="position:relative;width:48px;height:56px">
    <div style="position:absolute;inset:0 2px;bottom:8px;background:#F97316;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 3px 10px rgba(249,115,22,0.4)">
      <span style="transform:rotate(45deg);font-size:18px">🏠</span>
    </div>
    <div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:8px;height:8px;background:#F97316;border-radius:50%"></div>
  </div>`,
  iconSize: [48, 56],
  iconAnchor: [24, 56],
  className: '',
});

const orderIcon = (isAssigned) => L.divIcon({
  html: `<div style="background:${isAssigned ? '#10B981' : '#F97316'};color:white;padding:4px 10px;border-radius:8px;font-size:12px;font-family:Tajawal,sans-serif;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.25);font-weight:600">${isAssigned ? 'طلبي' : 'متاح'}</div>`,
  className: '',
  iconAnchor: [35, 14],
});

// حقن أنيميشن CSS مرة واحدة
let cssInjected = false;
const injectCSS = () => {
  if (cssInjected) return;
  cssInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes sahal-pulse {
      0%   { transform: scale(1);   opacity: 0.8; }
      70%  { transform: scale(2.2); opacity: 0; }
      100% { transform: scale(2.2); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
};

// ===== مكوّن التحكم في الخريطة =====
// يضبط الحدود مرة واحدة عند التحميل، ثم يتابع المندوب بانتقال ناعم
const MapController = ({ driverPos, destPos, myPos, followDriver }) => {
  const map = useMap();
  const initialFitDone = useRef(false);
  const prevKey = useRef('');

  // ضبط مبدئي: أظهر المندوب والوجهة معاً
  useEffect(() => {
    if (initialFitDone.current) return;
    const pts = [driverPos, destPos, myPos].filter(Boolean);
    if (pts.length >= 2) {
      map.fitBounds(pts.map(p => [p.lat, p.lng]), { padding: [60, 60], animate: false });
      initialFitDone.current = true;
    } else if (pts.length === 1) {
      map.setView([pts[0].lat, pts[0].lng], 15, { animate: false });
      initialFitDone.current = true;
    }
  }, [driverPos, destPos, myPos, map]);

  // متابعة المندوب — انتقال ناعم عند كل تغيير موقع
  useEffect(() => {
    if (!followDriver || !driverPos) return;
    const key = `${driverPos.lat.toFixed(5)},${driverPos.lng.toFixed(5)}`;
    if (prevKey.current === key) return;
    prevKey.current = key;
    map.panTo([driverPos.lat, driverPos.lng], { animate: true, duration: 1.2 });
  }, [driverPos, followDriver, map]);

  return null;
};

/**
 * MapTrack — خريطة تتبع مباشر
 *
 * Props:
 *   driverPos   { lat, lng } | null   — موقع المندوب (يتحدث مباشرة)
 *   destPos     { lat, lng } | null   — موقع التسليم
 *   myPos       { lat, lng } | null   — موقعي (للمندوب)
 *   orders      [...]                 — طلبات لوحة المندوب
 *   followDriver bool                 — تتبع المندوب تلقائياً
 *   liveMode    bool                  — تُظهر أيقونة نبضية للمندوب
 *   height      string
 */
const MapTrack = ({
  driverPos = null,
  destPos = null,
  myPos = null,
  orders = [],
  followDriver = true,
  liveMode = false,
  height = '420px',
}) => {
  injectCSS();

  const driverIcon = liveMode && driverPos ? makeLiveDriverIcon() : makeStaticDriverIcon();

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
      zoomControl={true}
    >
      <TileLayer
        attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapController
        driverPos={driverPos}
        destPos={destPos}
        myPos={myPos}
        followDriver={followDriver}
      />

      {/* موقعي — للمندوب */}
      {myPos && (
        <CircleMarker
          center={[myPos.lat, myPos.lng]}
          radius={13}
          pathOptions={{ color: '#4338CA', fillColor: '#4338CA', fillOpacity: 0.9, weight: 3 }}
        />
      )}

      {/* موقع المندوب */}
      {driverPos && (
        <Marker
          position={[driverPos.lat, driverPos.lng]}
          icon={driverIcon}
        />
      )}

      {/* موقع التسليم */}
      {destPos && (
        <Marker position={[destPos.lat, destPos.lng]} icon={destIcon} />
      )}

      {/* خط متقطع بين المندوب والوجهة */}
      {driverPos && destPos && (
        <Polyline
          positions={[
            [driverPos.lat, driverPos.lng],
            [destPos.lat, destPos.lng],
          ]}
          pathOptions={{ color: '#4338CA', weight: 3, dashArray: '10,6', opacity: 0.65 }}
        />
      )}

      {/* طلبات لوحة المندوب */}
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
