// ============================================================
// NEXUS MAP — Smart Tourism Ecosystem Type Definitions
// ============================================================

// ─── Tourism POI Categories ────────────────────────────────
export type TourismCategory =
  | "hotel" | "resort" | "restaurant" | "cafe"
  | "museum" | "historical" | "unesco" | "beach"
  | "park" | "waterfall" | "lake" | "forest"
  | "mountain" | "camping" | "hiking"
  | "shopping_mall" | "market"
  | "fuel_station" | "mosque" | "hospital" | "police"
  | "atm" | "bus_station" | "railway" | "airport"
  | "charging_station" | "rest_area"
  | "hidden_gem" | "famous_place" | "sunset_point"
  | "photography_spot" | "adventure" | "family_attraction";

export const TOURISM_CATEGORIES: TourismCategory[] = [
  "hotel", "resort", "restaurant", "cafe",
  "museum", "historical", "unesco", "beach",
  "park", "waterfall", "lake", "forest",
  "mountain", "camping", "hiking",
  "shopping_mall", "market",
  "fuel_station", "mosque", "hospital", "police",
  "atm", "bus_station", "railway", "airport",
  "charging_station", "rest_area",
  "hidden_gem", "famous_place", "sunset_point",
  "photography_spot", "adventure", "family_attraction",
];

export const TOURISM_CATEGORY_LABELS: Record<TourismCategory, string> = {
  hotel: "Hotel", resort: "Resort", restaurant: "Restaurant", cafe: "Café",
  museum: "Museum", historical: "Historical Place", unesco: "UNESCO Heritage",
  beach: "Beach", park: "Park", waterfall: "Waterfall", lake: "Lake",
  forest: "Forest", mountain: "Mountain", camping: "Camping", hiking: "Hiking",
  shopping_mall: "Shopping Mall", market: "Market",
  fuel_station: "Fuel Station", mosque: "Mosque", hospital: "Hospital",
  police: "Police Station", atm: "ATM", bus_station: "Bus Station",
  railway: "Railway Station", airport: "Airport",
  charging_station: "Charging Station", rest_area: "Rest Area",
  hidden_gem: "Hidden Gem", famous_place: "Famous Place",
  sunset_point: "Sunset Point", photography_spot: "Photography Spot",
  adventure: "Adventure", family_attraction: "Family Attraction",
};

export const TOURISM_ICONS: Record<TourismCategory, string> = {
  hotel: "Building2", resort: "Building2", restaurant: "UtensilsCrossed",
  cafe: "Coffee", museum: "Landmark", historical: "Landmark",
  unesco: "Globe", beach: "Umbrella", park: "TreePine", waterfall: "Droplets",
  lake: "Waves", forest: "Trees", mountain: "Mountain", camping: "Tent",
  hiking: "Footprints", shopping_mall: "ShoppingBag", market: "Store",
  fuel_station: "Fuel", mosque: "Mosque", hospital: "Hospital",
  police: "Shield", atm: "CreditCard", bus_station: "Bus",
  railway: "Train", airport: "Plane", charging_station: "Zap",
  rest_area: "ParkingCircle", hidden_gem: "Gem", famous_place: "Star",
  sunset_point: "Sun", photography_spot: "Camera",
  adventure: "Compass", family_attraction: "Users",
};

// ─── Smart Tourism POI ─────────────────────────────────────
export type TourismPOI = {
  id: string;
  name: string;
  category: TourismCategory;
  subCategory?: string;
  description: string;
  shortDescription?: string;
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  country: string;
  countryIso2: string;
  imageUrl?: string;
  galleryUrls?: string[];
  rating: number;
  reviewCount: number;
  priceLevel?: 1 | 2 | 3 | 4;
  phone?: string;
  website?: string;
  openingHours?: string;
  isVerified: boolean;
  isFeatured: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

// ─── Mood Travel ───────────────────────────────────────────
export type TravelMood =
  | "relax" | "adventure" | "romantic" | "family"
  | "food" | "photography" | "history" | "beach"
  | "snow" | "nature" | "luxury" | "budget";

export const TRAVEL_MOODS: TravelMood[] = [
  "relax", "adventure", "romantic", "family",
  "food", "photography", "history", "beach",
  "snow", "nature", "luxury", "budget",
];

export const TRAVEL_MOOD_LABELS: Record<TravelMood, string> = {
  relax: "Relax & Unwind", adventure: "Adventure Seeker",
  romantic: "Romantic Getaway", family: "Family Fun",
  food: "Food Explorer", photography: "Photography Tour",
  history: "History & Culture", beach: "Beach Escape",
  snow: "Snow & Mountains", nature: "Nature Lover",
  luxury: "Luxury Experience", budget: "Budget Travel",
};

export const MOOD_RECOMMENDATIONS: Record<TravelMood, { categories: TourismCategory[]; description: string }> = {
  relax: { categories: ["resort", "beach", "park", "lake", "cafe"], description: "Peaceful places to unwind and recharge" },
  adventure: { categories: ["hiking", "mountain", "camping", "adventure", "waterfall"], description: "Thrilling experiences for adrenaline seekers" },
  romantic: { categories: ["resort", "restaurant", "sunset_point", "cafe", "beach"], description: "Perfect spots for couples" },
  family: { categories: ["family_attraction", "park", "beach", "museum", "restaurant"], description: "Fun for the whole family" },
  food: { categories: ["restaurant", "cafe", "market"], description: "Culinary adventures await" },
  photography: { categories: ["photography_spot", "sunset_point", "historical", "unesco", "lake"], description: "Capture stunning moments" },
  history: { categories: ["historical", "unesco", "museum", "mosque"], description: "Step back in time" },
  beach: { categories: ["beach", "resort", "sunset_point", "restaurant"], description: "Sun, sand, and sea" },
  snow: { categories: ["mountain", "resort", "adventure"], description: "Winter wonderland experiences" },
  nature: { categories: ["forest", "lake", "waterfall", "park", "mountain", "hiking"], description: "Connect with the natural world" },
  luxury: { categories: ["resort", "restaurant", "hotel", "shopping_mall"], description: "Premium experiences for refined tastes" },
  budget: { categories: ["market", "park", "hiking", "beach", "museum"], description: "Explore more for less" },
};

// ─── Smart Budget Analyzer ─────────────────────────────────
export type BudgetCategory =
  | "hotel" | "fuel" | "food" | "shopping"
  | "transportation" | "emergency" | "miscellaneous"
  | "activities" | "tickets";

export type BudgetBreakdown = {
  category: BudgetCategory;
  label: string;
  estimatedCost: number;
  percentage: number;
  tips: string[];
};

export type BudgetAnalysis = {
  totalBudget: number;
  totalEstimated: number;
  currency: string;
  score: number; // 0-100
  scoreLabel: string;
  breakdown: BudgetBreakdown[];
  savingsSuggestions: string[];
  dailyAverage: number;
  perPersonCost?: number;
};

// ─── Smart Travel Health ───────────────────────────────────
export type HealthFacility = {
  id: string;
  name: string;
  type: "hospital" | "clinic" | "pharmacy" | "blood_bank";
  latitude: number;
  longitude: number;
  address: string;
  phone: string;
  emergency: boolean;
  open24Hours: boolean;
  distance?: number;
};

export type WeatherAlert = {
  type: "extreme_heat" | "heavy_rain" | "flood" | "poor_air" | "storm";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
};

// ─── Smart Family Safety ───────────────────────────────────
export type SafeZone = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number; // meters
  type: "home" | "school" | "work" | "custom";
  notifyOnEntry: boolean;
  notifyOnExit: boolean;
};

export type FamilyMember = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  relationship: "parent" | "child" | "spouse" | "sibling" | "friend";
  avatarUrl?: string;
  isActive: boolean;
  lastKnownLocation?: { latitude: number; longitude: number; timestamp: string };
};

export type EmergencyContact = {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  isPrimary: boolean;
};

export type SOSAlert = {
  id: string;
  userId: string;
  latitude: number;
  longitude: number;
  message: string;
  status: "active" | "responded" | "resolved";
  notifiedContacts: string[];
  createdAt: string;
  resolvedAt?: string;
};

// ─── Community Hub ─────────────────────────────────────────
export type Review = {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  placeId: string;
  placeName: string;
  rating: number;
  title: string;
  content: string;
  images: string[];
  likes: number;
  helpfulCount: number;
  createdAt: string;
};

export type TravelGroup = {
  id: string;
  name: string;
  description: string;
  coverImage?: string;
  memberCount: number;
  isPublic: boolean;
  tags: string[];
  createdBy: string;
  createdAt: string;
};

export type CommunityTip = {
  id: string;
  userId: string;
  userName: string;
  title: string;
  content: string;
  category: "travel_tip" | "road_report" | "scam_alert" | "recommendation" | "photo";
  imageUrl?: string;
  likes: number;
  bookmarks: number;
  comments: Comment[];
  createdAt: string;
};

export type Comment = {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
};

// ─── Memory Book & Digital Passport ────────────────────────
export type TravelMemory = {
  id: string;
  userId: string;
  tripName: string;
  destination: string;
  photos: string[];
  videos: string[];
  notes: string;
  rating: number;
  distanceTravelledKm: number;
  countriesVisited: string[];
  citiesVisited: string[];
  startDate: string;
  endDate: string;
  createdAt: string;
};

export type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "explorer" | "social" | "milestone" | "special";
  requirement: string;
  progress: number;
  maxProgress: number;
  unlockedAt?: string;
};

export type DigitalPassport = {
  userId: string;
  userName: string;
  level: number;
  xp: number;
  coins: number;
  countryStamps: string[];
  cityStamps: string[];
  badges: string[];
  achievements: Achievement[];
  totalCountries: number;
  totalCities: number;
  totalDistanceKm: number;
  totalTrips: number;
};

// ─── Marketplace ───────────────────────────────────────────
export type TourGuide = {
  id: string;
  userId: string;
  fullName: string;
  avatarUrl?: string;
  bio: string;
  languages: string[];
  specialties: string[];
  cities: string[];
  rating: number;
  reviewCount: number;
  pricePerDay: number;
  currency: string;
  isVerified: boolean;
  availability: { date: string; available: boolean }[];
  photos: string[];
  phone?: string;
  createdAt: string;
};

export type MarketplaceListing = {
  id: string;
  providerId: string;
  providerType: "guide" | "hotel" | "restaurant" | "vehicle_rental" | "camping" | "agency" | "photographer" | "shop";
  name: string;
  description: string;
  images: string[];
  category: TourismCategory;
  city: string;
  country: string;
  price: number;
  currency: string;
  rating: number;
  reviewCount: number;
  isVerified: boolean;
  amenities: string[];
  contactPhone?: string;
  contactEmail?: string;
  website?: string;
  createdAt: string;
};

export type Booking = {
  id: string;
  userId: string;
  listingId: string;
  providerType: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  startDate: string;
  endDate: string;
  guests: number;
  totalPrice: number;
  currency: string;
  notes?: string;
  createdAt: string;
};

// ─── Enhanced Trip Plan ────────────────────────────────────
export type MealPlan = {
  breakfast: string[];
  lunch: string[];
  dinner: string[];
  localSpecialties: string[];
};

export type EnhancedTripPlan = {
  id: string;
  destination: string;
  days: number;
  budget: number;
  currency: string;
  tripType: string;
  transport: string;
  travelMood?: TravelMood;
  hotelSuggestion: string;
  foodSuggestion: string;
  mealPlan?: MealPlan;
  packingList: string[];
  safetyTips: string[];
  weatherAdvice: string[];
  localFoodSuggestions: string[];
  nearbyAttractions: string[];
  budgetAnalysis?: BudgetAnalysis;
  itinerary: Array<{
    day: number;
    title: string;
    summary: string;
    activities: Array<{
      time: string;
      title: string;
      description: string;
      category: string;
      estimatedCost: number;
    }>;
    estimatedDailyCost: number;
    mealPlan?: { breakfast: string; lunch: string; dinner: string };
  }>;
  estimatedTotalCost: number;
  createdAt: string;
};

// ─── Smart Route Types ─────────────────────────────────────
export type RouteType =
  | "fastest" | "shortest" | "scenic" | "tourist"
  | "family_safe" | "walking" | "bike" | "night_safe"
  | "rain_safe" | "eco";

export const ROUTE_TYPES: RouteType[] = [
  "fastest", "shortest", "scenic", "tourist",
  "family_safe", "walking", "bike", "night_safe",
  "rain_safe", "eco",
];

export const ROUTE_TYPE_LABELS: Record<RouteType, string> = {
  fastest: "Fastest Route", shortest: "Shortest Route",
  scenic: "Scenic Route", tourist: "Tourist Route",
  family_safe: "Family Safe Route", walking: "Walking Route",
  bike: "Bike Route", night_safe: "Night Safe Route",
  rain_safe: "Rain Safe Route", eco: "Eco Route",
};

export type RouteComparison = {
  type: RouteType;
  distanceKm: number;
  durationMinutes: number;
  fuelCost?: number;
  tolls?: boolean;
  description: string;
  score: number;
};

// ─── Carbon Footprint ──────────────────────────────────────
export type CarbonEstimate = {
  totalCO2Kg: number;
  ecoScore: number; // 0-100
  greenRoutes: string[];
  suggestions: string[];
};

// ─── Coordinate / city discovery auto-recommendations ──────
export type CityDiscovery = {
  city: string;
  country: string;
  hiddenGems: TourismPOI[];
  famousPlaces: TourismPOI[];
  localFood: string[];
  historicalSites: TourismPOI[];
  familyAttractions: TourismPOI[];
  adventureLocations: TourismPOI[];
  sunsetPoints: TourismPOI[];
  photographySpots: TourismPOI[];
  shoppingStreets: string[];
  weekendActivities: string[];
};

// ─── AI Risk Analyzer ──────────────────────────────────────
export type RiskScore = {
  overall: number; // 0-100
  weather: number;
  traffic: number;
  roadConditions: number;
  flood: number;
  airQuality: number;
  recommendations: string[];
  safeToTravel: boolean;
};

// ─── AI Time Machine (History) ────────────────────────────
export type HistoricalTimeline = {
  year: number;
  event: string;
  description: string;
};

export type PlaceHistory = {
  placeId: string;
  placeName: string;
  history: string;
  timeline: HistoricalTimeline[];
  interestingFacts: string[];
  audioNarrationUrl?: string;
};
