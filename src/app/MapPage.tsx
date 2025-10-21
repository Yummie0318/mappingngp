'use client';

import dynamic from 'next/dynamic';

// ✅ Dynamically load MapView only in the browser
const MapView = dynamic(() => import('@/app/components/MapView'), {
  ssr: false,
});

export default function MapPage() {
  return <MapView />;
}
