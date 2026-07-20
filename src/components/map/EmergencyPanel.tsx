import { Ambulance, Flame, PhoneCall, Shield, Share2 } from "lucide-react";

type Props = {
  latitude?: number;
  longitude?: number;
};

const EmergencyPanel = ({ latitude, longitude }: Props) => {
  const shareLocation = async () => {
    const text =
      latitude !== undefined && longitude !== undefined
        ? `My live location: https://maps.google.com/?q=${latitude},${longitude}`
        : "My location is not available yet.";

    await navigator.clipboard.writeText(text);
    alert("Location link copied.");
  };

  const services = [
    { label: "Police", number: "15", icon: Shield },
    { label: "Ambulance", number: "1122", icon: Ambulance },
    { label: "Fire Brigade", number: "16", icon: Flame },
  ];

  return (
    <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-4">
      <h3 className="font-semibold text-red-200">Emergency SOS</h3>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {services.map(({ label, number, icon: Icon }) => (
          <a
            key={label}
            href={`tel:${number}`}
            className="rounded-xl border border-white/10 bg-slate-950/40 p-3 text-center"
          >
            <Icon className="mx-auto text-red-400" size={18} />
            <p className="mt-2 text-xs font-semibold">{label}</p>
            <p className="text-[11px] text-slate-500">{number}</p>
          </a>
        ))}
      </div>

      <button
        type="button"
        onClick={() => void shareLocation()}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 py-3 text-sm font-semibold"
      >
        <Share2 size={17} />
        Share Live Location
      </button>
    </div>
  );
};

export default EmergencyPanel;
