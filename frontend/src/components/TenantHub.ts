import { AppState, TimelineStep } from '@/types';
import { qs, on } from '@/utils/dom';
import { dispatch, setTenant, appendChatMessage, setChatLoading, setChatResponse, clearChat, tenantNameMap, getState } from '@/state/store';
import { sendChatMessage } from '@/api/client';
import { parseMarkdown } from '@/utils/markdown';

/**
 * Component managing the Tenant Service Portal chat and LLM reasoning trace.
 */
export class TenantHub {
  private tenantSelect: HTMLSelectElement;
  private chatStoreTitle: HTMLElement;
  private chatMessages: HTMLElement;
  private chatInputField: HTMLInputElement;
  private btnSend: HTMLButtonElement;
  private btnClear: HTMLButtonElement;
  private timelineContainer: HTMLElement;

  private onCitationRequest: (ref: string) => void;

  /**
   * Constructs the TenantHub component.
   * 
   * @param onCitationRequest Callback triggered when a citation link is clicked.
   */
  constructor(onCitationRequest: (ref: string) => void) {
    this.onCitationRequest = onCitationRequest;

    this.tenantSelect = qs<HTMLSelectElement>('#tenant-select');
    this.chatStoreTitle = qs('#chat-store-title');
    this.chatMessages = qs('#chat-messages-container');
    this.chatInputField = qs<HTMLInputElement>('#chat-input-field');
    this.btnSend = qs<HTMLButtonElement>('#btn-send-message');
    this.btnClear = qs<HTMLButtonElement>('#btn-clear-chat');
    this.timelineContainer = qs('#agent-decisions-timeline');

    this.bindEvents();
  }

  /**
   * Binds event listeners for chat input and tenant selectors.
   */
  private bindEvents(): void {
    on(this.tenantSelect, 'change', (e) => {
      const select = e.target as HTMLSelectElement;
      dispatch(setTenant(select.value));
    });

    on(this.btnSend, 'click', () => this.sendChat());

    on(this.chatInputField, 'keydown', (e) => {
      if (e.key === 'Enter') {
        this.sendChat();
      }
    });

    on(this.btnClear, 'click', () => {
      dispatch(clearChat());
    });
  }

  /**
   * Formulates and sends user chat message, initiating AI reasoning.
   */
  private async sendChat(): Promise<void> {
    const text = this.chatInputField.value.trim();
    if (!text) return;

    this.chatInputField.value = '';

    // Append User Message to local state
    dispatch(appendChatMessage({ role: 'user', content: text }));
    dispatch(setChatLoading(true));

    try {
      // Wait, let's get the state directly from getState!
      // Import getState from store.
      const { currentTenant, chatSessionId, weather } = getState();

      const data = await sendChatMessage(
        currentTenant,
        text,
        chatSessionId,
        weather.temp,
        weather.alert
      );

      dispatch(setChatResponse(data.sessionId, data.response, data.timeline));
    } catch (e) {
      console.error(e);
      dispatch(setChatLoading(false));
      dispatch(appendChatMessage({
        role: 'system',
        content: 'Failed to connect to agent backend orchestrator. Ensure the FastAPI backend is running.'
      }));
    }
  }

  /**
   * Re-renders messages list and decisions trace matching state.
   * 
   * @param state The current application state.
   */
  public render(state: AppState): void {
    // 1. Sync active tenant selector and header details
    if (this.tenantSelect.value !== state.currentTenant) {
      this.tenantSelect.value = state.currentTenant;
    }
    const tenantName = tenantNameMap[state.currentTenant] || 'Nike Store';
    this.chatStoreTitle.textContent = `${tenantName} Support`;

    // 2. Render chat messages list
    this.chatMessages.innerHTML = '';
    state.chatMessages.forEach(msg => {
      const div = document.createElement('div');
      div.className = `message ${msg.role === 'model' ? 'model' : msg.role === 'user' ? 'user' : 'system'}`;

      if (msg.role === 'model') {
        div.innerHTML = `<p>${parseMarkdown(msg.content)}</p>`;
        
        // Add listeners to new citations inside the message
        div.querySelectorAll('.citation-btn').forEach(btn => {
          on(btn as HTMLElement, 'click', () => {
            const ref = btn.getAttribute('data-ref');
            if (ref) this.onCitationRequest(ref);
          });
        });
      } else {
        div.innerHTML = `<p>${msg.content}</p>`;
      }
      this.chatMessages.appendChild(div);
    });

    // Handle loading spinner inline
    if (state.loadingChat) {
      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'message model-loading';
      loadingDiv.innerHTML = '<div class="spinner-inline"></div><span>Operio is thinking...</span>';
      this.chatMessages.appendChild(loadingDiv);

      this.timelineContainer.innerHTML = `
        <div class="timeline-loading">
          <div class="spinner"></div>
          <p class="body-sm mt-2">Gemini reasoning loop running. Call trace loading...</p>
        </div>
      `;
    } else {
      // 3. Render agent reasoning trace timeline
      this.renderTimeline(state.chatTimeline);
    }

    // Scroll to bottom of message logs
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  /**
   * Renders the execution trace nodes inside the timeline container.
   * 
   * @param steps The list of timeline reasoning steps.
   */
  private renderTimeline(steps: TimelineStep[]): void {
    if (!steps || steps.length === 0) {
      this.timelineContainer.innerHTML = `
        <div class="timeline-empty">
          <span class="material-symbols-outlined" style="font-size: 36px; color: var(--color-text-muted); margin-bottom: 0.5rem;">history</span>
          <p class="body-sm">Submit a message to view the agent's step-by-step reasoning and MCP tool traces in real-time.</p>
        </div>
      `;
      return;
    }

    this.timelineContainer.innerHTML = '';

    steps.forEach((step, index) => {
      const node = document.createElement('div');
      node.className = `timeline-node timeline-${step.type}`;
      
      let badgeText = 'THOUGHT';
      if (step.type === 'tool_call') badgeText = 'MCP CALL';
      if (step.type === 'tool_result') badgeText = 'RESULT';
      if (step.type === 'response') badgeText = 'OUTPUT';
      if (step.type === 'warning') badgeText = 'GUARDRAIL';

      // Parse JSON result payloads to make them expand-collapsible/prettier
      let detailsText = step.details;
      let isJson = false;
      try {
        const json = JSON.parse(step.details);
        detailsText = JSON.stringify(json, null, 2);
        isJson = true;
      } catch (e) {
        // Keep as string
        detailsText = step.details;
      }

      const formattedDetails = isJson 
        ? `<pre class="timeline-json">${detailsText}</pre>`
        : `<p>${detailsText.replace(/\n/g, '<br>')}</p>`;

      node.innerHTML = `
        <div class="node-header" style="cursor: pointer;">
          <span class="node-number font-mono">#${index + 1}</span>
          <span class="node-badge badge-${step.type}">${badgeText}</span>
          <span class="node-title">${step.title}</span>
          <span class="material-symbols-outlined node-toggle" style="margin-left: auto; font-size: 16px; transition: transform 0.2s;">expand_more</span>
        </div>
        <div class="node-details body-sm" style="display: none; padding-top: 10px;">
          ${formattedDetails}
        </div>
      `;

      const header = node.querySelector('.node-header') as HTMLElement;
      const details = node.querySelector('.node-details') as HTMLElement;
      const toggleIcon = node.querySelector('.node-toggle') as HTMLElement;

      // Expand the first and last step by default, or just let users click
      if (index === 0 || index === steps.length - 1) {
        details.style.display = 'block';
        toggleIcon.style.transform = 'rotate(180deg)';
      }

      on(header, 'click', () => {
        const isCollapsed = details.style.display === 'none';
        details.style.display = isCollapsed ? 'block' : 'none';
        toggleIcon.style.transform = isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)';
      });

      this.timelineContainer.appendChild(node);
    });

    this.timelineContainer.scrollTop = this.timelineContainer.scrollHeight;
  }
}
