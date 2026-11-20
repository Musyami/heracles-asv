import { Suspense } from 'react';
import RunsListView from '@/components/Runs/RunsListView';

export const metadata = {
  title: 'Riwayat Run Misi — ASV Dashboard Barunastra ITS',
  description: 'Daftar riwayat sesi uji coba dan pemantauan misi kapal otonom Heracles ASV.',
};

export default function RunsPage() {
  return (
    <Suspense fallback={<main style={{ padding: '40px', textAlign: 'center' }}>Memuat riwayat run...</main>}>
      <RunsListView />
    </Suspense>
  );
}
