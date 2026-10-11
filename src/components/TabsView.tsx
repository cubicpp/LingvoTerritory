import { Suspense } from "react";
import { useAppStore } from "@/store/useAppStore";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingScreen } from "@/components/LoadingScreen";

interface TabsViewProps {
  children: Record<string, React.ComponentType>;
}

export function TabsView({ children }: TabsViewProps) {
  const tabView = useAppStore((s) => s.tabView);
  const ActiveChild = children[tabView];

  return (
    <Suspense fallback={<LoadingScreen />}>
      <ErrorBoundary>
        {ActiveChild ? <ActiveChild /> : null}
      </ErrorBoundary>
    </Suspense>
  );
}
