import React, { useState, useEffect } from 'react';
import { useStore } from '@/state/store';
import { useQuery, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fetchStaff } from '@/api/client';
import { Sidebar } from '@/components/Sidebar';
import { Dashboard } from '@/components/Dashboard';
import { TenantHub } from '@/components/TenantHub';
import { KnowledgeBase } from '@/components/KnowledgeBase';
import { StaffPortal } from '@/components/StaffPortal';
import { CitationDrawer, MOCK_CITATIONS } from '@/components/CitationDrawer';
import { HitlOverlay } from '@/components/HitlOverlay';

// 1. Initialize TanStack Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

/**
 * Shell component executing the main layout of Operio, routing controllers,
 * and global citation/HITL overlays.
 * 
 * @returns The rendered App React element.
 */
const AppContent: React.FC = () => {
  const activeView = useStore((state) => state.activeView);
  const activeHitlTicket = useStore((state) => state.activeHitlTicket);
  
  const setView = useStore((state) => state.setView);
  const setHitlTicket = useStore((state) => state.setHitlTicket);

  // State to track citation drawer references
  const [citationRef, setCitationRef] = useState<string | null>(null);

  // 2. Fetch staff availability lists globally for HITL assignment drop-down
  const { data: staff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: fetchStaff,
  });

  // 3. Simple Hash Routing Controller
  useEffect(() => {
    const syncRoute = () => {
      const hash = window.location.hash.substring(1);
      if (['dashboard', 'tenanthub', 'knowledge', 'staff'].includes(hash)) {
        setView(hash as 'dashboard' | 'tenanthub' | 'knowledge' | 'staff');
      } else {
        // Fallback default
        window.location.hash = 'dashboard';
      }
    };

    window.addEventListener('hashchange', syncRoute);
    // Initial sync
    syncRoute();

    return () => {
      window.removeEventListener('hashchange', syncRoute);
    };
  }, [setView]);

  return (
    <>
      {/* Sidebar Nav */}
      <Sidebar />

      {/* Main Work Center */}
      <main className="main-content">
        {activeView === 'dashboard' && (
          <div className="view-panel active-view" id="view-dashboard">
            <header className="main-header">
              <div className="header-titles">
                <span className="label-md uppercase tracking text-accent">Operations Command</span>
                <h1 className="display-lg">The Operational Ledger</h1>
              </div>
              <div className="header-actions">
                <a href="http://localhost:6006" target="_blank" rel="noreferrer" className="btn btn-secondary">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>monitoring</span>
                  Arize Phoenix traces
                </a>
              </div>
            </header>
            <Dashboard onReviewTicket={setHitlTicket} />
          </div>
        )}

        {activeView === 'tenanthub' && (
          <div className="view-panel active-view" id="view-tenanthub">
            <header className="main-header">
              <div className="header-titles">
                <span className="label-md uppercase tracking text-accent">Tenant Service Portal</span>
                <h1 className="display-lg">Tenant Interaction Hub</h1>
              </div>
              <div className="tenant-selector-container">
                <label htmlFor="tenant-select" className="label-sm muted uppercase">Active Tenant:</label>
                <select 
                  id="tenant-select" 
                  className="tenant-select-dropdown"
                  value={useStore.getState().currentTenant}
                  onChange={(e) => useStore.getState().setTenant(e.target.value)}
                >
                  <option value="tenant_001">Nike Store (Unit 104 - Sector B)</option>
                  <option value="tenant_002">Adidas Store (Unit 105 - Sector B)</option>
                  <option value="tenant_003">Zara Store (Unit 106 - Sector A)</option>
                  <option value="tenant_004">Puma Store (Unit 107 - Sector B)</option>
                  <option value="tenant_005">Apple Store (Unit 108 - Sector A)</option>
                </select>
              </div>
            </header>
            <TenantHub onCitationRequest={setCitationRef} />
          </div>
        )}

        {activeView === 'knowledge' && (
          <div className="view-panel active-view" id="view-knowledge">
            <header className="main-header">
              <div className="header-titles">
                <span className="label-md uppercase tracking text-accent">Document Verification</span>
                <h1 className="display-lg">RAG Knowledge Inspector</h1>
              </div>
            </header>
            <KnowledgeBase />
          </div>
        )}

        {activeView === 'staff' && (
          <div className="view-panel active-view" id="view-staff">
            <header className="main-header">
              <div className="header-titles">
                <span className="label-md uppercase tracking text-accent">Staff & Vendor Management</span>
                <h1 className="display-lg">Certified Technicians & Scheduling</h1>
              </div>
            </header>
            <StaffPortal />
          </div>
        )}
      </main>

      {/* Global Overlays */}
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
 * @returns The final query-initialized React element tree.
 */
export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
};
