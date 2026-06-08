import React, { useState, useEffect, useRef } from 'react';
import { useStore, tenantNameMap } from '@/state/store';
import { useMutation } from '@tanstack/react-query';
import { sendChatMessage } from '@/api/client';
import { parseMarkdown } from '@/utils/markdown';

/**
 * Props definition for the TenantHub component.
 */
export interface TenantHubProps {
  /** Callback triggered when a citation link inside a message is clicked. */
  onCitationRequest: (ref: string) => void;
}

/**
 * Component managing the Tenant Service Portal chat and LLM reasoning trace.
 * 
 * @param props Component parameters.
 * @returns The rendered TenantHub React element.
 */
export const TenantHub: React.FC<TenantHubProps> = ({ onCitationRequest }) => {
  const currentTenant = useStore((state) => state.currentTenant);
  const chatMessages = useStore((state) => state.chatMessages);
  const chatTimeline = useStore((state) => state.chatTimeline);
  const loadingChat = useStore((state) => state.loadingChat);
  const weather = useStore((state) => state.weather);
  const chatSessionId = useStore((state) => state.chatSessionId);

  const appendChatMessage = useStore((state) => state.appendChatMessage);
  const setChatLoading = useStore((state) => state.setChatLoading);
  const setChatResponse = useStore((state) => state.setChatResponse);
  const clearChat = useStore((state) => state.clearChat);

  const [inputVal, setInputVal] = useState<string>('');
  const [expandedNodes, setExpandedNodes] = useState<Record<number, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timelineEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to the bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, loadingChat]);

  // Reset/configure default timeline expanded nodes on timeline change
  useEffect(() => {
    if (chatTimeline.length > 0) {
      setExpandedNodes({
        0: true,
        [chatTimeline.length - 1]: true,
      });
      // Scroll timeline to the bottom
      setTimeout(() => {
        timelineEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      setExpandedNodes({});
    }
  }, [chatTimeline]);

  const chatMutation = useMutation({
    mutationFn: ({ tenantId, message, sessionId, temp, alert }: {
      tenantId: string;
      message: string;
      sessionId: string | null;
      temp: string;
      alert: string | null;
    }) => sendChatMessage(tenantId, message, sessionId, temp, alert),
    onSuccess: (data) => {
      setChatResponse(data.sessionId, data.response, data.timeline);
    },
    onError: (err) => {
      console.error(err);
      setChatLoading(false);
      appendChatMessage({
        role: 'system',
        content: 'Failed to connect to agent backend orchestrator. Ensure the FastAPI backend is running.',
      });
    },
  });

  const handleSend = () => {
    const text = inputVal.trim();
    if (!text || loadingChat) return;

    setInputVal('');
    appendChatMessage({ role: 'user', content: text });
    setChatLoading(true);

    chatMutation.mutate({
      tenantId: currentTenant,
      message: text,
      sessionId: chatSessionId,
      temp: weather.temp,
      alert: weather.alert,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  const handleMessageClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('citation-btn')) {
      const ref = target.getAttribute('data-ref');
      if (ref) {
        onCitationRequest(ref);
      }
    }
  };

  const toggleNode = (idx: number) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const tenantName = tenantNameMap[currentTenant] || 'Nike Store';
  const guidanceSignals = [
    {
      icon: 'policy',
      title: 'Lease-aware',
      body: 'The agent checks tenant liability and structural responsibility before it routes work.',
    },
    {
      icon: 'content_copy',
      title: 'Duplicate-safe',
      body: 'Active work orders are checked first to prevent double dispatch or confusing tenant updates.',
    },
    {
      icon: 'conversion_path',
      title: 'Traceable',
      body: 'Every tool call, result, and final response is exposed to the operations team in the audit rail.',
    },
  ];
  const promptSuggestions = [
    {
      icon: 'mode_fan',
      label: 'HVAC issue',
      prompt: 'The storefront AC is blowing warm air and customers are complaining about the heat.',
    },
    {
      icon: 'water_drop',
      label: 'Roof leak',
      prompt: 'Water is dripping from the roof above the storefront entrance and the contractor estimate is $250.',
    },
    {
      icon: 'escalator_warning',
      label: 'Escalator code',
      prompt: 'The escalator in Sector B is showing error code E-04 and needs troubleshooting.',
    },
  ];

  return (
    <div className="chat-workspace">
      {/* Chat Area */}
      <div className="chat-container card">
        <div className="chat-header">
          <div className="chat-avatar"></div>
          <div className="chat-meta">
            <span className="chat-target-name" id="chat-store-title">
              {tenantName} Support
            </span>
            <span className="chat-target-status">
              Operio SRE Dispatcher Connected
            </span>
          </div>
          <button className="btn btn-secondary btn-xs" id="btn-clear-chat" onClick={clearChat}>
            Clear History
          </button>
        </div>

        <div className="chat-guidance">
          <div className="signal-grid">
            {guidanceSignals.map((signal) => (
              <article key={signal.title} className="signal-chip">
                <span className="material-symbols-outlined signal-icon">{signal.icon}</span>
                <div>
                  <strong>{signal.title}</strong>
                  <p>{signal.body}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="prompt-rail">
            {promptSuggestions.map((suggestion) => (
              <button
                key={suggestion.label}
                className="prompt-chip"
                type="button"
                onClick={() => setInputVal(suggestion.prompt)}
              >
                <span className="material-symbols-outlined">{suggestion.icon}</span>
                {suggestion.label}
              </button>
            ))}
          </div>
        </div>
        
        <div 
          className="chat-messages" 
          id="chat-messages-container"
          onClick={handleMessageClick}
        >
          {chatMessages.map((msg, idx) => {
            const roleClass = msg.role === 'model' ? 'model' : msg.role === 'user' ? 'user' : 'system';
            
            if (msg.role === 'model') {
              return (
                <div key={idx} className={`message ${roleClass}`}>
                  <p dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.content) }} />
                </div>
              );
            }

            return (
              <div key={idx} className={`message ${roleClass}`}>
                <p>{msg.content}</p>
              </div>
            );
          })}

          {loadingChat && (
            <div className="message model-loading">
              <div className="spinner-inline" />
              <span>Operio is thinking...</span>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area">
          <input 
            type="text" 
            id="chat-input-field" 
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Operio to dispatch assistance or analyze lease liability..." 
            disabled={loadingChat}
          />
          <button className="btn btn-primary" id="btn-send-message" onClick={handleSend} disabled={loadingChat}>
            <span>Send</span>
            <span className="material-symbols-outlined send-button-icon">send</span>
          </button>
        </div>
      </div>

      {/* Agent Decisions Timeline Side Panel */}
      <div className="timeline-container card">
        <div className="timeline-header">
          <h3 className="headline-sm">Agent Decisions & Trace</h3>
          <span className="trend-badge positive">Live Pipeline</span>
        </div>
        <div className="timeline-body" id="agent-decisions-timeline">
          {loadingChat ? (
            <div className="timeline-loading">
              <div className="spinner" />
              <p className="body-sm mt-2">Gemini reasoning loop running. Call trace loading...</p>
            </div>
          ) : chatTimeline.length === 0 ? (
            <div className="timeline-empty">
              <span className="material-symbols-outlined timeline-empty-icon">
                history
              </span>
              <p className="body-sm">
                Submit a message to view the agent's step-by-step reasoning and MCP tool traces in real-time.
              </p>
            </div>
          ) : (
            chatTimeline.map((step, idx) => {
              let badgeText = 'THOUGHT';
              if (step.type === 'tool_call') badgeText = 'MCP CALL';
              if (step.type === 'tool_result') badgeText = 'RESULT';
              if (step.type === 'response') badgeText = 'OUTPUT';
              if (step.type === 'warning') badgeText = 'GUARDRAIL';

              let detailsText = step.details;
              let isJson = false;
              try {
                const json = JSON.parse(step.details);
                detailsText = JSON.stringify(json, null, 2);
                isJson = true;
              } catch (e) {
                // Keep as plain text
              }

              const isExpanded = expandedNodes[idx] || false;

              return (
                <div key={idx} className={`timeline-node timeline-${step.type}`}>
                  <div 
                    className="node-header node-header-button"
                    onClick={() => toggleNode(idx)}
                  >
                    <span className="node-number font-mono">#{idx + 1}</span>
                    <span className={`node-badge badge-${step.type}`}>{badgeText}</span>
                    <span className="node-title">{step.title}</span>
                    <span 
                      className={`material-symbols-outlined node-toggle ${isExpanded ? 'expanded' : ''}`}
                    >
                      expand_more
                    </span>
                  </div>
                  {isExpanded && (
                    <div className="node-details body-sm node-details-expanded">
                      {isJson ? (
                        <pre className="timeline-json">{detailsText}</pre>
                      ) : (
                        <p dangerouslySetInnerHTML={{ __html: detailsText.replace(/\n/g, '<br>') }} />
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={timelineEndRef} />
        </div>
      </div>
    </div>
  );
};
