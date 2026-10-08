"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { IconCloud } from "@/components/ui/icon-cloud";

const services = [
  { name: "Army", image: "/services/army.svg" },
  { name: "Marine Corps", image: "/services/marine-corps.svg" },
  { name: "Navy", image: "/services/navy.svg" },
  { name: "Air Force", image: "/services/air-force.svg" },
  { name: "Space Force", image: "/services/space-force.svg" },
  { name: "Coast Guard", image: "/services/coast-guard.svg" },
];
const images = services.map(service => service.image);

export function ServiceCloud() {
  const [reducedMotion, setReducedMotion] = useState(true);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return <div className="service-cloud">
    {reducedMotion ? <div className="service-cloud-static">
      {services.map(service => <Image key={service.name} src={service.image} alt={service.name} width={56} height={56} unoptimized />)}
    </div> : <>
      <IconCloud images={images} showControl={false} />
      <span className="sr-only">U.S. service branches: {services.map(service => service.name).join(", ")}.</span>
    </>}
  </div>;
}
