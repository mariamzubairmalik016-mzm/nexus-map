import { useEffect } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, ZoomControl } from "react-leaflet";
import L, { type LatLngBoundsExpression } from "leaflet";
import type { Coordinates } from "../../types";
import "../../config/leaflet";

type Props = {
  coordinates: Coordinates | null;
  routeCoordinates?: [number, number][];
  start?: Coordinates | null;
  destination?: Coordinates | null;
};

const Controller = ({ coordinates, route }: { coordinates: Coordinates | null; route: [number, number][] }) => {
  const map = useMap();
  useEffect(() => {
    if (route.length > 1) map.fitBounds(route as LatLngBoundsExpression, { padding: [45, 45] });
    else if (coordinates) map.flyTo([coordinates.latitude, coordinates.longitude], 13);
  }, [coordinates, route, map]);
  return null;
};

const googleMapIcon = L.divIcon({
  className: "",
  html: \`
    <svg width="28" height="42" viewBox="0 0 32 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 0C7.16344 0 0 7.16344 0 16C0 27.2 16 48 16 48C16 48 32 27.2 32 16C32 7.16344 24.8366 0 16 0Z" fill="#EA4335"/>
      <path d="M16 23C19.866 23 23 19.866 23 16C23 12.134 19.866 9 16 9C12.134 9 9 12.134 9 16C9 19.866 12.134 23 16 23Z" fill="#7C0000" fill-opacity="0.3"/>
      <path d="M16 22C19.3137 22 22 19.3137 22 16C22 12.6863 19.3137 10 16 10C12.6863 10 10 12.6863 10 16C10 19.3137 12.6863 22 16 22Z" fill="white"/>
    </svg>
  \`,
  iconSize: [28, 42],
  iconAnchor: [14, 42],
  popupAnchor: [0, -42],
});

const WorldMap = ({ coordinates, routeCoordinates = [], start = null, destination = null }: Props) => (
  <MapContainer center={[25, 20]} zoom={3} zoomControl={false} className="h-full min-h-[680px] w-full">
    <ZoomControl position="bottomright" />
    <TileLayer attribution="&copy; Google Maps" url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" />
    <Controller coordinates={coordinates} route={routeCoordinates} />
    {routeCoordinates.length > 1 && <Polyline positions={routeCoordinates} pathOptions={{ color: "#4285F4", weight: 6, opacity: 1, lineCap: "round", lineJoin: "round" }} />}
    {start && <Marker position={[start.latitude, start.longitude]} icon={googleMapIcon}><Popup>Starting point</Popup></Marker>}
    {destination && <Marker position={[destination.latitude, destination.longitude]} icon={googleMapIcon}><Popup>Destination</Popup></Marker>}
    {!start && !destination && coordinates && <Marker position={[coordinates.latitude, coordinates.longitude]} icon={googleMapIcon}><Popup>Selected location</Popup></Marker>}
  </MapContainer>
);
export default WorldMap;
