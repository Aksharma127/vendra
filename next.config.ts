import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Keep recently visited dynamic pages in the client router cache for 30s
    // (the pre-v15 default), so hopping between tabs and back is instant.
    // Safe here: every mutation already calls revalidatePath / router.refresh,
    // which invalidates this cache immediately.
    staleTimes: { dynamic: 30 },
  },
};

export default nextConfig;
