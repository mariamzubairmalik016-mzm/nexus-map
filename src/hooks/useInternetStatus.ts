import { useEffect, useState } from "react";

import { networkStatus } from "../services/networkStatus";

// Backed by the single networkStatus source so every component agrees.
export const useInternetStatus = () => {
  const [online, setOnline] = useState(networkStatus.isOnline());
  useEffect(() => networkStatus.subscribe(setOnline), []);
  return online;
};
