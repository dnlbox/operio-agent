import { AppState, Staff, Ticket } from '@/types';
import { qs, on, showSystemNotice } from '@/utils/dom';
import { dispatch, updateStaffMember } from '@/state/store';
import { updateStaff, fetchSession } from '@/api/client';
import { parseMarkdown } from '@/utils/markdown';

/**
 * Component managing the Certified Staff & Vendor directory, schedules,
 * availability status, and linked work order/chat histories.
 */
export class StaffPortal {
  private staffListContainer: HTMLElement;
  private detailPanel: HTMLElement;
  
  private chatHistoryDialog: HTMLDialogElement;
  private chatHistoryContent: HTMLElement;
  private btnCloseChatDialog: HTMLButtonElement;

  private selectedStaffId: string | null = null;
  private isSaving: boolean = false;

  /**
   * Constructs the StaffPortal component.
   */
  constructor() {
    this.staffListContainer = qs('#portal-staff-list');
    this.detailPanel = qs('#portal-detail-panel');
    
    this.chatHistoryDialog = qs<HTMLDialogElement>('#chat-history-overlay');
    this.chatHistoryContent = qs('#chat-history-content');
    this.btnCloseChatDialog = qs<HTMLButtonElement>('#btn-close-chat-dialog');

    this.bindGlobalEvents();
  }

  /**
   * Binds global dialog events.
   */
  private bindGlobalEvents(): void {
    on(this.btnCloseChatDialog, 'click', () => {
      this.chatHistoryDialog.close();
    });
  }

  /**
   * Render entrypoint for the Staff view.
   * 
   * @param state Current AppState.
   */
  public render(state: AppState): void {
    this.renderStaffList(state.staff, state.tickets);
    this.renderDetailPanel(state);
  }

  /**
   * Renders the directory list of technicians.
   * 
   * @param staffList The list of technicians on-site.
   * @param tickets The list of all system work orders.
   */
  private renderStaffList(staffList: Staff[], tickets: Ticket[]): void {
    this.staffListContainer.innerHTML = '';

    if (staffList.length === 0) {
      this.staffListContainer.innerHTML = '<div class="empty-state">No technicians found in database.</div>';
      return;
    }

    staffList.forEach((person) => {
      const card = document.createElement('div');
      card.className = `staff-portal-card ${this.selectedStaffId === person._id ? 'active' : ''}`;
      
      const activeTaskCount = tickets.filter(
        (t) => t.assignedTo === person._id && t.status === 'Dispatched'
      ).length;

      let statusDotClass = 'offline';
      if (person.status === 'Available') statusDotClass = 'online';
      if (person.status === 'Busy') statusDotClass = 'warning';

      card.innerHTML = `
        <div class="staff-header">
          <span class="staff-name headline-sm" style="font-size: 1rem; color: #ffffff;">${person.name}</span>
          <span class="status-indicator ${statusDotClass}" style="width: 7px; height: 7px; box-shadow: 0 0 6px currentColor;"></span>
        </div>
        <div class="staff-details body-sm">
          <div>Primary: <span class="text-accent">${person.skills.join(', ')}</span></div>
          <div>Shift: ${person.shiftStart} - ${person.shiftEnd}</div>
        </div>
        <div class="staff-footer body-xs font-mono mt-1" style="display: flex; justify-content: space-between;">
          <span style="color: ${activeTaskCount > 0 ? 'var(--color-warning)' : 'var(--color-success)'};">
            ${activeTaskCount} active task${activeTaskCount === 1 ? '' : 's'}
          </span>
          <span class="muted">${person.currentLocation}</span>
        </div>
      `;

      on(card, 'click', () => {
        this.selectedStaffId = person._id;
        // Re-render local layout
        dispatch((state) => state); // Triggers store change to re-render
      });

      this.staffListContainer.appendChild(card);
    });
  }

  /**
   * Renders the active technician detail panel, containing edit inputs and work order history.
   * 
   * @param state The current application state.
   */
  private renderDetailPanel(state: AppState): void {
    const person = state.staff.find((s) => s._id === this.selectedStaffId);
    
    if (!person) {
      this.detailPanel.innerHTML = `
        <div class="empty-state-detail">
          <span class="material-symbols-outlined" style="font-size: 48px; color: var(--color-text-muted); margin-bottom: 0.5rem;">badge</span>
          <p>Select a technician from the directory to manage their profile, schedule, and view history.</p>
        </div>
      `;
      return;
    }

    const assignedTickets = state.tickets.filter((t) => t.assignedTo === person._id);

    this.detailPanel.innerHTML = `
      <div class="staff-detail-workspace">
        <!-- Profile / Info Header -->
        <div class="detail-section-header" style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h2 class="display-lg" style="font-size: 1.5rem;">${person.name}</h2>
            <p class="body-sm font-mono muted">ID: ${person._id}</p>
          </div>
          <div>
            <button class="btn btn-primary btn-xs" id="btn-save-staff-details" ${this.isSaving ? 'disabled' : ''}>
              ${this.isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>

        <!-- Schedule & Proximity Form -->
        <div class="detail-grid">
          <div class="form-group">
            <label for="edit-staff-status">Availability Status</label>
            <select id="edit-staff-status" class="form-control-glass">
              <option value="Available" ${person.status === 'Available' ? 'selected' : ''}>Available (On-Site)</option>
              <option value="Busy" ${person.status === 'Busy' ? 'selected' : ''}>Busy / In-Task</option>
              <option value="Offline" ${person.status === 'Offline' ? 'selected' : ''}>Offline (Off-Site)</option>
            </select>
          </div>

          <div class="form-group">
            <label for="edit-staff-location">Current Sector / Location</label>
            <input type="text" id="edit-staff-location" class="form-control-glass" value="${person.currentLocation}" placeholder="e.g. Sector B" />
          </div>

          <div class="form-group">
            <label for="edit-staff-shift-start">Shift Start Time (HH:MM)</label>
            <input type="text" id="edit-staff-shift-start" class="form-control-glass" value="${person.shiftStart}" placeholder="08:00" />
          </div>

          <div class="form-group">
            <label for="edit-staff-shift-end">Shift End Time (HH:MM)</label>
            <input type="text" id="edit-staff-shift-end" class="form-control-glass" value="${person.shiftEnd}" placeholder="17:00" />
          </div>

          <div class="form-group" style="grid-column: span 2;">
            <label for="edit-staff-skills">Specialized Certifications / Skills (comma separated)</label>
            <input type="text" id="edit-staff-skills" class="form-control-glass" value="${person.skills.join(', ')}" placeholder="e.g. HVAC, Electrical" />
          </div>
        </div>

        <!-- Work Order History -->
        <div class="history-section" style="margin-top: 1rem;">
          <h3 class="headline-sm" style="font-size: 1rem; border-bottom: 1px solid var(--brand-border); padding-bottom: 0.5rem; margin-bottom: 0.75rem;">
            Assigned Work Order History
          </h3>
          
          <div class="history-list">
            ${
              assignedTickets.length === 0
                ? '<div class="body-sm muted">No work orders have been assigned to this technician.</div>'
                : ''
            }
          </div>
        </div>
      </div>
    `;

    // Render history items dynamically and hook up clicks
    const historyListContainer = this.detailPanel.querySelector('.history-list') as HTMLElement;
    
    assignedTickets.forEach((ticket) => {
      const row = document.createElement('div');
      row.className = 'history-row';
      row.setAttribute('data-session-id', ticket.sessionId || '');
      
      let statusClass = 'chip-success';
      if (ticket.status === 'Pending Approval') statusClass = 'chip-warning';
      if (ticket.status === 'Rejected') statusClass = 'chip-danger';

      row.innerHTML = `
        <div class="history-info">
          <span class="history-id font-mono">${ticket._id.substring(0, 8).toUpperCase()}</span>
          <span class="history-desc">${ticket.description}</span>
          <span class="history-subtext muted">${ticket.assetId} · Est: $${ticket.costEstimation}</span>
        </div>
        <div class="history-meta">
          <span class="chip ${statusClass}">${ticket.status}</span>
          ${
            ticket.sessionId 
              ? `<span class="material-symbols-outlined text-accent" style="font-size: 18px;" title="View chat trigger context">forum</span>` 
              : `<span class="material-symbols-outlined muted" style="font-size: 18px;" title="Manual order (no chat trace)">info</span>`
          }
        </div>
      `;

      on(row, 'click', () => {
        if (ticket.sessionId) {
          this.showChatTriggerModal(ticket.sessionId);
        } else {
          showSystemNotice(`Work Order ${ticket._id.substring(0, 8).toUpperCase()} has no triggering conversation history (manually dispatched).`);
        }
      });

      historyListContainer.appendChild(row);
    });

    // Form Event Listeners
    const btnSave = qs<HTMLButtonElement>('#btn-save-staff-details', this.detailPanel);
    const selectStatus = qs<HTMLSelectElement>('#edit-staff-status', this.detailPanel);
    const inputLocation = qs<HTMLInputElement>('#edit-staff-location', this.detailPanel);
    const inputShiftStart = qs<HTMLInputElement>('#edit-staff-shift-start', this.detailPanel);
    const inputShiftEnd = qs<HTMLInputElement>('#edit-staff-shift-end', this.detailPanel);
    const inputSkills = qs<HTMLInputElement>('#edit-staff-skills', this.detailPanel);

    on(btnSave, 'click', async () => {
      this.isSaving = true;
      btnSave.disabled = true;
      btnSave.textContent = 'Saving...';

      const updates = {
        status: selectStatus.value as 'Available' | 'Busy' | 'Offline',
        currentLocation: inputLocation.value.trim(),
        shiftStart: inputShiftStart.value.trim(),
        shiftEnd: inputShiftEnd.value.trim(),
        skills: inputSkills.value.split(',').map(s => s.trim()).filter(s => s.length > 0)
      };

      try {
        const updated = await updateStaff(person._id, updates);
        dispatch(updateStaffMember(updated));
        showSystemNotice(`Updated settings for ${person.name} successfully.`);
      } catch (err) {
        console.error(err);
        showSystemNotice('Failed to update staff member. Check backend server.');
      } finally {
        this.isSaving = false;
        if (document.getElementById('btn-save-staff-details')) {
          btnSave.disabled = false;
          btnSave.textContent = 'Save Settings';
        }
      }
    });
  }

  /**
   * Fetches and displays the support chat history that triggered a work order in a modal overlay.
   * 
   * @param sessionId The conversation session ID.
   */
  private async showChatTriggerModal(sessionId: string): Promise<void> {
    this.chatHistoryContent.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; color: var(--color-text-muted);">
        <div class="spinner-inline" style="margin-bottom: 0.5rem;"></div>
        <p class="body-sm">Loading dispatch chat history...</p>
      </div>
    `;
    this.chatHistoryDialog.showModal();

    try {
      const session = await fetchSession(sessionId);
      this.chatHistoryContent.innerHTML = '';
      
      if (!session.messages || session.messages.length === 0) {
        this.chatHistoryContent.innerHTML = '<div class="body-sm muted text-center">No messages found in this session.</div>';
        return;
      }

      session.messages.forEach((msg) => {
        const div = document.createElement('div');
        div.className = `message ${msg.role === 'model' ? 'model' : msg.role === 'user' ? 'user' : 'system'}`;

        if (msg.role === 'model') {
          div.innerHTML = `<p>${parseMarkdown(msg.content)}</p>`;
        } else {
          div.innerHTML = `<p>${msg.content}</p>`;
        }
        
        this.chatHistoryContent.appendChild(div);
      });

      this.chatHistoryContent.scrollTop = this.chatHistoryContent.scrollHeight;
    } catch (err) {
      console.error(err);
      this.chatHistoryContent.innerHTML = `
        <div class="body-sm text-danger text-center">
          Failed to load triggering conversation history. The session logs may have been cleared.
        </div>
      `;
    }
  }
}
