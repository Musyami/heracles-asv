import { Suspense } from 'react';
import DashboardView from '@/components/DashboardView';

export default function Home() {
  return (
    <Suspense fallback={<main style={{ padding: '40px', textAlign: 'center' }}>Memuat dashboard ASV...</main>}>
      <DashboardView />
    </Suspense>
  );
}
