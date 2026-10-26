import ComplaintForm from '@/components/ComplaintForm';
import { PageHeader } from '@/components/ui';
import { getSession } from '@/lib/auth';

export const metadata = { title: 'New complaint' };
export const dynamic = 'force-dynamic';

export default function NewComplaintPage() {
  const s = getSession();
  const viewer = s ? { role: s.role, bureau: s.bureau } : null;
  return (
    <>
      <PageHeader
        title="Register a complaint"
        subtitle="Enter a complaint received by phone, post or e-mail. It is triaged and routed automatically."
      />
      <ComplaintForm internal viewer={viewer} />
    </>
  );
}
