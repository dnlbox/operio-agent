import React, { useState, useEffect, useRef } from 'react';
import { Ticket, Staff } from '@/types';
import { useStore, tenantNameMap } from '@/state/store';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { approveTicket, rejectTicket } from '@/api/client';
import { showSystemNotice } from '@/utils/dom';

/**
 * Props definition for the HitlOverlay component.
 */
export interface HitlOverlayProps {
  /** The ticket currently being inspected, or null if closed. */
  ticket: Ticket | null;
  /** The list of technicians available for assignment. */
  staff: Staff[];
  /** Reference citation mappings. */
  citations: Record<string, string>;
  /** Callback triggered when a lease clause ref is clicked. */
  onCitationRequest: (ref: string) => void;
  /** Callback triggered to close the overlay. */
  onClose: () => void;
}

/**
 * Component managing the Human-in-the-Loop manager dispatch approval popup modal.
 * 
 * @param props Component parameters.
 * @returns The rendered HitlOverlay React element.
 */
export const HitlOverlay: React.FC<HitlOverlayProps> = ({
  ticket,
  staff,
  citations,
  onCitationRequest,
  onClose,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const queryClient = useQueryClient();

  const activeHitlTab = useStore((state) => state.activeHitlTab);
  const setHitlTab = useStore((state) => state.setHitlTab);

  const [cost, setCost] = useState<number>(0);
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const isOpen = ticket !== null;

  // Initialize form fields when the ticket opens/changes
  useEffect(() => {
    if (ticket) {
      setCost(ticket.costEstimation);
      setNotes('');

      // Filter staff list to only show technicians with matching required skills first
      let skillNeeded = 'HVAC';
      const descLower = ticket.description.toLowerCase();
      const assetLower = ticket.assetId.toLowerCase();
      
      if (assetLower.includes('escalator')) skillNeeded = 'Escalator';
      if (assetLower.includes('plumbing') || descLower.includes('leak') || descLower.includes('pipe')) skillNeeded = 'Plumbing';
      if (descLower.includes('light') || descLower.includes('electrical') || descLower.includes('wiring')) skillNeeded = 'Electrical';

      const matchedTech = staff.find(person => person.skills.includes(skillNeeded));
      if (matchedTech) {
        setAssigneeId(matchedTech._id);
      } else if (staff.length > 0) {
        setAssigneeId(staff[0]._id);
      }
    }
  }, [ticket, staff]);

  // Handle opening/closing native dialog
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  const approveMutation = useMutation({
    mutationFn: ({ ticketId, assignedTo, costEstimation, managerNotes }: {
      ticketId: string;
      assignedTo: string | null;
      costEstimation: number;
      managerNotes: string;
    }) => approveTicket(ticketId, assignedTo, costEstimation, managerNotes),
    onSuccess: (data) => {
      if (data.success) {
        showSystemNotice('Work order successfully dispatched.');
        queryClient.invalidateQueries({ queryKey: ['tickets'] });
        queryClient.invalidateQueries({ queryKey: ['staff'] });
        onClose();
      } else {
        alert('Failed to submit approval.');
      }
    },
    onError: (err) => {
      console.error(err);
      alert('Error submitting approval.');
    }
  });

  const rejectMutation = useMutation({
    mutationFn: (ticketId: string) => rejectTicket(ticketId),
    onSuccess: (data) => {
      if (data.success) {
        showSystemNotice('Work order cancelled.');
        queryClient.invalidateQueries({ queryKey: ['tickets'] });
        queryClient.invalidateQueries({ queryKey: ['staff'] });
        onClose();
      } else {
        alert('Failed to cancel order.');
      }
    },
    onError: (err) => {
      console.error(err);
      alert('Error cancelling order.');
    }
  });

  const handleApprove = () => {
    if (!ticket) return;
    approveMutation.mutate({
      ticketId: ticket._id,
      assignedTo: assigneeId || null,
      costEstimation: cost,
      managerNotes: notes,
    });
  };

  const handleReject = () => {
    if (!ticket) return;
    rejectMutation.mutate(ticket._id);
  };

  const handleBackdropClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      const isClickedOutside = (
        event.clientY < rect.top ||
        event.clientY > rect.bottom ||
        event.clientX < rect.left ||
        event.clientX > rect.right
      );
      if (isClickedOutside) {
        onClose();
      }
    }
  };

  if (!ticket) return null;

  const ref = ticket.leaseClauseRef || 'Section 9.1';
  const citationText = citations[ref] || 'No lease clause reference attached.';
  const citationQuote = citationText.split('\n').slice(1).join(' ');

  // Sort staff: matching skills first
  let skillNeeded = 'HVAC';
  const descLower = ticket.description.toLowerCase();
  const assetLower = ticket.assetId.toLowerCase();
  if (assetLower.includes('escalator')) skillNeeded = 'Escalator';
  if (assetLower.includes('plumbing') || descLower.includes('leak') || descLower.includes('pipe')) skillNeeded = 'Plumbing';
  if (descLower.includes('light') || descLower.includes('electrical') || descLower.includes('wiring')) skillNeeded = 'Electrical';

  const matchingTechs = staff.filter(person => person.skills.includes(skillNeeded));
  const fallbackTechs = staff.filter(person => !person.skills.includes(skillNeeded));

  // Generate payload preview (bearer token redacted to prevent leak)
  const payloadPreview = {
    cmms_integration: {
      vendor_api_target: 'https://api.yardi-voyager.com/v2/workorders/dispatch',
      http_method: 'POST',
      payload_headers: {
        'Authorization': 'Bearer yrdi_auth_tkn_REDACTED',
        'Content-Type': 'application/json'
      },
      payload_body: {
        source: 'Operio-Dispatcher-Agent',
        workOrderReference: `WO-${ticket._id.substring(0, 6).toUpperCase()}`,
        chargeCode: 'CAM-OPERATIONAL-EXPENSE',
        authorizedCostLimit: cost,
        dispatchMethod: 'DIRECT_VENDOR_API',
        vendorRecord: {
          vendorId: assigneeId,
          vendorName: staff.find(s => s._id === assigneeId)?.name || 'Unassigned',
          skillsAssigned: staff.find(s => s._id === assigneeId)?.skills || []
        },
        incidentDetails: {
          facilityId: 'OPERIO-GTAPLAZA-B',
          unitNumber: 'Unit 104',
          description: ticket.description,
          leaseClauseMatch: ref
        },
        autoDispatched: false,
        approvalManagerContext: {
          notes: notes || 'Authorized by property command center',
          actionTimestamp: new Date().toISOString()
        }
      }
    }
  };

  return (
    <dialog 
      className="dialog-overlay" 
      id="hitl-overlay" 
      ref={dialogRef}
      onClick={handleBackdropClick}
      aria-labelledby="dialog-title"
    >
      <div className="dialog-card">
        <div className="dialog-header">
          <div className="dialog-title-group">
            <span className="label-xs uppercase tracking" style={{ color: 'var(--color-warning)' }}>
              HITL ESCALATION
            </span>
            <h3 className="headline-sm" id="dialog-title">Manager Dispatch Authorization</h3>
          </div>
          <button className="btn-close" id="btn-close-dialog" onClick={onClose}>
            &times;
          </button>
        </div>
        
        <div className="dialog-body">
          <div className="ticket-summary-card">
            <div className="summary-row">
              <span className="summary-label">Work Order ID:</span>
              <span className="summary-val font-mono text-accent">
                {ticket._id.substring(0, 8).toUpperCase()}
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Tenant:</span>
              <span className="summary-val">
                {tenantNameMap[ticket.tenantId] || ticket.tenantId}
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Description:</span>
              <span className="summary-val">{ticket.description}</span>
            </div>
          </div>

          <div className="tab-header">
            <button 
              className={`tab-btn ${activeHitlTab === 'inputs' ? 'active' : ''}`}
              onClick={() => setHitlTab('inputs')}
            >
              Adjust Parameters
            </button>
            <button 
              className={`tab-btn ${activeHitlTab === 'payload' ? 'active' : ''}`}
              onClick={() => setHitlTab('payload')}
            >
              CMMS Payload Preview
            </button>
          </div>

          {activeHitlTab === 'inputs' ? (
            <div className="tab-content" id="tab-content-inputs">
              <div className="form-row">
                <label className="label-sm uppercase muted" htmlFor="hitl-cost">
                  Authorized Cost Estimation ($)
                </label>
                <input 
                  type="number" 
                  id="hitl-cost" 
                  value={cost} 
                  onChange={(e) => setCost(parseFloat(e.target.value) || 0)}
                  step="10" 
                  className="dialog-input" 
                />
              </div>
              
              <div className="form-row">
                <label className="label-sm uppercase muted" htmlFor="hitl-assignee">
                  Assign Technician
                </label>
                <select 
                  id="hitl-assignee" 
                  className="dialog-input"
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                >
                  {matchingTechs.map(tech => (
                    <option key={tech._id} value={tech._id}>
                      {tech.name} (Matched Skill: {skillNeeded} · proximity: {tech.currentLocation})
                    </option>
                  ))}
                  {fallbackTechs.map(tech => (
                    <option key={tech._id} value={tech._id}>
                      {tech.name} (Skills: {tech.skills.join(', ')})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <label className="label-sm uppercase muted" htmlFor="hitl-notes">
                  Override / Dispatch Notes
                </label>
                <textarea 
                  id="hitl-notes" 
                  className="dialog-input" 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add directives for the technician..."
                />
              </div>
            </div>
          ) : (
            <div className="tab-content" id="tab-content-payload">
              <div className="payload-preview-container">
                <pre className="font-mono" id="hitl-payload-preview">
                  {JSON.stringify(payloadPreview, null, 2)}
                </pre>
              </div>
              <p className="label-xs muted mt-1">
                Generated JSON ready for Yardi Voyager / ServiceChannel API endpoints.
              </p>
            </div>
          )}

          <div className="audit-quote">
            <div className="quote-header">
              <span className="label-xs uppercase tracking" style={{ color: 'var(--color-warning)' }}>
                Lease Clause Ref
              </span>
              <span 
                className="citation-link" 
                id="hitl-clause-ref"
                onClick={() => onCitationRequest(ref)}
                style={{ cursor: 'pointer' }}
              >
                {ref}
              </span>
            </div>
            <blockquote id="hitl-clause-quote">{citationQuote}</blockquote>
          </div>
        </div>
        
        <div className="dialog-footer">
          <button 
            className="btn btn-secondary" 
            id="btn-hitl-reject" 
            onClick={handleReject}
            disabled={approveMutation.isPending || rejectMutation.isPending}
          >
            Cancel Order
          </button>
          <button 
            className="btn btn-primary" 
            id="btn-hitl-approve" 
            onClick={handleApprove}
            disabled={approveMutation.isPending || rejectMutation.isPending}
          >
            {approveMutation.isPending ? 'Approving...' : 'Approve Dispatch'}
          </button>
        </div>
      </div>
    </dialog>
  );
};
