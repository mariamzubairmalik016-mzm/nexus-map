export type WeatherData = {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  precipitation: number;
  windSpeed: number;
  visibility: number;
  weatherCode: number;
};

import { assertOnline } from "./networkStatus";

export const getWeather = async (
  latitude: number,
  longitude: number,
): Promise<WeatherData> => {
  assertOnline(); // Open-Meteo is a live service — skip when offline.
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current:
      "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,visibility",
    timezone: "auto",
  });

  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error("Weather service is unavailable.");
  }

  const data = await response.json();
  const current = data.current;

  return {
    temperature: current.temperature_2m,
    apparentTemperature: current.apparent_temperature,
    humidity: current.relative_humidity_2m,
    precipitation: current.precipitation,
    windSpeed: current.wind_speed_10m,
    visibility: current.visibility,
    weatherCode: current.weather_code,
  };
};
