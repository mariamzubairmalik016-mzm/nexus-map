export type StorageEstimateInfo = {
  usageBytes: number;
  quotaBytes: number;
  percent: number;
  persisted: boolean;
  supported: boolean;
};

/** Real device storage usage via the Storage Manager API. */
export const getStorageEstimate = async (): Promise<StorageEstimateInfo> => {
  if (!("storage" in navigator) || !navigator.storage?.estimate) {
    return { usageBytes: 0, quotaBytes: 0, percent: 0, persisted: false, supported: false };
  }
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
  return {
    usageBytes: usage,
    quotaBytes: quota,
    percent: quota ? Math.min(100, (usage / quota) * 100) : 0,
    persisted,
    supported: true,
  };
};

/** Ask the browser to keep offline data from being evicted under storage pressure. */
export const requestPersistentStorage = async () => {
  if (navigator.storage?.persist) {
    try {
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }
  return false;
};

export const formatBytes = (bytes: number) => {
  if (!bytes) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
};
