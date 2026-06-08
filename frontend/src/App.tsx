import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { fetchStaff } from '@/api/client';
import { CitationDrawer, MOCK_CITATIONS } from '@/components/CitationDrawer';
import { Dashboard } from '@/components/Dashboard';
import { HitlOverlay } from '@/components/HitlOverlay';
import { IntakeStudio } from '@/components/IntakeStudio';
import { KnowledgeBase } from '@/components/KnowledgeBase';
import { Sidebar } from '@/components/Sidebar';
import { StaffPortal } from '@/components/StaffPortal';
import { TenantHub } from '@/components/TenantHub';
import { useStore } from '@/state/store';
import { AppView } from '@/types';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

interface ViewHeaderProps {
  icon: string;
  kicker: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}

/**
 * Shared header used across route workspaces.
 *
 * @param props Header content and optional actions.
 * @returns The rendered header block.
 */
const ViewHeader: React.FC<ViewHeaderProps> = ({
  icon,
  kicker,
  title,
  description,
  actions,
}) => (
  <header className="main-header">
    <div className="header-stack">
      <div className="header-icon-badge">
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <div className="header-titles">
        <span className="label-md uppercase tracking text-accent">{kicker}</span>
        <h1 className="display-lg">{title}</h1>
        <p className="header-description">{description}</p>
      </div>
    </div>
    {actions ? <div className="header-actions">{actions}</div> : null}
  </header>
);

/**
 * Shared tenant selector used by intake-focused routes.
 *
 * @returns The rendered tenant selector.
 */
const TenantSelector: React.FC = () => {
  const currentTenant = useStore((state) => state.currentTenant);
  const setTenant = useStore((state) => state.setTenant);

  return (
    <div className="tenant-selector-container">
      <label htmlFor="tenant-select" className="label-sm muted uppercase">
        Active tenant
      </label>
      <div className="select-shell">
        <select
          id="tenant-select"
          className="tenant-select-dropdown"
          value={currentTenant}
          onChange={(event) => setTenant(event.target.value)}
        >
          <option value="tenant_001">Nike Store (Unit 104 - Sector B)</option>
          <option value="tenant_002">Adidas Store (Unit 105 - Sector B)</option>
          <option value="tenant_003">Zara Store (Unit 106 - Sector A)</option>
          <option value="tenant_004">Puma Store (Unit 107 - Sector B)</option>
          <option value="tenant_005">Apple Store (Unit 108 - Sector A)</option>
        </select>
        <span className="material-symbols-outlined select-shell-icon">expand_more</span>
      </div>
    </div>
  );
};

/**
 * Shell component executing the main layout, route control, and global overlays.
 *
 * @returns The rendered application content.
 */
const AppContent: React.FC = () => {
  const activeView = useStore((state) => state.activeView);
  const activeHitlTicket = useStore((state) => state.activeHitlTicket);
  const setView = useStore((state) => state.setView);
  const setHitlTicket = useStore((state) => state.setHitlTicket);

  const [citationRef, setCitationRef] = React.useState<string | null>(null);
  const { data: staff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: fetchStaff,
  });

  useEffect(() => {
    const allowedViews: AppView[] = ['dashboard', 'tenanthub', 'intake', 'knowledge', 'staff'];

    const syncRoute = () => {
      const hash = window.location.hash.substring(1);
      if (allowedViews.includes(hash as AppView)) {
        setView(hash as AppView);
        return;
      }

      window.location.hash = 'dashboard';
    };

    window.addEventListener('hashchange', syncRoute);
    syncRoute();

    return () => {
      window.removeEventListener('hashchange', syncRoute);
    };
  }, [setView]);

  return (
    <>
      <Sidebar />

      <main className="main-content">
        {activeView === 'dashboard' && (
          <div className="view-panel active-view" id="view-dashboard">
            <ViewHeader
              icon="space_dashboard"
              kicker="Operations Command"
              title="The Operational Ledger"
              description="Monitor queue health, landlord approvals, and field readiness from a single operations surface."
              actions={(
                <a href="http://localhost:6006" target="_blank" rel="noreferrer" className="btn btn-secondary">
                  <span className="material-symbols-outlined">monitoring</span>
                  Arize Phoenix traces
                </a>
              )}
            />
            <Dashboard onReviewTicket={setHitlTicket} />
          </div>
        )}

        {activeView === 'tenanthub' && (
          <div className="view-panel active-view" id="view-tenanthub">
            <ViewHeader
              icon="forum"
              kicker="Probabilistic Intake"
              title="Conversational Tenant Flow"
              description="Use the agent when the tenant needs guidance, diagnosis, or flexible back-and-forth before a work order is shaped."
              actions={<TenantSelector />}
            />
            <TenantHub onCitationRequest={setCitationRef} />
          </div>
        )}

        {activeView === 'intake' && (
          <div className="view-panel active-view" id="view-intake">
            <ViewHeader
              icon="assignment"
              kicker="Deterministic Intake"
              title="Structured Work Order Intake"
              description="Capture known facts explicitly, then generate a cleaner landlord approval brief with less conversational ambiguity."
              actions={<TenantSelector />}
            />
            <IntakeStudio />
          </div>
        )}

        {activeView === 'knowledge' && (
          <div className="view-panel active-view" id="view-knowledge">
            <ViewHeader
              icon="search_insights"
              kicker="Evidence & Retrieval"
              title="Lease and Manual Explorer"
              description="Inspect the raw evidence layer behind liability calls, troubleshooting guidance, and retrieval confidence."
            />
            <KnowledgeBase />
          </div>
        )}

        {activeView === 'staff' && (
          <div className="view-panel active-view" id="view-staff">
            <ViewHeader
              icon="badge"
              kicker="Field Operations"
              title="Technicians and Vendor Readiness"
              description="Track technician availability, tune field profiles, and review the operational context that triggered each assignment."
            />
            <StaffPortal />
          </div>
        )}
      </main>

      <CitationDrawer
        reference={citationRef}
        onReferenceChange={setCitationRef}
        onClose={() => setCitationRef(null)}
      />

      <HitlOverlay
        ticket={activeHitlTicket}
        staff={staff}
        citations={MOCK_CITATIONS}
        onCitationRequest={setCitationRef}
        onClose={() => setHitlTicket(null)}
      />
    </>
  );
};

/**
 * Root component wrapping the application content with React Query providers.
 *
 * @returns The final query-initialized application tree.
 */
export const App: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <AppContent />
  </QueryClientProvider>
);
