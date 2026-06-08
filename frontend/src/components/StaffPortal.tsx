import React, { useState, useEffect, useRef } from 'react';
import { Staff, Ticket } from '@/types';
import { useStore } from '@/state/store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTickets, fetchStaff, updateStaff, fetchSession } from '@/api/client';
import { showSystemNotice } from '@/utils/dom';
import { parseMarkdown } from '@/utils/markdown';

/**
 * Component managing the Certified Staff & Vendor directory, schedules,
 * availability status, and linked work order/chat histories.
 * 
 * @returns The rendered StaffPortal React element.
 */
export const StaffPortal: React.FC = () => {
  const queryClient = useQueryClient();
  const updateStaffMember = useStore((state) => state.updateStaffMember);

  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [chatHistorySessionId, setChatHistorySessionId] = useState<string | null>(null);

  const chatDialogRef = useRef<HTMLDialogElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Form edit states
  const [status, setStatus] = useState<'Available' | 'Busy' | 'Offline'>('Available');
  const [location, setLocation] = useState<string>('');
  const [shiftStart, setShiftStart] = useState<string>('');
  const [shiftEnd, setShiftEnd] = useState<string>('');
  const [skills, setSkills] = useState<string>('');

  // 1. Fetch directories using React Query (retrieves from cache instantly)
  const { data: staffList = [] } = useQuery<Staff[]>({
    queryKey: ['staff'],
    queryFn: fetchStaff,
  });

  const { data: ticketsList = [] } = useQuery<Ticket[]>({
    queryKey: ['tickets'],
    queryFn: fetchTickets,
  });

  const selectedStaff = staffList.find(s => s._id === selectedStaffId);

  // 2. Fetch triggering chat session logs on click
  const { data: session, isLoading: loadingSession, isError: sessionError } = useQuery({
    queryKey: ['session', chatHistorySessionId],
    queryFn: () => fetchSession(chatHistorySessionId!),
    enabled: chatHistorySessionId !== null,
  });

  // Sync inputs when active selection changes
  useEffect(() => {
    if (selectedStaff) {
      setStatus(selectedStaff.status);
      setLocation(selectedStaff.currentLocation);
      setShiftStart(selectedStaff.shiftStart);
      setShiftEnd(selectedStaff.shiftEnd);
      setSkills(selectedStaff.skills.join(', '));
    }
  }, [selectedStaffId, selectedStaff]);

  // Handle opening/closing chat history overlay
  useEffect(() => {
    const dialog = chatDialogRef.current;
    if (!dialog) return;

    if (chatHistorySessionId) {
      if (!dialog.open) {
        dialog.showModal();
      }
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [chatHistorySessionId, session]);

  // Mutation for updating staff member details
  const updateStaffMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Staff> }) => updateStaff(id, updates),
    onSuccess: (data) => {
      updateStaffMember(data);
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      showSystemNotice(`Updated settings for ${data.name} successfully.`);
    },
    onError: (err) => {
      console.error(err);
      showSystemNotice('Failed to update staff member. Check backend server.');
    }
  });

  const handleSave = () => {
    if (!selectedStaff) return;

    const updates: Partial<Staff> = {
      status,
      currentLocation: location.trim(),
      shiftStart: shiftStart.trim(),
      shiftEnd: shiftEnd.trim(),
      skills: skills.split(',').map(s => s.trim()).filter(s => s.length > 0)
    };

    updateStaffMutation.mutate({ id: selectedStaff._id, updates });
  };

  const handleChatDialogBackdropClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = chatDialogRef.current;
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      const isClickedOutside = (
        event.clientY < rect.top ||
        event.clientY > rect.bottom ||
        event.clientX < rect.left ||
        event.clientX > rect.right
      );
      if (isClickedOutside) {
        setChatHistorySessionId(null);
      }
    }
  };

  const assignedTickets = ticketsList.filter(t => t.assignedTo === selectedStaffId);

  return (
    <div className="staff-portal-grid">
      {/* Left Side: Staff List */}
      <section className="panel staff-list-panel">
        <div className="panel-header">
          <h2 className="panel-title">
            <span className="material-symbols-outlined">groups</span>
            On-Site & External Directory
          </h2>
        </div>
        <div className="staff-portal-list" id="portal-staff-list">
          {staffList.length === 0 ? (
            <div className="empty-state">No technicians found in database.</div>
          ) : (
            staffList.map((person) => {
              const activeTaskCount = ticketsList.filter(
                (t) => t.assignedTo === person._id && t.status === 'Dispatched'
              ).length;

              let statusDotClass = 'offline';
              if (person.status === 'Available') statusDotClass = 'online';
              if (person.status === 'Busy') statusDotClass = 'warning';

              return (
                <div 
                  key={person._id} 
                  className={`staff-portal-card ${selectedStaffId === person._id ? 'active' : ''}`}
                  onClick={() => setSelectedStaffId(person._id)}
                >
                  <div className="staff-header">
                    <span className="staff-name staff-portal-name">
                      {person.name}
                    </span>
                    <span 
                      className={`status-indicator staff-portal-status-dot ${statusDotClass}`} 
                    />
                  </div>
                  <div className="staff-details body-sm">
                    <div>Primary: <span className="text-accent">{person.skills.join(', ')}</span></div>
                    <div>Shift: {person.shiftStart} - {person.shiftEnd}</div>
                  </div>
                  <div className="staff-footer staff-portal-footer body-xs font-mono mt-1">
                    <span className={activeTaskCount > 0 ? 'staff-workload-warning' : 'staff-workload-ok'}>
                      {activeTaskCount} active task{activeTaskCount === 1 ? '' : 's'}
                    </span>
                    <span className="muted">{person.currentLocation}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Right Side: Detail & Action Workspace */}
      <section className="panel staff-detail-panel" id="portal-detail-panel">
        {!selectedStaff ? (
          <div className="empty-state-detail">
            <span className="material-symbols-outlined empty-state-icon">
              badge
            </span>
            <p>Select a technician from the directory to manage their profile, schedule, and view history.</p>
          </div>
        ) : (
          <div className="staff-detail-workspace">
            {/* Profile / Info Header */}
            <div className="detail-section-header detail-section-header-row">
              <div>
                <h2 className="display-lg detail-section-title">{selectedStaff.name}</h2>
                <p className="body-sm font-mono muted">ID: {selectedStaff._id}</p>
              </div>
              <div>
                <button 
                  className="btn btn-primary btn-xs" 
                  id="btn-save-staff-details" 
                  onClick={handleSave}
                  disabled={updateStaffMutation.isPending}
                >
                  {updateStaffMutation.isPending ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>

            {/* Schedule & Proximity Form */}
            <div className="detail-grid">
              <div className="form-group">
                <label htmlFor="edit-staff-status">Availability Status</label>
                <div className="select-shell">
                  <select 
                    id="edit-staff-status" 
                    className="form-control-glass"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as Staff['status'])}
                  >
                    <option value="Available">Available (On-Site)</option>
                    <option value="Busy">Busy / In-Task</option>
                    <option value="Offline">Offline (Off-Site)</option>
                  </select>
                  <span className="material-symbols-outlined select-shell-icon">expand_more</span>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="edit-staff-location">Current Sector / Location</label>
                <input 
                  type="text" 
                  id="edit-staff-location" 
                  className="form-control-glass" 
                  value={location} 
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Sector B" 
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-staff-shift-start">Shift Start Time (HH:MM)</label>
                <input 
                  type="text" 
                  id="edit-staff-shift-start" 
                  className="form-control-glass" 
                  value={shiftStart} 
                  onChange={(e) => setShiftStart(e.target.value)}
                  placeholder="08:00" 
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-staff-shift-end">Shift End Time (HH:MM)</label>
                <input 
                  type="text" 
                  id="edit-staff-shift-end" 
                  className="form-control-glass" 
                  value={shiftEnd} 
                  onChange={(e) => setShiftEnd(e.target.value)}
                  placeholder="17:00" 
                />
              </div>

              <div className="form-group form-span-2">
                <label htmlFor="edit-staff-skills">Specialized Certifications / Skills (comma separated)</label>
                <input 
                  type="text" 
                  id="edit-staff-skills" 
                  className="form-control-glass" 
                  value={skills} 
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="e.g. HVAC, Electrical" 
                />
              </div>
            </div>

            {/* Work Order History */}
            <div className="history-section">
              <h3 className="headline-sm history-section-title">
                Assigned Work Order History
              </h3>
              
              <div className="history-list">
                {assignedTickets.length === 0 ? (
                  <div className="body-sm muted">No work orders have been assigned to this technician.</div>
                ) : (
                  assignedTickets.map((ticket) => {
                    let statusClass = 'chip-success';
                    if (ticket.status === 'Pending Approval') statusClass = 'chip-warning';
                    else if (ticket.status === 'Rejected') statusClass = 'chip-danger';

                    return (
                      <div 
                        key={ticket._id} 
                        className="history-row" 
                        onClick={() => {
                          if (ticket.sessionId) {
                            setChatHistorySessionId(ticket.sessionId);
                          } else {
                            showSystemNotice(`Work Order ${ticket._id.substring(0, 8).toUpperCase()} has no triggering conversation history (manually dispatched).`);
                          }
                        }}
                      >
                        <div className="history-info">
                          <span className="history-id font-mono">
                            {ticket._id.substring(0, 8).toUpperCase()}
                          </span>
                          <span className="history-desc">{ticket.description}</span>
                          <span className="history-subtext muted">{ticket.assetId} · Est: ${ticket.costEstimation}</span>
                        </div>
                        <div className="history-meta">
                          <span className={`chip ${statusClass}`}>{ticket.status}</span>
                          {ticket.sessionId ? (
                            <span className="material-symbols-outlined history-meta-icon text-accent" title="View chat trigger context">
                              forum
                            </span>
                          ) : (
                            <span className="material-symbols-outlined history-meta-icon muted" title="Manual order (no chat trace)">
                              info
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Triggering Chat History Dialog Overlay */}
      <dialog 
        className="dialog-overlay" 
        id="chat-history-overlay" 
        ref={chatDialogRef}
        onClick={handleChatDialogBackdropClick}
        aria-labelledby="chat-dialog-title"
      >
        <div className="dialog-card chat-history-card">
          <div className="dialog-header">
            <div className="dialog-title-group">
              <span className="dialog-kicker dialog-kicker-primary">
                DISPATCH CONTEXT
              </span>
              <h3 className="headline-sm" id="chat-dialog-title">Triggering Conversation Context</h3>
            </div>
            <button className="btn-close" id="btn-close-chat-dialog" onClick={() => setChatHistorySessionId(null)}>
              &times;
            </button>
          </div>
          <div className="dialog-body chat-history-body" id="chat-history-content">
            {loadingSession ? (
              <div className="dialog-loading-state">
                <div className="spinner-inline dialog-loading-spinner" />
                <p className="body-sm">Loading dispatch chat history...</p>
              </div>
            ) : sessionError || !session ? (
              <div className="body-sm text-danger text-center">
                Failed to load triggering conversation history. The session logs may have been cleared.
              </div>
            ) : !session.messages || session.messages.length === 0 ? (
              <div className="body-sm muted text-center">No messages found in this session.</div>
            ) : (
              session.messages.map((msg, idx) => {
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
              })
            )}
            <div ref={chatEndRef} />
          </div>
        </div>
      </dialog>
    </div>
  );
};
