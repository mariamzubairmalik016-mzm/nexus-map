import { useEffect,useState } from "react";
export const useInternetStatus=()=>{const [online,setOnline]=useState(navigator.onLine);useEffect(()=>{const a=()=>setOnline(true),b=()=>setOnline(false);addEventListener("online",a);addEventListener("offline",b);return()=>{removeEventListener("online",a);removeEventListener("offline",b)}},[]);return online};
