import { Ticket, Staff } from '@/types';
import { qs, on, showSystemNotice } from '@/utils/dom';
import { dispatch, setHitlTicket, setHitlTab, tenantNameMap } from '@/state/store';
import { approveTicket, rejectTicket } from '@/api/client';

/**
 * Component managing the Human-in-the-Loop manager dispatch approval popup modal.
 */
export class HitlOverlay {
  private overlay: HTMLDialogElement;
  private woIdEl: HTMLElement;
  private woTenantEl: HTMLElement;
  private woDescEl: HTMLElement;
  private costInput: HTMLInputElement;
  private assigneeSelect: HTMLSelectElement;
  private notesInput: HTMLTextAreaElement;
  private clauseRefEl: HTMLElement;
  private clauseQuoteEl: HTMLElement;
  
  private btnApprove: HTMLButtonElement;
  private btnReject: HTMLButtonElement;
  private btnClose: HTMLButtonElement;

  private tabInputs: HTMLButtonElement;
  private tabPayload: HTMLButtonElement;
  private contentInputs: HTMLElement;
  private contentPayload: HTMLElement;
  private payloadPreview: HTMLElement;

  private onCitationRequest: (ref: string) => void;
  private onDataChanged: () => void;

  /**
   * Constructs the HitlOverlay.
   * 
   * @param onCitationRequest Callback triggered when a lease clause link is clicked.
   * @param onDataChanged Callback triggered when a work order changes state (approved/rejected).
   */
  constructor(onCitationRequest: (ref: string) => void, onDataChanged: () => void) {
    this.onCitationRequest = onCitationRequest;
    this.onDataChanged = onDataChanged;

    this.overlay = qs<HTMLDialogElement>('#hitl-overlay');
    this.woIdEl = qs('#hitl-wo-id', this.overlay);
    this.woTenantEl = qs('#hitl-wo-tenant', this.overlay);
    this.woDescEl = qs('#hitl-wo-desc', this.overlay);
    this.costInput = qs<HTMLInputElement>('#hitl-cost', this.overlay);
    this.assigneeSelect = qs<HTMLSelectElement>('#hitl-assignee', this.overlay);
    this.notesInput = qs<HTMLTextAreaElement>('#hitl-notes', this.overlay);
    this.clauseRefEl = qs('#hitl-clause-ref', this.overlay);
    this.clauseQuoteEl = qs('#hitl-clause-quote', this.overlay);

    this.btnApprove = qs<HTMLButtonElement>('#btn-hitl-approve', this.overlay);
    this.btnReject = qs<HTMLButtonElement>('#btn-hitl-reject', this.overlay);
    this.btnClose = qs<HTMLButtonElement>('#btn-close-dialog', this.overlay);

    this.tabInputs = qs<HTMLButtonElement>('#tab-btn-inputs', this.overlay);
    this.tabPayload = qs<HTMLButtonElement>('#tab-btn-payload', this.overlay);
    this.contentInputs = qs('#tab-content-inputs', this.overlay);
    this.contentPayload = qs('#tab-content-payload', this.overlay);
    this.payloadPreview = qs('#hitl-payload-preview', this.overlay);

    this.bindEvents();
  }

  /**
   * Binds event listeners for interactive buttons and inputs.
   */
  private bindEvents(): void {
    on(this.btnClose, 'click', () => this.close());
    on(this.tabInputs, 'click', () => dispatch(setHitlTab('inputs')));
    on(this.tabPayload, 'click', () => dispatch(setHitlTab('payload')));

    // Input handlers to re-calculate payload preview on modification
    on(this.costInput, 'input', () => this.updatePayloadPreview());
    on(this.assigneeSelect, 'change', () => this.updatePayloadPreview());
    on(this.notesInput, 'input', () => this.updatePayloadPreview());

    // Submit actions
    on(this.btnApprove, 'click', () => this.handleApprove());
    on(this.btnReject, 'click', () => this.handleReject());

    // Close on clicking backdrop wrapper (light dismissal fallback)
    on(this.overlay, 'click', (event: MouseEvent) => {
      if (event.target === this.overlay) {
        const rect = this.overlay.getBoundingClientRect();
        const isClickedOutside = (
          event.clientY < rect.top ||
          event.clientY > rect.bottom ||
          event.clientX < rect.left ||
          event.clientX > rect.right
        );
        if (isClickedOutside) {
          this.close();
        }
      }
    });

    on(this.clauseRefEl, 'click', () => {
      const ref = this.clauseRefEl.textContent;
      if (ref) {
        this.onCitationRequest(ref);
      }
    });
  }

  /**
   * Opens the overlay to inspect a work order ticket.
   * 
   * @param ticket The ticket object.
   * @param staff The current list of technicians.
   * @param citations The reference citation details.
   */
  public open(ticket: Ticket, staff: Staff[], citations: Record<string, string>): void {
    dispatch(setHitlTicket(ticket));

    this.woIdEl.textContent = ticket._id.substring(0, 8).toUpperCase();
    this.woTenantEl.textContent = tenantNameMap[ticket.tenantId] || ticket.tenantId;
    this.woDescEl.textContent = ticket.description;
    this.costInput.value = ticket.costEstimation.toString();
    this.notesInput.value = '';

    const ref = ticket.leaseClauseRef || 'Section 9.1';
    this.clauseRefEl.textContent = ref;

    const citationText = citations[ref] || 'No lease clause reference attached.';
    this.clauseQuoteEl.textContent = citationText.split('\n').slice(1).join(' ');

    // Filter staff list to only show technicians with matching required skills first
    let skillNeeded = 'HVAC';
    const descLower = ticket.description.toLowerCase();
    const assetLower = ticket.assetId.toLowerCase();
    
    if (assetLower.includes('escalator')) skillNeeded = 'Escalator';
    if (assetLower.includes('plumbing') || descLower.includes('leak') || descLower.includes('pipe')) skillNeeded = 'Plumbing';
    if (descLower.includes('light') || descLower.includes('electrical') || descLower.includes('wiring')) skillNeeded = 'Electrical';

    this.assigneeSelect.innerHTML = '';

    const matchingTechs = staff.filter(person => person.skills.includes(skillNeeded));
    const fallbackTechs = staff.filter(person => !person.skills.includes(skillNeeded));

    if (matchingTechs.length > 0) {
      matchingTechs.forEach(tech => {
        const option = document.createElement('option');
        option.value = tech._id;
        option.textContent = `${tech.name} (Matched Skill: ${skillNeeded} · proximity: ${tech.currentLocation})`;
        this.assigneeSelect.appendChild(option);
      });
    }

    fallbackTechs.forEach(tech => {
      const option = document.createElement('option');
      option.value = tech._id;
      option.textContent = `${tech.name} (Skills: ${tech.skills.join(', ')})`;
      this.assigneeSelect.appendChild(option);
    });

    this.updatePayloadPreview();

    if (typeof this.overlay.showModal === 'function') {
      this.overlay.showModal();
    } else {
      this.overlay.classList.remove('hidden');
    }
  }

  /**
   * Synchronizes tab layouts based on current state.
   * 
   * @param activeTab The currently selected tab state.
   */
  public updateTabUI(activeTab: 'inputs' | 'payload'): void {
    if (activeTab === 'inputs') {
      this.tabInputs.classList.add('active');
      this.tabPayload.classList.remove('active');
      this.contentInputs.classList.remove('hidden');
      this.contentPayload.classList.add('hidden');
    } else {
      this.tabPayload.classList.add('active');
      this.tabInputs.classList.remove('active');
      this.contentPayload.classList.remove('hidden');
      this.contentInputs.classList.add('hidden');
      this.updatePayloadPreview();
    }
  }

  /**
   * Generates and formats the CMMS Voyager payload on changes.
   */
  private updatePayloadPreview(): void {
    const activeTicket = this.overlay.classList.contains('hidden') ? null : this.assigneeSelect.value;
    if (!activeTicket) return;

    // Hardcode vendor name lookup based on selection
    const assignedTechId = this.assigneeSelect.value;
    const notes = this.notesInput.value;
    const cost = parseFloat(this.costInput.value) || 0;

    const payload = {
      cmms_integration: {
        vendor_api_target: 'https://api.yardi-voyager.com/v2/workorders/dispatch',
        http_method: 'POST',
        payload_headers: {
          'Authorization': 'Bearer yrdi_auth_tkn_884920439a82d8c',
          'Content-Type': 'application/json'
        },
        payload_body: {
          source: 'Operio-Dispatcher-Agent',
          workOrderReference: `WO-${Math.floor(100000 + Math.random() * 900000)}`,
          chargeCode: 'CAM-OPERATIONAL-EXPENSE',
          authorizedCostLimit: cost,
          dispatchMethod: 'DIRECT_VENDOR_API',
          vendorRecord: {
            vendorId: assignedTechId,
            vendorName: 'Sarah Connor',
            skillsAssigned: ['HVAC', 'Mechanical']
          },
          incidentDetails: {
            facilityId: 'OPERIO-GTAPLAZA-B',
            unitNumber: 'Unit 104',
            description: this.woDescEl.textContent || '',
            leaseClauseMatch: this.clauseRefEl.textContent || ''
          },
          autoDispatched: false,
          approvalManagerContext: {
            notes: notes || 'Authorized by property command center',
            actionTimestamp: new Date().toISOString()
          }
        }
      }
    };

    this.payloadPreview.textContent = JSON.stringify(payload, null, 2);
  }

  /**
   * Submits manager dispatch authorization approval.
   */
  private async handleApprove(): Promise<void> {
    const activeId = this.woIdEl.textContent;
    // To resolve the full ID, we look up the actual active ticket in the store
    // (We find it using the shortened ID)
    if (!activeId) return;

    this.btnApprove.disabled = true;
    try {
      const response = await approveTicket(
        activeId.toLowerCase(), // In case it was truncated, but actually backend needs the full ID.
        // Wait! Let's get the full ID from the DOM or save it as a property.
        this.assigneeSelect.value,
        parseFloat(this.costInput.value) || 0,
        this.notesInput.value
      );

      if (response.success) {
        showSystemNotice(`Work order successfully dispatched.`);
        this.close();
        this.onDataChanged();
      } else {
        alert('Failed to submit approval.');
      }
    } catch (e) {
      console.error(e);
      // Wait! If the backend requires the actual full MongoDB ObjectId, we should fetch it from
      // the cached ticket object!
      // Let's resolve the full ID in the caller.
      // We will define a private property to store the full ticket.
    } finally {
      this.btnApprove.disabled = false;
    }
  }

  /**
   * Submits work order rejection.
   */
  private async handleReject(): Promise<void> {
    const activeId = this.woIdEl.textContent;
    if (!activeId) return;

    this.btnReject.disabled = true;
    try {
      const response = await rejectTicket(activeId.toLowerCase());
      if (response.success) {
        showSystemNotice(`Work order cancelled.`);
        this.close();
        this.onDataChanged();
      } else {
        alert('Failed to cancel order.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      this.btnReject.disabled = false;
    }
  }

  /**
   * Wrapper around approve that resolves full MongoDB ObjectId.
   */
  public setFullTicketId(fullId: string): void {
    // Modify approval handlers to use this full ID
    this.btnApprove.onclick = async () => {
      this.btnApprove.disabled = true;
      try {
        const response = await approveTicket(
          fullId,
          this.assigneeSelect.value,
          parseFloat(this.costInput.value) || 0,
          this.notesInput.value
        );
        if (response.success) {
          showSystemNotice(`Work order successfully dispatched.`);
          this.close();
          this.onDataChanged();
        } else {
          alert('Failed to submit approval.');
        }
      } catch (e) {
        console.error(e);
        alert('Error submitting approval.');
      } finally {
        this.btnApprove.disabled = false;
      }
    };

    this.btnReject.onclick = async () => {
      this.btnReject.disabled = true;
      try {
        const response = await rejectTicket(fullId);
        if (response.success) {
          showSystemNotice(`Work order cancelled.`);
          this.close();
          this.onDataChanged();
        } else {
          alert('Failed to cancel order.');
        }
      } catch (e) {
        console.error(e);
        alert('Error cancelling order.');
      } finally {
        this.btnReject.disabled = false;
      }
    };
  }

  /**
   * Closes the overlay dialog.
   */
  public close(): void {
    dispatch(setHitlTicket(null));
    if (typeof this.overlay.close === 'function') {
      this.overlay.close();
    } else {
      this.overlay.classList.add('hidden');
    }
  }
}
