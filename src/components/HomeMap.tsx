import { useEffect } from 'react';
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { Location } from '../core/types';

interface HomeMapProps {
  value?: Location;
  pinLabel?: string;
  onChange(value: Location): void;
}

function PinPicker({ value, pinLabel, onChange }: HomeMapProps) {
  useMapEvents({
    click(event) {
      onChange({ lat: event.latlng.lat, lon: event.latlng.lng, label: pinLabel ?? 'Home' });
    },
  });
  return value ? (
    <CircleMarker
      center={[value.lat, value.lon]}
      radius={9}
      pathOptions={{ fillColor: '#d97745', color: '#fff', weight: 3, fillOpacity: 1 }}
    />
  ) : null;
}

function RecenterMap({ value }: Pick<HomeMapProps, 'value'>) {
  const map = useMap();
  useEffect(() => {
    if (value) map.setView([value.lat, value.lon], Math.max(map.getZoom(), 15));
  }, [map, value]);
  return null;
}

export function HomeMap(props: HomeMapProps) {
  const center: [number, number] = props.value
    ? [props.value.lat, props.value.lon]
    : [36.0014, -78.9382];
  return (
    <MapContainer className="home-map" center={center} zoom={15} scrollWheelZoom={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <RecenterMap value={props.value} />
      <PinPicker {...props} />
    </MapContainer>
  );
}
