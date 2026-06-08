import { AppState } from '@/types';
import { qs, on } from '@/utils/dom';
import { dispatch, updateRagConfig, setRagResults, getState } from '@/state/store';
import { searchKnowledgeBase } from '@/api/client';
import { highlightKeywords } from '@/utils/markdown';

/**
 * Component managing the Knowledge RAG Explorer page.
 */
export class KnowledgeBase {
  private btnTargetAll: HTMLButtonElement;
  private btnTargetLeases: HTMLButtonElement;
  private btnTargetManuals: HTMLButtonElement;

  private paramsLeases: HTMLElement;
  private paramsManuals: HTMLElement;

  private leaseSelect: HTMLSelectElement;
  private modelSelect: HTMLSelectElement;
  private searchInput: HTMLInputElement;
  private btnRun: HTMLButtonElement;
  private resultsContainer: HTMLElement;

  /**
   * Constructs the KnowledgeBase component.
   */
  constructor() {
    this.btnTargetAll = qs<HTMLButtonElement>('#rag-target-all');
    this.btnTargetLeases = qs<HTMLButtonElement>('#rag-target-leases');
    this.btnTargetManuals = qs<HTMLButtonElement>('#rag-target-manuals');

    this.paramsLeases = qs('#rag-params-leases');
    this.paramsManuals = qs('#rag-params-manuals');

    this.leaseSelect = qs<HTMLSelectElement>('#rag-lease-id');
    this.modelSelect = qs<HTMLSelectElement>('#rag-equipment-model');
    this.searchInput = qs<HTMLInputElement>('#rag-search-input');
    this.btnRun = qs<HTMLButtonElement>('#btn-run-rag');
    this.resultsContainer = qs('#rag-results-container');

    this.bindEvents();
  }

  /**
   * Binds UI filter selectors and search consoles events.
   */
  private bindEvents(): void {
    on(this.btnTargetAll, 'click', () => {
      dispatch(updateRagConfig({ target: 'all' }));
      this.triggerSearch();
    });

    on(this.btnTargetLeases, 'click', () => {
      dispatch(updateRagConfig({ target: 'leases' }));
      this.triggerSearch();
    });

    on(this.btnTargetManuals, 'click', () => {
      dispatch(updateRagConfig({ target: 'manuals' }));
      this.triggerSearch();
    });

    on(this.leaseSelect, 'change', () => {
      dispatch(updateRagConfig({ leaseId: this.leaseSelect.value }));
      this.triggerSearch();
    });

    on(this.modelSelect, 'change', () => {
      dispatch(updateRagConfig({ model: this.modelSelect.value }));
      this.triggerSearch();
    });

    on(this.searchInput, 'keydown', (e) => {
      if (e.key === 'Enter') {
        this.triggerSearch();
      }
    });

    on(this.btnRun, 'click', () => {
      this.triggerSearch();
    });
  }

  /**
   * Executes RAG index query search on Elasticsearch.
   */
  private async triggerSearch(): Promise<void> {
    const query = this.searchInput.value.trim();
    dispatch(updateRagConfig({ query }));

    if (!query) return;

    dispatch((s) => ({ ...s, rag: { ...s.rag, loading: true } }));

    try {
      const { rag } = getState();

      const results = await searchKnowledgeBase(
        rag.query,
        rag.target,
        rag.leaseId,
        rag.model
      );

      dispatch(setRagResults(results));
    } catch (e) {
      console.error(e);
      dispatch((s) => ({ ...s, rag: { ...s.rag, loading: false, results: [] } }));
      this.resultsContainer.innerHTML = `<div class="rag-error">Search execution failed. Make sure the database indices are seeded.</div>`;
    }
  }

  /**
   * Re-renders configurations, filter menus and document match hits.
   * 
   * @param state The current application state.
   */
  public render(state: AppState): void {
    // 1. Sync target search tab classes
    [this.btnTargetAll, this.btnTargetLeases, this.btnTargetManuals].forEach(btn => {
      btn.classList.remove('active');
    });

    if (state.rag.target === 'all') {
      this.btnTargetAll.classList.add('active');
      this.paramsLeases.classList.remove('hidden');
      this.paramsManuals.classList.remove('hidden');
    } else if (state.rag.target === 'leases') {
      this.btnTargetLeases.classList.add('active');
      this.paramsLeases.classList.remove('hidden');
      this.paramsManuals.classList.add('hidden');
    } else if (state.rag.target === 'manuals') {
      this.btnTargetManuals.classList.add('active');
      this.paramsManuals.classList.remove('hidden');
      this.paramsLeases.classList.add('hidden');
    }

    // 2. Sync input field values
    if (this.leaseSelect.value !== state.rag.leaseId) {
      this.leaseSelect.value = state.rag.leaseId;
    }
    if (this.modelSelect.value !== state.rag.model) {
      this.modelSelect.value = state.rag.model;
    }
    if (this.searchInput.value !== state.rag.query) {
      this.searchInput.value = state.rag.query;
    }

    // 3. Render matching document hit results
    if (state.rag.loading) {
      this.resultsContainer.innerHTML = `<div class="loading-state">Executing RAG search target index...</div>`;
      return;
    }

    if (state.rag.results.length === 0) {
      this.resultsContainer.innerHTML = `
        <div class="rag-empty">
          <p>Enter a query in the console to inspect Elasticsearch vector and keyword matches.</p>
        </div>
      `;
      return;
    }

    this.resultsContainer.innerHTML = '';

    state.rag.results.forEach(hit => {
      const hitDiv = document.createElement('div');
      hitDiv.className = 'rag-hit card';
      
      const matchPct = Math.min(Math.round(hit.score * 100), 100);

      let badgeText = 'Lease Clause';
      let badgeClass = 'chip-success';
      let metadataText = `Lease ID: ${hit.leaseId}`;
      if (hit.type === 'manuals') {
        badgeText = 'Equipment Manual';
        badgeClass = 'chip-warning';
        metadataText = `Model: ${hit.equipmentModel}`;
      }

      const pdfButton = hit.pdfUrl ? `
        <div style="margin-top: 10px; border-top: 1px solid var(--brand-border); padding-top: 8px; display: flex; justify-content: flex-end;">
          <a href="${hit.pdfUrl}" target="_blank" class="btn btn-secondary btn-xs" style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; text-decoration: none;">
            <svg style="width: 12px; height: 12px;" viewBox="0 0 24 24"><path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m-9 14H8.5v-1.5H7V14h1.5v-.75H7V12h3v5m4 0h-3V12h3c.55 0 1 .45 1 1v3c0 .55-.45 1-1 1m4-3c0 .55-.45 1-1 1h-1.5v1H18v-1.5h-1.5V14H18v-2h-3v5h1v-2.25h1.5V13h-1.5v-.75h1.5V12h1v2c0 .55-.45 1-1 1m-3-1.5h-1v2h1v-2Z"/></svg>
            View Source PDF
          </a>
        </div>
      ` : '';

      const highlightedTitle = highlightKeywords(hit.title, state.rag.query);
      const highlightedContent = highlightKeywords(hit.content, state.rag.query);

      hitDiv.innerHTML = `
        <div class="hit-header" style="display: flex; flex-direction: column; gap: 6px; align-items: flex-start;">
          <div style="display: flex; width: 100%; justify-content: space-between; align-items: center;">
            <span class="chip ${badgeClass}" style="margin: 0; font-size: 10px; padding: 2px 6px;">${badgeText}</span>
            <span class="hit-score badge-result" style="font-size: 11px;">Match relevance: ${matchPct}%</span>
          </div>
          <h4 class="hit-title font-mono" style="margin: 4px 0 2px 0; font-size: 13px; color: var(--color-text); font-weight: 600;">${highlightedTitle}</h4>
          <span class="muted" style="font-size: 11px; font-family: var(--font-mono);">${metadataText}</span>
        </div>
        <div class="hit-content body-sm font-mono" style="margin-top: 10px; line-height: 1.5; color: var(--color-text-secondary);">${highlightedContent}</div>
        ${pdfButton}
      `;

      this.resultsContainer.appendChild(hitDiv);
    });
  }
}
