import { useState } from "react";
import { Heart, MapPin, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { explorePlaces } from "../../data/explorePlaces";
const Favorites = () => {
  const [items, setItems] = useState(explorePlaces.slice(0, 3));
  return <section className="min-h-[calc(100vh-80px)] px-4 py-14 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl"><p className="text-sm uppercase tracking-[.25em] text-cyan-400">Saved collection</p><h1 className="mt-3 text-4xl font-bold">Your favorite places</h1><div className="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{items.map((place) => <article key={place.id} className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[.04]"><img src={place.image} className="aspect-[16/10] w-full object-cover" /><div className="p-5"><h2 className="text-2xl font-bold">{place.name}</h2><p className="mt-2 text-slate-400">{place.city}, {place.country}</p><div className="mt-5 grid grid-cols-2 gap-3"><Link to="/map" className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 py-3 text-sm font-semibold text-slate-950"><MapPin size={17} />Map</Link><button onClick={() => setItems((current) => current.filter((item) => item.id !== place.id))} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-400/10 py-3 text-sm text-red-300"><Trash2 size={17} />Remove</button></div></div></article>)}</div>{items.length === 0 && <div className="mt-10 rounded-[28px] border border-dashed border-white/10 p-16 text-center"><Heart className="mx-auto text-slate-600" size={42} /><p className="mt-4 text-2xl font-bold">No favorites yet</p></div>}</div></section>;
};
export default Favorites;
