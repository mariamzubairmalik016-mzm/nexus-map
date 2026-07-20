import { useEffect } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, ZoomControl } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";
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

const WorldMap = ({ coordinates, routeCoordinates = [], start = null, destination = null }: Props) => (
  <MapContainer center={[30.3753, 69.3451]} zoom={5} zoomControl={false} className="h-full min-h-[680px] w-full">
    <ZoomControl position="bottomright" />
    <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <Controller coordinates={coordinates} route={routeCoordinates} />
    {routeCoordinates.length > 1 && <Polyline positions={routeCoordinates} pathOptions={{ color: "#06b6d4", weight: 6 }} />}
    {start && <Marker position={[start.latitude, start.longitude]}><Popup>Starting point</Popup></Marker>}
    {destination && <Marker position={[destination.latitude, destination.longitude]}><Popup>Destination</Popup></Marker>}
    {!start && !destination && coordinates && <Marker position={[coordinates.latitude, coordinates.longitude]}><Popup>Selected location</Popup></Marker>}
  </MapContainer>
);
export default WorldMap;
