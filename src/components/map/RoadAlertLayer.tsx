import { useState } from "react";
import { Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

import type { RoadAlert } from "../../types/roadAlerts";

const SEV_COLOR: Record<string, string> = {
  low: "#34d399",
  medium: "#fbbf24",
  high: "#fb923c",
  critical: "#f87171",
};

// Coarser grid when zoomed out -> fewer, bigger clusters.
const gridPrecision = (zoom: number) => (zoom < 7 ? 1 : zoom < 9 ? 0.5 : 0.25);

const pinIcon = (alert: RoadAlert) => {
  const color = SEV_COLOR[alert.severity] ?? "#94a3b8";
  const pulse = (alert.severity === "critical" || alert.severity === "high") && alert.status === "active";
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:22px;height:22px">${
      pulse ? `<span class="nexus-pin-ring" style="background:${color}55"></span>` : ""
    }<span class="nexus-pin" style="background:${color}"></span></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
};

/**
 * Renders road alerts as severity-colored markers, clustering them into count
 * badges at low zoom. Must be a child of <MapContainer>.
 */
const RoadAlertLayer = ({
  alerts,
  onSelect,
}: {
  alerts: RoadAlert[];
  onSelect: (alert: RoadAlert) => void;
}) => {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

  if (zoom >= 11) {
    return (
      <>
        {alerts.map((alert) => (
          <Marker
            key={alert.id}
            position={[alert.latitude, alert.longitude]}
            icon={pinIcon(alert)}
            eventHandlers={{ click: () => onSelect(alert) }}
          />
        ))}
      </>
    );
  }

  const precision = gridPrecision(zoom);
  const cells = new Map<string, { lat: number; lng: number; items: RoadAlert[] }>();
  for (const alert of alerts) {
    const key = `${Math.round(alert.latitude / precision)}_${Math.round(alert.longitude / precision)}`;
    const cell = cells.get(key) ?? { lat: 0, lng: 0, items: [] };
    cell.items.push(alert);
    cell.lat += alert.latitude;
    cell.lng += alert.longitude;
    cells.set(key, cell);
  }

  return (
    <>
      {[...cells.values()].map((cell, index) => {
        const lat = cell.lat / cell.items.length;
        const lng = cell.lng / cell.items.length;
        if (cell.items.length === 1) {
          const alert = cell.items[0];
          return (
            <Marker
              key={alert.id}
              position={[lat, lng]}
              icon={pinIcon(alert)}
              eventHandlers={{ click: () => onSelect(alert) }}
            />
          );
        }
        const icon = L.divIcon({
          className: "",
          html: `<div class="nexus-cluster">${cell.items.length}</div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });
        return (
          <Marker
            key={`cluster-${index}`}
            position={[lat, lng]}
            icon={icon}
            eventHandlers={{ click: () => map.flyTo([lat, lng], Math.min(16, zoom + 3)) }}
          />
        );
      })}
    </>
  );
};

export default RoadAlertLayer;
