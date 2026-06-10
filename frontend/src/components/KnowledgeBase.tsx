import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '@/state/store';
import { useQuery } from '@tanstack/react-query';
import { fetchSourceDocument, searchKnowledgeBase } from '@/api/client';
import { RAGHit, SourceDocument } from '@/types';
import { buildSearchSnippet, highlightKeywords, parseDocumentMarkdown } from '@/utils/markdown';

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
  const [sourceDocument, setSourceDocument] = useState<SourceDocument | null>(null);
  const [sourceLoading, setSourceLoading] = useState<boolean>(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const sourceDialogRef = useRef<HTMLDialogElement>(null);

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

  const isSourceDialogOpen = sourceDocument !== null || sourceLoading || sourceError !== null;

  useEffect(() => {
    const dialog = sourceDialogRef.current;
    if (!dialog) return;

    if (isSourceDialogOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
      return;
    }

    if (dialog.open) {
      dialog.close();
    }
  }, [isSourceDialogOpen]);

  const handleCloseSourceDialog = () => {
    setSourceDocument(null);
    setSourceLoading(false);
    setSourceError(null);
  };

  const handleSourceBackdropClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = sourceDialogRef.current;
    if (event.target !== dialog) return;

    const rect = dialog.getBoundingClientRect();
    const isOutside = (
      event.clientY < rect.top ||
      event.clientY > rect.bottom ||
      event.clientX < rect.left ||
      event.clientX > rect.right
    );

    if (isOutside) {
      handleCloseSourceDialog();
    }
  };

  const handleInspectSource = async (hit: RAGHit) => {
    setSourceLoading(true);
    setSourceError(null);
    setSourceDocument(null);

    try {
      const document = await fetchSourceDocument(hit.type, hit.leaseId, hit.equipmentModel);
      setSourceDocument(document);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Failed to load the full source document.';
      setSourceError(message);
    } finally {
      setSourceLoading(false);
    }
  };

  return (
    <>
      <div className="rag-layout">
        {/* RAG Query Console */}
        <section className="panel query-panel">
          <h2 className="panel-title">
            <span className="material-symbols-outlined">database_search</span>
            Atlas Search Query Console
          </h2>
          <div className="rag-form">
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
                <strong>Search Tip:</strong> Atlas Search utilizes semantic vector embeddings and compound keyword phrase matching. Try <code>HVAC</code>, <code>Air Conditioning</code>, <code>thermostat</code>, or <code>compressor</code>.
              </p>
            </div>

            <button className="btn btn-primary rag-submit-btn" id="btn-run-rag" onClick={handleSearchSubmit}>
              Run RAG Search
            </button>

            <div className="rag-divider" />

            <h3 className="rag-section-label">Refine Search Results</h3>

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
                <p>Enter a query in the console to inspect Atlas Search vector and keyword matches.</p>
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
                    <div className="rag-hit-footer">
                      <button
                        type="button"
                        className="btn btn-secondary btn-xs rag-hit-link"
                        onClick={() => handleInspectSource(hit)}
                      >
                        <svg className="rag-hit-link-icon" viewBox="0 0 24 24">
                          <path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m-9 14H8.5v-1.5H7V14h1.5v-.75H7V12h3v5m4 0h-3V12h3c.55 0 1 .45 1 1v3c0 .55-.45 1-1 1m4-3c0 .55-.45 1-1 1h-1.5v1H18v-1.5h-1.5V14H18v-2h-3v5h1v-2.25h1.5V13h-1.5v-.75h1.5V12h1v2c0 .55-.45 1-1 1m-3-1.5h-1v2h1v-2Z"/>
                        </svg>
                        {isLease ? 'Inspect Full Lease' : 'Inspect Full Manual'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      <dialog
        className="dialog-overlay"
        ref={sourceDialogRef}
        onClick={handleSourceBackdropClick}
        aria-labelledby="source-document-title"
      >
        <div className="dialog-card source-document-card">
          <div className="dialog-header">
            <div className="dialog-title-group">
              <span className="dialog-kicker">Source inspector</span>
              <h3 className="headline-sm" id="source-document-title">
                {sourceDocument?.title || 'Full source document'}
              </h3>
            </div>
            <button className="btn-close" type="button" onClick={handleCloseSourceDialog}>
              ×
            </button>
          </div>

          <div className="dialog-body source-document-body">
            {sourceLoading ? (
              <div className="dialog-loading-state">
                <div className="spinner-inline dialog-loading-spinner" />
                <p className="body-sm">Loading the complete source document...</p>
              </div>
            ) : sourceError ? (
              <div className="empty-state text-danger">{sourceError}</div>
            ) : sourceDocument ? (
              <>
                <div className="source-document-meta">
                  <span className="status-pill neutral">
                    {sourceDocument.type === 'leases' ? sourceDocument.leaseId : sourceDocument.equipmentModel}
                  </span>
                  {sourceDocument.pdfUrl ? (
                    <a
                      href={sourceDocument.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary btn-xs"
                    >
                      Open generated PDF
                    </a>
                  ) : null}
                </div>
                <div
                  className="source-document-content"
                  dangerouslySetInnerHTML={{ __html: parseDocumentMarkdown(sourceDocument.content) }}
                />
              </>
            ) : null}
          </div>
        </div>
      </dialog>
    </>
  );
};
