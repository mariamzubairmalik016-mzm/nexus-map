import { CloudRain, Eye, Thermometer, Wind } from "lucide-react";
import type { WeatherData } from "../../services/weatherService";

const WeatherPanel = ({ weather }: { weather: WeatherData | null }) => {
  if (!weather) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <h3 className="font-semibold">Live Weather</h3>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-slate-950/50 p-3">
          <Thermometer className="text-cyan-400" size={18} />
          <p className="mt-2 font-bold">{weather.temperature}°C</p>
          <p className="text-xs text-slate-500">
            Feels {weather.apparentTemperature}°C
          </p>
        </div>

        <div className="rounded-xl bg-slate-950/50 p-3">
          <CloudRain className="text-blue-400" size={18} />
          <p className="mt-2 font-bold">{weather.precipitation} mm</p>
          <p className="text-xs text-slate-500">
            Humidity {weather.humidity}%
          </p>
        </div>

        <div className="rounded-xl bg-slate-950/50 p-3">
          <Wind className="text-purple-400" size={18} />
          <p className="mt-2 font-bold">{weather.windSpeed} km/h</p>
          <p className="text-xs text-slate-500">Wind</p>
        </div>

        <div className="rounded-xl bg-slate-950/50 p-3">
          <Eye className="text-emerald-400" size={18} />
          <p className="mt-2 font-bold">
            {(weather.visibility / 1000).toFixed(1)} km
          </p>
          <p className="text-xs text-slate-500">Visibility</p>
        </div>
      </div>
    </div>
  );
};

export default WeatherPanel;
