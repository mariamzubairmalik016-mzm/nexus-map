export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  bio: string | null;
  role: "user" | "admin";
};

export type Coordinates = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};
