import type { OfflinePack, OfflinePlace } from "../types/offline";
const DB="nexus-map-offline", VERSION=1, PACKS="packs", PLACES="places";
const openDb=()=>new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(DB,VERSION);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains(PACKS))d.createObjectStore(PACKS,{keyPath:"id"});if(!d.objectStoreNames.contains(PLACES)){const s=d.createObjectStore(PLACES,{keyPath:"id"});s.createIndex("packId","packId")}};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
const all=async<T>(store:string)=>{const d=await openDb();return new Promise<T[]>((res,rej)=>{const q=d.transaction(store,"readonly").objectStore(store).getAll();q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)})};
export const offlineDb={
 getPacks:()=>all<OfflinePack>(PACKS),
 savePack:async(p:OfflinePack)=>{const d=await openDb();return new Promise<void>((res,rej)=>{const q=d.transaction(PACKS,"readwrite").objectStore(PACKS).put(p);q.onsuccess=()=>res();q.onerror=()=>rej(q.error)})},
 deletePack:async(id:string)=>{const d=await openDb();return new Promise<void>((res,rej)=>{const q=d.transaction(PACKS,"readwrite").objectStore(PACKS).delete(id);q.onsuccess=()=>res();q.onerror=()=>rej(q.error)})},
 savePlaces:async(items:OfflinePlace[])=>{const d=await openDb();return new Promise<void>((res,rej)=>{const tx=d.transaction(PLACES,"readwrite"),s=tx.objectStore(PLACES);items.forEach(i=>s.put(i));tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error)})},
 searchPlaces:async(query:string)=>{const items=await all<OfflinePlace>(PLACES),q=query.toLowerCase().trim();return items.filter(i=>i.name.toLowerCase().includes(q)||i.category.toLowerCase().includes(q)||i.address?.toLowerCase().includes(q)).slice(0,30)}
};
