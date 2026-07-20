import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Coordinates,
  RouteAlternative,
} from "../types/navigation";
import { navigationApi } from "../services/navigationApi";

const distanceMeters = (a: Coordinates, b: Coordinates) => {
  const radius = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLon / 2) ** 2;

  return 2 * radius * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

const nearestRouteDistance = (
  current: Coordinates,
  route: RouteAlternative,
) => {
  let nearest = Number.POSITIVE_INFINITY;

  for (const [lat, lon] of route.coordinates) {
    nearest = Math.min(
      nearest,
      distanceMeters(current, {
        latitude: lat,
        longitude: lon,
      }),
    );
  }

  return nearest;
};

export const useLiveNavigation = () => {
  const watchId = useRef<number | null>(null);
  const lastRerouteAt = useRef(0);

  const [tracking, setTracking] = useState(false);
  const [current, setCurrent] = useState<Coordinates | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [activeRoute, setActiveRoute] =
    useState<RouteAlternative | null>(null);
  const [destination, setDestination] =
    useState<Coordinates | null>(null);
  const [rerouting, setRerouting] = useState(false);

  const stop = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setTracking(false);
  }, []);

  const start = useCallback(
    (
      route: RouteAlternative,
      destinationPoint: Coordinates,
    ) => {
      if (!navigator.geolocation) {
        setError("GPS tracking is not supported.");
        return;
      }

      setActiveRoute(route);
      setDestination(destinationPoint);
      setError("");
      setTracking(true);

      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }

      watchId.current = navigator.geolocation.watchPosition(
        ({ coords }) => {
          setCurrent({
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy,
          });
          setHeading(coords.heading);
          setSpeed(coords.speed);
        },
        (locationError) => {
          setError(locationError.message);
          setTracking(false);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 1500,
          timeout: 15000,
        },
      );
    },
    [],
  );

  useEffect(() => {
    if (!tracking || !current || !activeRoute || !destination) return;

    const offRouteDistance = nearestRouteDistance(current, activeRoute);
    const enoughTimePassed = Date.now() - lastRerouteAt.current > 20000;

    if (offRouteDistance > 80 && enoughTimePassed) {
      lastRerouteAt.current = Date.now();
      setRerouting(true);

      void navigationApi
        .routes(current, destination, {
          travelMode: "car",
          avoidTolls: false,
          alternatives: 1,
        })
        .then((routes) => {
          if (routes[0]) setActiveRoute(routes[0]);
        })
        .catch(() => {
          setError("Automatic rerouting failed.");
        })
        .finally(() => setRerouting(false));
    }
  }, [activeRoute, current, destination, tracking]);

  useEffect(() => stop, [stop]);

  return {
    tracking,
    current,
    heading,
    speed,
    error,
    activeRoute,
    rerouting,
    start,
    stop,
  };
};
