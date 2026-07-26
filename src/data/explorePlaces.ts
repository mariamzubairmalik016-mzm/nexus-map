export type ExploreCategory =
  | "All"
  | "Nature"
  | "Cities"
  | "Heritage"
  | "Religious"
  | "Adventure";

export type ExplorePlace = {
  id: number;
  name: string;
  country: string;
  city: string;
  category: Exclude<ExploreCategory, "All">;
  rating: number;
  reviews: number;
  image: string;
  description: string;
  featured?: boolean;
};

export const explorePlaces: ExplorePlace[] = [
  { id: 1, name: "Hunza Valley", country: "Pakistan", city: "Gilgit-Baltistan", category: "Nature", rating: 4.9, reviews: 2840, image: "/destinations/hunza.jpg", description: "Snow-covered mountains, lakes and peaceful valleys.", featured: true },
  { id: 2, name: "Skardu", country: "Pakistan", city: "Gilgit-Baltistan", category: "Adventure", rating: 4.8, reviews: 2210, image: "/destinations/skardu.jpg", description: "Dramatic landscapes, lakes and adventures.", featured: true },
  { id: 3, name: "Badshahi Mosque", country: "Pakistan", city: "Lahore", category: "Religious", rating: 4.9, reviews: 5300, image: "/destinations/lahore.jpg", description: "Historic Mughal architecture and culture." },
  { id: 4, name: "Faisal Mosque", country: "Pakistan", city: "Islamabad", category: "Religious", rating: 4.8, reviews: 4600, image: "/destinations/islamabad.jpg", description: "A modern landmark at the Margalla Hills." },
  { id: 5, name: "Karachi", country: "Pakistan", city: "Karachi", category: "Cities", rating: 4.7, reviews: 7200, image: "/destinations/karachi.jpg", description: "Pakistan's coastal metropolis." },
  { id: 6, name: "Dubai Marina", country: "United Arab Emirates", city: "Dubai", category: "Cities", rating: 4.8, reviews: 8100, image: "/destinations/dubai.jpg", description: "Luxury waterfront and futuristic experiences." },
  { id: 7, name: "Istanbul", country: "Türkiye", city: "Istanbul", category: "Heritage", rating: 4.9, reviews: 9200, image: "/destinations/istanbul.jpg", description: "Asian and European history and culture." },
  { id: 8, name: "Tokyo", country: "Japan", city: "Tokyo", category: "Cities", rating: 4.9, reviews: 12000, image: "/destinations/tokyo.jpg", description: "Technology, tradition and urban energy." },
  { id: 9, name: "Paris", country: "France", city: "Paris", category: "Heritage", rating: 4.8, reviews: 15000, image: "/destinations/paris.jpg", description: "Architecture, museums and cafés." },
  { id: 10, name: "Bali", country: "Indonesia", city: "Bali", category: "Nature", rating: 4.8, reviews: 10400, image: "/destinations/bali.jpg", description: "Beaches, temples and forests." }
];
