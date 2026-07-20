export type OfflineScope = "City" | "District" | "Province / State" | "Country";
export type OfflinePackStatus = "queued" | "downloading" | "paused" | "downloaded" | "failed";
export type OfflinePlace = { id:string; packId:string; name:string; category:string; latitude:number; longitude:number; address?:string };
export type OfflinePack = { id:string; location:string; scope:OfflineScope; estimatedSizeMb:number; downloadedSizeMb:number; progress:number; status:OfflinePackStatus; createdAt:string; updatedAt:string; placesCount:number };
