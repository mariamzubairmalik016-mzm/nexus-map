import { useEffect, useState } from "react";

// cast import.meta to any to access env in environments where ImportMeta types aren't defined
const API_URL = (import.meta as any)?.env?.VITE_API_URL || "http://localhost:5000/api";

type HealthData = {
  service: string;
  status: string;
  database: string;
  timestamp: string;
};

const BackendTest = () => {
  const [data, setData] = useState<HealthData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then(async (response) => {
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Backend connection failed.");
        }

        setData(result);
      })
      .catch((requestError: unknown) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Backend connection failed.",
        );
      });
  }, []);

  return (
    <section className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4">
      <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-center">
        <h1 className="text-3xl font-bold">
          Backend Connection Test
        </h1>

        {!data && !error && (
          <p className="mt-5 text-slate-400">
            Connecting...
          </p>
        )}

        {error && (
          <p className="mt-5 rounded-xl bg-red-400/10 p-4 text-red-300">
            {error}
          </p>
        )}

        {data && (
          <div className="mt-6 space-y-3 text-left">
            <p>
              Service: <strong>{data.service}</strong>
            </p>

            <p>
              Status:{" "}
              <strong className="text-emerald-400">
                {data.status}
              </strong>
            </p>

            <p>
              Database: <strong>{data.database}</strong>
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

export default BackendTest;