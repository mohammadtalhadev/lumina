import Link from 'next/link';
import { UserX } from 'lucide-react';
import { EmptyState, PrimaryButton } from '@/components/ui';

/** Honest 404 for unknown lead ids — no fake profile, no crash. */
export default function LeadNotFound() {
  return (
    <EmptyState
      icon={<UserX className="h-6 w-6" aria-hidden />}
      title="Lead not found"
      detail="This lead doesn't exist or was deleted. Check the Kanban board for the current list."
      action={
        <Link href="/leads">
          <PrimaryButton>Back to Kanban</PrimaryButton>
        </Link>
      }
    />
  );
}
