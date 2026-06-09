import React, { useState } from 'react';
import { useStore } from '@/state/store';
import { useQuery } from '@tanstack/react-query';
import { searchKnowledgeBase } from '@/api/client';
import { buildSearchSnippet, highlightKeywords } from '@/utils/markdown';

/**
 * Component managing the Knowledge RAG Explorer page.
 * 
 * @returns The rendered KnowledgeBase React element.
 */
export const KnowledgeBase: React.FC = () => {
  const rag = useStore((state) => state.rag);
  const updateRagConfig = useStore((state) => state.updateRagConfig);

  const [searchVal, setSearchVal] = useState<string>(rag.query);
  const [submittedQuery, setSubmittedQuery] = useState<string>(rag.query);

  // 1. Fetch RAG hits using React Query, automatically triggered when filters or submitted query updates
  const { data: results = [], isFetching, isError } = useQuery({
    queryKey: ['ragHits', rag.target, rag.leaseId, rag.model, submittedQuery],
    queryFn: () => searchKnowledgeBase(submittedQuery, rag.target, rag.leaseId, rag.model),
    enabled: submittedQuery.trim().length > 0,
  });

  const handleSearchSubmit = () => {
    const query = searchVal.trim();
    updateRagConfig({ query });
    setSubmittedQuery(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearchSubmit();
    }
  };

  const handleTargetChange = (target: 'all' | 'leases' | 'manuals') => {
    updateRagConfig({ target });
    // Filter changes auto-trigger search if there is a query
    if (searchVal.trim().length > 0) {
      setSubmittedQuery(searchVal.trim());
    }
  };

  const handleLeaseChange = (leaseId: string) => {
    updateRagConfig({ leaseId });
    if (searchVal.trim().length > 0) {
      setSubmittedQuery(searchVal.trim());
    }
  };

  const handleModelChange = (model: string) => {
    updateRagConfig({ model });
    if (searchVal.trim().length > 0) {
      setSubmittedQuery(searchVal.trim());
    }
  };

  return (
    <div className="rag-layout">
      {/* RAG Query Console */}
      <section className="panel query-panel">
        <h2 className="panel-title">
          <span className="material-symbols-outlined">database_search</span>
          Elasticsearch Query Console
        </h2>
        <div className="rag-form">
          {/* 1. Search Box (Top) */}
          <div className="form-row">
            <label className="label-sm uppercase muted" htmlFor="rag-search-input">Search Query</label>
            <input 
              type="text" 
              id="rag-search-input" 
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search across all leases & manuals (e.g. HVAC, error, repair)..." 
            />
            <p className="label-xs muted mt-1">
              <strong>Search Tip:</strong> Elasticsearch disables fuzziness for short terms like <code>AC</code> (length &le; 2) under <code>"fuzziness": "AUTO"</code>, requiring exact matches. Try <code>HVAC</code>, <code>Air Conditioning</code>, <code>thermostat</code>, or <code>compressor</code>.
            </p>
          </div>

          {/* 2. Search Button */}
          <button className="btn btn-primary rag-submit-btn" id="btn-run-rag" onClick={handleSearchSubmit}>
            Run RAG Search
          </button>

          <div className="rag-divider" />

          <h3 className="rag-section-label">Refine Search Results</h3>

          {/* 3. Document Type Filter */}
          <div className="form-row">
            <label className="label-sm uppercase muted">Document Type</label>
            <div className="rag-targets">
              <button 
                className={`rag-target-btn ${rag.target === 'all' ? 'active' : ''}`} 
                id="rag-target-all"
                onClick={() => handleTargetChange('all')}
              >
                <span className="material-symbols-outlined">description</span>
                All Docs
              </button>
              <button 
                className={`rag-target-btn ${rag.target === 'leases' ? 'active' : ''}`} 
                id="rag-target-leases"
                onClick={() => handleTargetChange('leases')}
              >
                <span className="material-symbols-outlined">gavel</span>
                Leases
              </button>
              <button 
                className={`rag-target-btn ${rag.target === 'manuals' ? 'active' : ''}`} 
                id="rag-target-manuals"
                onClick={() => handleTargetChange('manuals')}
              >
                <span className="material-symbols-outlined">manufacturing</span>
                Manuals
              </button>
            </div>
          </div>

          {/* 4. Lease Isolation Parameters */}
          {(rag.target === 'all' || rag.target === 'leases') && (
            <div className="form-row" id="rag-params-leases">
              <label className="label-sm uppercase muted" htmlFor="rag-lease-id">Lease ID Filter</label>
              <select 
                id="rag-lease-id" 
                className="tenant-select-dropdown"
                value={rag.leaseId}
                onChange={(e) => handleLeaseChange(e.target.value)}
              >
                <option value="all">All Leases (Global Search)</option>
                <option value="lease_nike_104">lease_nike_104 (Nike Store)</option>
                <option value="lease_adidas_105">lease_adidas_105 (Adidas Store)</option>
                <option value="lease_zara_106">lease_zara_106 (Zara Store)</option>
                <option value="lease_puma_107">lease_puma_107 (Puma Store)</option>
                <option value="lease_apple_108">lease_apple_108 (Apple Store)</option>
              </select>
              <p className="label-xs text-success mt-1">Tenant Isolation Active: Searches restricted to this Lease ID.</p>
            </div>
          )}

          {/* 5. Manual Parameters */}
          {(rag.target === 'all' || rag.target === 'manuals') && (
            <div className="form-row" id="rag-params-manuals">
              <label className="label-sm uppercase muted" htmlFor="rag-equipment-model">Equipment Model</label>
              <select 
                id="rag-equipment-model" 
                className="tenant-select-dropdown"
                value={rag.model}
                onChange={(e) => handleModelChange(e.target.value)}
              >
                <option value="all">All Equipment Models (Global Search)</option>
                <option value="Carrier Model-50TJ">Carrier Model-50TJ (HVAC)</option>
                <option value="Otis Model-NPE">Otis Model-NPE (Escalator)</option>
                <option value="Schindler Model-9300">Schindler Model-9300 (Elevator)</option>
                <option value="Rheem Model-Classic">Rheem Model-Classic (HVAC)</option>
                <option value="Honeywell Model-T6">Honeywell Model-T6 (Thermostat)</option>
                <option value="McQuay Model-WSC">McQuay Model-WSC (Chiller)</option>
                <option value="Culligan Model-HE">Culligan Model-HE (Softener)</option>
                <option value="Lutron Model-Quantum">Lutron Model-Quantum (Lighting)</option>
                <option value="Kone Model-TravelMaster">Kone Model-TravelMaster (Escalator)</option>
                <option value="Generac Model-Protector">Generac Model-Protector (Generator)</option>
              </select>
            </div>
          )}
        </div>
      </section>

      {/* RAG Results */}
      <section className="panel results-panel">
        <h2 className="panel-title">
          <span className="material-symbols-outlined">find_in_page</span>
          RAG Retrieval Output
        </h2>
        <div className="rag-results-list" id="rag-results-container">
          {isFetching ? (
            <div className="loading-state">Executing RAG search target index...</div>
          ) : isError ? (
            <div className="rag-error">Search execution failed. Make sure the database indices are seeded.</div>
          ) : results.length === 0 ? (
            <div className="rag-empty">
              <p>Enter a query in the console to inspect Elasticsearch vector and keyword matches.</p>
            </div>
          ) : (
            results.map((hit) => {
              const matchPct = Math.min(Math.round(hit.score * 100), 100);
              const isLease = hit.type === 'leases';
              const badgeText = isLease ? 'Lease Clause' : 'Equipment Manual';
              const badgeClass = isLease ? 'chip-success' : 'chip-warning';
              const metadataText = isLease ? `Lease ID: ${hit.leaseId}` : `Model: ${hit.equipmentModel}`;

              const highlightedTitle = highlightKeywords(hit.title, submittedQuery);
              const contextualSnippet = buildSearchSnippet(hit.content, submittedQuery, 5);
              const highlightedContent = highlightKeywords(contextualSnippet, submittedQuery);

              return (
                <div key={hit.id} className="rag-hit card">
                  <div className="hit-header rag-hit-header">
                    <div className="rag-hit-topline">
                      <span className={`chip ${badgeClass} rag-hit-badge`}>{badgeText}</span>
                      <span className="hit-score badge-result rag-hit-score">Match relevance: {matchPct}%</span>
                    </div>
                    <h4 
                      className="hit-title font-mono rag-hit-title" 
                      dangerouslySetInnerHTML={{ __html: highlightedTitle }}
                    />
                    <span className="muted rag-hit-meta">{metadataText}</span>
                  </div>
                  <div 
                    className="hit-content body-sm font-mono rag-hit-content" 
                    dangerouslySetInnerHTML={{ __html: highlightedContent }}
                  />
                  {hit.pdfUrl && (
                    <div className="rag-hit-footer">
                      <a 
                        href={hit.pdfUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="btn btn-secondary btn-xs rag-hit-link" 
                      >
                        <svg className="rag-hit-link-icon" viewBox="0 0 24 24">
                          <path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m-9 14H8.5v-1.5H7V14h1.5v-.75H7V12h3v5m4 0h-3V12h3c.55 0 1 .45 1 1v3c0 .55-.45 1-1 1m4-3c0 .55-.45 1-1 1h-1.5v1H18v-1.5h-1.5V14H18v-2h-3v5h1v-2.25h1.5V13h-1.5v-.75h1.5V12h1v2c0 .55-.45 1-1 1m-3-1.5h-1v2h1v-2Z"/>
                        </svg>
                        View Source PDF
                      </a>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};
