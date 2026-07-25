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
import RoadAlertLayer from "./RoadAlertLayer";

import type {
  CommunityNote,
  Coordinates,
  RouteAlternative,
  TrafficIncident,
} from "../../types/navigation";
import type { RoadAlert } from "../../types/roadAlerts";

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
  roadAlerts?: RoadAlert[];
  showTraffic?: boolean;
  onAlertSelect?: (alert: RoadAlert) => void;
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
  roadAlerts,
  showTraffic = false,
  onAlertSelect,
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

  const googleMapIcon = L.divIcon({
    className: "",
    html: `
      <svg width="28" height="42" viewBox="0 0 32 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 0C7.16344 0 0 7.16344 0 16C0 27.2 16 48 16 48C16 48 32 27.2 32 16C32 7.16344 24.8366 0 16 0Z" fill="#EA4335"/>
        <path d="M16 23C19.866 23 23 19.866 23 16C23 12.134 19.866 9 16 9C12.134 9 9 12.134 9 16C9 19.866 12.134 23 16 23Z" fill="#7C0000" fill-opacity="0.3"/>
        <path d="M16 22C19.3137 22 22 19.3137 22 16C22 12.6863 19.3137 10 16 10C12.6863 10 10 12.6863 10 16C10 19.3137 12.6863 22 16 22Z" fill="white"/>
      </svg>
    `,
    iconSize: [28, 42],
    iconAnchor: [14, 42],
    popupAnchor: [0, -42],
  });

  const blueDotIcon = L.divIcon({
    className: "nexus-blue-dot",
    html: \`
      <div style="width:16px;height:16px;background-color:#4285F4;border-radius:50%;border:2.5px solid white;box-shadow:0 0 4px rgba(0,0,0,0.4);"></div>
    \`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  });

  return (
    <MapContainer
      center={[25, 20]}
      zoom={3}
      zoomControl={false}
      className="h-full min-h-[760px] w-full"
    >
      <ZoomControl position="bottomright" />

      {/* Google Maps standard tile layer */}
      <TileLayer
        attribution="&copy; Google Maps"
        url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
      />

      {/* Traffic is OFF by default — only loaded when the user enables it, so it
          can never flood the map with /traffic-tile requests. */}
      {showTraffic && (
        <TileLayer
          attribution="Traffic © TomTom"
          url={`${import.meta.env.VITE_API_URL || "http://localhost:5000/api"}/navigation/traffic-tile/{z}/{x}/{y}`}
          opacity={0.75}
          zIndex={500}
        />
      )}

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
            color: selected ? "#4285F4" : "#9AA0A6",
            weight: selected ? 6 : 4,
            opacity: selected ? 1 : 0.8,
            lineCap: "round",
            lineJoin: "round"
          }}
        />
      ))}

      {start && (
        <Marker position={[start.latitude, start.longitude]} icon={googleMapIcon}>
          <Popup>Starting point</Popup>
        </Marker>
      )}

      {destination && (
        <Marker
          position={[destination.latitude, destination.longitude]}
          icon={googleMapIcon}
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
            icon={blueDotIcon}
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

      {roadAlerts && onAlertSelect && (
        <RoadAlertLayer alerts={roadAlerts} onSelect={onAlertSelect} />
      )}
    </MapContainer>
  );
};

export default NavigationMap;
