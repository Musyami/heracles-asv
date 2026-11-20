import { Suspense, use } from 'react';
import ReplayView from '@/components/Runs/ReplayView';

interface ReplayPageProps {
  params: Promise<{ id: string }>;
}

function ReplayContent({ params }: { params: Promise<{ id: string }> }) {
  const resolved = use(params);
  return <ReplayView runId={resolved.id} />;
}

export default function ReplayPage({ params }: ReplayPageProps) {
  return (
    <Suspense fallback={<main style={{ padding: '40px', textAlign: 'center' }}>Memuat pemutar replay sesi...</main>}>
      <ReplayContent params={params} />
    </Suspense>
  );
}
