import { useCallback, useEffect, useRef, useState } from "react";
import type { Coordinates } from "../types";
import type { SearchSuggestion } from "../types/navigation";

/**
 * One-shot GPS via the browser Geolocation API.
 *
 * Deliberately independent of the backend and of continuous tracking: pressing
 * "Use current GPS location" must work even when the API server is down, and
 * whether or not live navigation is running. Continuous tracking is exposed
 * separately as startWatching/stopWatching.
 */

const OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10_000,
  maximumAge: 30_000,
};

/** The fixed identity used when the user's own position is the start point. */
export const currentLocationSuggestion = (coordinates: Coordinates): SearchSuggestion => ({
  id: "current-location",
  provider: "gps",
  name: "Current Location",
  displayName: "Current Location",
  address: "Your current position",
  lat: coordinates.latitude,
  lng: coordinates.longitude,
  position: coordinates,
});

const friendlyMessage = (error: GeolocationPositionError): string => {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Location permission is blocked. Enable it in your browser's site settings, then try again.";
    case error.POSITION_UNAVAILABLE:
      return "Your location is unavailable right now. Check that location services are on.";
    case error.TIMEOUT:
      return "Finding your location took too long. Move somewhere with a clearer signal and try again.";
    default:
      return "Unable to detect your location.";
  }
};

const toCoordinates = (position: GeolocationPosition): Coordinates => ({
  latitude: position.coords.latitude,
  longitude: position.coords.longitude,
  accuracy: position.coords.accuracy,
});

export const useGeolocation = () => {
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [watching, setWatching] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const supported = typeof navigator !== "undefined" && "geolocation" in navigator;

  /** One-shot fix. Resolves with coordinates, or null when it failed. */
  const getCurrentLocation = useCallback(
    () =>
      new Promise<Coordinates | null>((resolve) => {
        if (!supported) {
          setError("This browser does not support location. Search for your starting point instead.");
          resolve(null);
          return;
        }

        setLoading(true);
        setError("");

        navigator.geolocation.getCurrentPosition(
          (position) => {
            const next = toCoordinates(position);
            setCoordinates(next);
            setLoading(false);
            resolve(next);
          },
          (locationError) => {
            setError(friendlyMessage(locationError));
            setLoading(false);
            resolve(null);
          },
          OPTIONS,
        );
      }),
    [supported],
  );

  /** Continuous tracking — separate from the one-shot selection above. */
  const startWatching = useCallback(() => {
    if (!supported || watchIdRef.current !== null) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => setCoordinates(toCoordinates(position)),
      (locationError) => setError(friendlyMessage(locationError)),
      OPTIONS,
    );
    setWatching(true);
  }, [supported]);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current === null) return;
    navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    setWatching(false);
  }, []);

  // Never leave a watch running after the component unmounts.
  useEffect(
    () => () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    },
    [],
  );

  return {
    coordinates,
    loading,
    error,
    supported,
    watching,
    getCurrentLocation,
    startWatching,
    stopWatching,
    clearError: () => setError(""),
  };
};
