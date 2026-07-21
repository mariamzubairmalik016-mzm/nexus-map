import { useEffect, useMemo } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
  ZoomControl,
} from "react-leaflet";
import L, { type LatLngBoundsExpression } from "leaflet";
import "../../config/leaflet";

import type {
  CommunityNote,
  Coordinates,
  RouteAlternative,
  TrafficIncident,
} from "../../types/navigation";

type Bounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

type Props = {
  start: Coordinates | null;
  destination: Coordinates | null;
  selectedRoute: RouteAlternative | null;
  alternatives: RouteAlternative[];
  currentLocation: Coordinates | null;
  incidents: TrafficIncident[];
  communityNotes: CommunityNote[];
  onBoundsChange: (bounds: Bounds) => void;
  onRouteSelect: (route: RouteAlternative) => void;
};

const LiveController = ({
  selectedRoute,
  currentLocation,
}: {
  selectedRoute: RouteAlternative | null;
  currentLocation: Coordinates | null;
}) => {
  const map = useMap();

  useEffect(() => {
    if (selectedRoute?.coordinates.length) {
      map.fitBounds(
        selectedRoute.coordinates as LatLngBoundsExpression,
        { padding: [60, 60] },
      );
      return;
    }

    if (currentLocation) {
      map.flyTo(
        [currentLocation.latitude, currentLocation.longitude],
        16,
      );
    }
  }, [currentLocation, map, selectedRoute]);

  return null;
};

const BoundsWatcher = ({
  onBoundsChange,
}: {
  onBoundsChange: (bounds: Bounds) => void;
}) => {
  const map = useMapEvents({
    moveend: () => {
      const bounds = map.getBounds();
      onBoundsChange({
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth(),
      });
    },
  });

  useEffect(() => {
    const bounds = map.getBounds();
    onBoundsChange({
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth(),
    });
  }, [map, onBoundsChange]);

  return null;
};

const NavigationMap = ({
  start,
  destination,
  selectedRoute,
  alternatives,
  currentLocation,
  incidents,
  communityNotes,
  onBoundsChange,
  onRouteSelect,
}: Props) => {
  const trafficUrl =
    "https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png" +
    "?tileSize=256&key=__TRAFFIC_TILE_KEY_VIA_PROXY_NOT_SUPPORTED__";

  const routeLines = useMemo(
    () =>
      alternatives.map((route) => ({
        route,
        selected: route.id === selectedRoute?.id,
      })),
    [alternatives, selectedRoute],
  );

  const communityIcon = L.divIcon({
    className: "",
    html: '<div style="width:30px;height:30px;border-radius:999px;background:#8b5cf6;border:3px solid white;box-shadow:0 4px 18px rgba(0,0,0,.4);display:grid;place-items:center;color:white;font-weight:700">C</div>',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

  return (
    <MapContainer
      center={[30.3753, 69.3451]}
      zoom={5}
      zoomControl={false}
      className="h-full min-h-[760px] w-full"
    >
      <ZoomControl position="bottomright" />

      {/* OpenStreetMap base layer. The service worker caches these tiles when an
          area is downloaded, so the map still renders offline. Online, the
          opaque TomTom layer below renders on top; offline its tiles fail and
          this cached base shows through. */}
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <TileLayer
        attribution="&copy; TomTom"
        url={`${import.meta.env.VITE_API_URL || "http://localhost:5000/api"}/navigation/map-tile/{z}/{x}/{y}`}
      />

      <TileLayer
        attribution="Traffic © TomTom"
        url={`${import.meta.env.VITE_API_URL || "http://localhost:5000/api"}/navigation/traffic-tile/{z}/{x}/{y}`}
        opacity={0.75}
        zIndex={500}
      />

      <BoundsWatcher onBoundsChange={onBoundsChange} />
      <LiveController
        selectedRoute={selectedRoute}
        currentLocation={currentLocation}
      />

      {routeLines.map(({ route, selected }) => (
        <Polyline
          key={route.id}
          positions={route.coordinates}
          eventHandlers={{
            click: () => onRouteSelect(route),
          }}
          pathOptions={{
            color: selected ? "#2563eb" : "#94a3b8",
            weight: selected ? 8 : 5,
            opacity: selected ? 0.95 : 0.7,
          }}
        />
      ))}

      {start && (
        <Marker position={[start.latitude, start.longitude]}>
          <Popup>Starting point</Popup>
        </Marker>
      )}

      {destination && (
        <Marker
          position={[destination.latitude, destination.longitude]}
        >
          <Popup>Destination</Popup>
        </Marker>
      )}

      {currentLocation && (
        <>
          <Circle
            center={[
              currentLocation.latitude,
              currentLocation.longitude,
            ]}
            radius={currentLocation.accuracy ?? 20}
            pathOptions={{
              color: "#2563eb",
              fillColor: "#3b82f6",
              fillOpacity: 0.16,
            }}
          />

          <Marker
            position={[
              currentLocation.latitude,
              currentLocation.longitude,
            ]}
          >
            <Tooltip permanent direction="top">
              Your location
            </Tooltip>
          </Marker>
        </>
      )}

      {incidents.map((incident) =>
        incident.position ? (
          <Marker
            key={incident.id}
            position={[
              incident.position.latitude,
              incident.position.longitude,
            ]}
          >
            <Popup>
              <strong>{incident.title}</strong>
              <br />
              {incident.description}
            </Popup>
          </Marker>
        ) : null,
      )}

      {communityNotes.map((note) => (
        <Marker
          key={note.id}
          icon={communityIcon}
          position={[
            note.position.latitude,
            note.position.longitude,
          ]}
        >
          <Popup>
            <strong>{note.title}</strong>
            <p>{note.description}</p>
            <small>
              {note.status} · {note.helpfulCount} helpful
            </small>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default NavigationMap;
