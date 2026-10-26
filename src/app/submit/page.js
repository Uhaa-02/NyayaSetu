import PublicHeader from '@/components/PublicHeader';
import ComplaintForm from '@/components/ComplaintForm';

export const metadata = { title: 'File a complaint' };

export default function SubmitPage() {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="mx-auto mb-8 max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-navy-900">File a complaint</h1>
          <p className="mt-2 text-slate-600">
            Tell us what went wrong. NyayaSetu will triage it, send it to the right AICTE bureau and give you an ID to
            track progress.
          </p>
        </div>
        <ComplaintForm />
      </main>
    </>
  );
}
