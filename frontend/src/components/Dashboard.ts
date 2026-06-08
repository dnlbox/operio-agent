import { AppState, Ticket } from '@/types';
import { qs, on } from '@/utils/dom';
import { tenantNameMap } from '@/state/store';

/**
 * Component managing the main dashboard/command ledger panel.
 */
export class Dashboard {
  private kpiTotal: HTMLElement;
  private kpiPending: HTMLElement;
  private kpiPendingBadge: HTMLElement;
  private kpiDispatched: HTMLElement;

  private ticketList: HTMLElement;
  private staffList: HTMLElement;

  private filterAll: HTMLElement;
  private filterPending: HTMLElement;
  private filterDispatched: HTMLElement;

  private activeFilter: 'all' | 'pending' | 'dispatched' = 'all';
  private onReviewTicket: (ticket: Ticket) => void;

  /**
   * Constructs the Dashboard component.
   * 
   * @param onReviewTicket Callback triggered when "Review Approval" is clicked.
   */
  constructor(onReviewTicket: (ticket: Ticket) => void) {
    this.onReviewTicket = onReviewTicket;

    this.kpiTotal = qs('#kpi-total-orders');
    this.kpiPending = qs('#kpi-pending-orders');
    this.kpiPendingBadge = qs('#kpi-pending-badge');
    this.kpiDispatched = qs('#kpi-dispatched-orders');

    this.ticketList = qs('#dashboard-ticket-list');
    this.staffList = qs('#dashboard-staff-list');

    this.filterAll = qs('#filter-all');
    this.filterPending = qs('#filter-pending');
    this.filterDispatched = qs('#filter-dispatched');

    this.bindEvents();
  }

  /**
   * Registers event handlers for filters.
   */
  private bindEvents(): void {
    on(this.filterAll, 'click', () => {
      this.activeFilter = 'all';
      this.updateFilterButtons();
      this.triggerManualRender();
    });

    on(this.filterPending, 'click', () => {
      this.activeFilter = 'pending';
      this.updateFilterButtons();
      this.triggerManualRender();
    });

    on(this.filterDispatched, 'click', () => {
      this.activeFilter = 'dispatched';
      this.updateFilterButtons();
      this.triggerManualRender();
    });
  }

  /**
   * Triggers a manual rendering step when changing filter views local to dashboard.
   */
  private triggerManualRender(): void {
    // We fetch global state and call render to update matching filter rows
    // It's handled by main.ts re-rendering the store subscribers.
    // We emit an event or let main render again.
    // To make it simple, we just let main.ts render the dashboard when state changes,
    // and when filters change we dispatch a minor state change or call a local render with cached state.
    // In our case, dispatch triggers subscribers.
    // Let's dispatch a dummy reducer or let main.ts call render on activeView update.
    // Let's invoke a custom state change if needed, or just let store listeners trigger it.
    // To do it pure FP style, we should probably keep activeFilter in store state,
    // but a local filter in the component is also fine. Let's make sure it renders.
    // If it's a local component state, we can cache the last rendered AppState and re-render.
    if (this.lastState) {
      this.render(this.lastState);
    }
  }

  private lastState: AppState | null = null;

  /**
   * Synchronizes active filters classes.
   */
  private updateFilterButtons(): void {
    [this.filterAll, this.filterPending, this.filterDispatched].forEach(btn => {
      btn.classList.remove('active-filter');
    });

    if (this.activeFilter === 'all') this.filterAll.classList.add('active-filter');
    if (this.activeFilter === 'pending') this.filterPending.classList.add('active-filter');
    if (this.activeFilter === 'dispatched') this.filterDispatched.classList.add('active-filter');
  }

  /**
   * Re-renders metrics, queue lists, and staffs matching current state.
   * 
   * @param state The current application state.
   */
  public render(state: AppState): void {
    this.lastState = state;

    // 1. Calculate and update KPI values
    const total = state.tickets.length;
    const pending = state.tickets.filter(t => t.status === 'Pending Approval').length;
    const dispatched = state.tickets.filter(t => t.status === 'Dispatched').length;

    this.kpiTotal.textContent = total.toString();
    this.kpiPending.textContent = pending.toString();
    this.kpiPendingBadge.textContent = `${pending} Pending`;
    this.kpiDispatched.textContent = dispatched.toString();

    if (pending > 0) {
      this.kpiPendingBadge.className = 'trend-badge warning blink';
    } else {
      this.kpiPendingBadge.className = 'trend-badge warning';
    }

    // 2. Filter and render Ticket Ledger List
    this.ticketList.innerHTML = '';
    
    let filteredTickets = state.tickets;
    if (this.activeFilter === 'pending') {
      filteredTickets = state.tickets.filter(t => t.status === 'Pending Approval');
    } else if (this.activeFilter === 'dispatched') {
      filteredTickets = state.tickets.filter(t => t.status === 'Dispatched');
    }

    if (filteredTickets.length === 0) {
      this.ticketList.innerHTML = `<div class="empty-state">No tickets in this category.</div>`;
    } else {
      filteredTickets.forEach(ticket => {
        const row = document.createElement('div');
        row.className = 'ticket-row card';
        
        let statusClass = 'chip-success';
        if (ticket.status === 'Pending Approval') {
          statusClass = 'chip-warning';
        } else if (ticket.status === 'Rejected') {
          statusClass = 'chip-danger';
        } else if (ticket.status === 'Created') {
          statusClass = 'chip-primary'; // Custom category
        }

        const isPending = ticket.status === 'Pending Approval';
        const actionButton = isPending 
          ? `<button class="btn btn-secondary btn-xs btn-action-hitl" data-id="${ticket._id}">Review Approval</button>` 
          : '';

        const tenantName = tenantNameMap[ticket.tenantId] || ticket.tenantId;

        row.innerHTML = `
          <div class="ticket-info">
            <span class="ticket-id font-mono">${ticket._id.substring(0, 8).toUpperCase()}</span>
            <span class="ticket-title">${ticket.description}</span>
            <span class="ticket-subtext muted">${tenantName} · ${ticket.assetId} · Estimated Cost: $${ticket.costEstimation}</span>
          </div>
          <div class="ticket-meta">
            <span class="chip ${statusClass}">${ticket.status}</span>
            ${actionButton}
          </div>
        `;

        if (isPending) {
          const btn = row.querySelector('.btn-action-hitl');
          if (btn) {
            on(btn as HTMLElement, 'click', () => this.onReviewTicket(ticket));
          }
        }

        this.ticketList.appendChild(row);
      });
    }

    // 3. Render Staff Status list
    this.staffList.innerHTML = '';
    
    if (state.staff.length === 0) {
      this.staffList.innerHTML = `<div class="empty-state">No staff on-site.</div>`;
    } else {
      state.staff.forEach(person => {
        const card = document.createElement('div');
        card.className = 'staff-card card';
        
        const assignedWOs = state.tickets.filter(
          t => t.assignedTo === person._id && t.status === 'Dispatched'
        ).length;

        const assignmentBadge = assignedWOs > 0 
          ? `<span class="staff-workload text-warning">${assignedWOs} active task(s)</span>` 
          : `<span class="staff-workload text-success">Idle</span>`;

        card.innerHTML = `
          <div class="staff-header">
            <span class="staff-name">${person.name}</span>
            <span class="staff-status-dot online"></span>
          </div>
          <div class="staff-details body-sm">
            <div>Skills: <span class="text-accent">${person.skills.join(', ')}</span></div>
            <div>Sector: <span class="text-accent">${person.currentLocation}</span></div>
            <div>Shift: ${person.shiftStart} - ${person.shiftEnd} ($${person.ratePerHour}/hr)</div>
          </div>
          <div class="staff-footer">
            ${assignmentBadge}
          </div>
        `;
        this.staffList.appendChild(card);
      });
    }
  }
}
