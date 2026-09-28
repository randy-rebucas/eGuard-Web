import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "eGuard: Parental Controls",
    short_name: "eGuard",
    description: "Set screen time, bedtime and app rules on your child's devices, and see each one verified.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#F6FAFF",
    theme_color: "#1560DB",
    icons: [
      { src: "/brand/logo-mark-512.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
