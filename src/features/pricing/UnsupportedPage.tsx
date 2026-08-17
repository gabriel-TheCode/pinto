import { EmptyState } from '@/components/Feedback';
import { useStore } from '@/app/store';
import { Button } from '@/components/Button';

export function UnsupportedPage() {
  const refreshContext = useStore((state) => state.refreshContext);

  return (
    <div className="flex h-full items-center justify-center bg-white">
      <EmptyState
        icon={<span className="text-3xl">◎</span>}
        title="Open a pricing page"
        body={
          <>
            Pinto works on Play Console monetisation pages — subscriptions, one-time products and
            app pricing. Navigate to one of those and it will pick up the product automatically.
          </>
        }
        action={
          <Button size="sm" onClick={() => void refreshContext()}>
            Check again
          </Button>
        }
      />
    </div>
  );
}
