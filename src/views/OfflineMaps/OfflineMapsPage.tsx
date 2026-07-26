import React from "react";

// Local placeholder components to avoid missing-module errors.
// Replace these with real implementations when available.
const OfflineStatus: React.FC = () => (
  <div className="mb-6 p-4 bg-[#0b1220] rounded">Offline status component placeholder</div>
);

const StorageUsage: React.FC = () => (
  <div className="mb-6 p-4 bg-[#0b1220] rounded">Storage usage component placeholder</div>
);

const DownloadManager: React.FC = () => (
  <div className="mb-6 p-4 bg-[#0b1220] rounded">Download manager component placeholder</div>
);

export default function OfflineMapsPage() {
  return (
    <div className="min-h-screen bg-[#020617] text-white">

      <div className="max-w-7xl mx-auto px-6 py-10">

        <OfflineStatus />

        <StorageUsage />

        <DownloadManager />

      </div>

    </div>
  );
}