import React, { useState, useEffect } from 'react';
import { Ticket, Staff } from '@/types';
import { useStore, tenantNameMap } from '@/state/store';
import { useQuery } from '@tanstack/react-query';
import { fetchTickets, fetchStaff } from '@/api/client';
import { buildDashboardMetrics, buildQueueSpotlight } from '@/utils/dashboard';

/**
 * Props definition for the Dashboard component.
 */
export interface DashboardProps {
  /** Callback triggered when a manager clicks "Review Approval" for a ticket. */
  onReviewTicket: (ticket: Ticket) => void;
}

/**
 * Component managing the main dashboard/command ledger panel.
 * 
 * @param props Component parameters.
 * @returns The rendered Dashboard React element.
 */
export const Dashboard: React.FC<DashboardProps> = ({ onReviewTicket }) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'dispatched' | 'completed'>('all');
  const setDashboardData = useStore((state) => state.setDashboardData);

  // 1. Fetch tickets and staff using React Query with a 10s auto-polling interval
  const { data: tickets = [], isError: ticketsError } = useQuery<Ticket[]>({
    queryKey: ['tickets'],
    queryFn: fetchTickets,
    refetchInterval: 10000,
  });

  const { data: staff = [], isError: staffError } = useQuery<Staff[]>({
    queryKey: ['staff'],
    queryFn: fetchStaff,
    refetchInterval: 10000,
  });

  // 2. Synchronize fetched query results with the Zustand store for compatibility
  useEffect(() => {
    if (tickets.length > 0 || staff.length > 0) {
      setDashboardData(tickets, staff);
    }
  }, [tickets, staff, setDashboardData]);

  // 3. Compute KPI Metrics
  const metrics = buildDashboardMetrics(tickets, staff);
  const spotlight = buildQueueSpotlight(tickets, staff);

  // 4. Apply filter chips
  const filteredTickets = tickets.filter(ticket => {
    if (activeFilter === 'pending') return ticket.status === 'Pending Approval';
    if (activeFilter === 'dispatched') return ticket.status === 'Dispatched';
    if (activeFilter === 'completed') return ticket.status === 'Completed' || ticket.status === 'Rejected';
    // default 'all' filter shows open/active tickets
    return ticket.status !== 'Completed' && ticket.status !== 'Rejected';
  });

  return (
    <div className="dashboard-content">
      {/* KPI Grid */}
      <section className="metrics-grid">
        <div className="metric-card">
            <div className="metric-header">
              <div className="metric-label-group">
                <span className="metric-icon material-symbols-outlined">receipt_long</span>
                <span className="label-sm uppercase muted">Total Work Orders</span>
              </div>
              <span className="trend-badge positive">Live</span>
            </div>
          <span className="metric-value" id="kpi-total-orders">{metrics.totalTickets}</span>
          <div className="metric-progress bg-primary"></div>
        </div>
        <div className="metric-card">
          <div className="metric-header">
            <div className="metric-label-group">
              <span className="metric-icon material-symbols-outlined">approval_delegation</span>
              <span className="label-sm uppercase muted">Pending Approval (HITL)</span>
            </div>
            <span className={`trend-badge warning ${metrics.pendingApprovals > 0 ? 'blink' : ''}`} id="kpi-pending-badge">
              {metrics.pendingApprovals} Pending
            </span>
          </div>
          <span className="metric-value text-warning" id="kpi-pending-orders">{metrics.pendingApprovals}</span>
          <div className="metric-progress bg-warning"></div>
        </div>
        <div className="metric-card">
          <div className="metric-header">
            <div className="metric-label-group">
              <span className="metric-icon material-symbols-outlined">local_shipping</span>
              <span className="label-sm uppercase muted">Straight-Through Routing</span>
            </div>
            <span className="trend-badge positive">{metrics.straightThroughRate}% Routed</span>
          </div>
          <span className="metric-value text-success" id="kpi-dispatched-orders">{metrics.dispatchedTickets}</span>
          <div className="metric-progress bg-success"></div>
        </div>
        <div className="metric-card">
          <div className="metric-header">
            <div className="metric-label-group">
              <span className="metric-icon material-symbols-outlined">engineering</span>
              <span className="label-sm uppercase muted">Field Readiness</span>
            </div>
            <span className="trend-badge positive">{metrics.availableStaff} Available</span>
          </div>
          <span className="metric-value" id="kpi-field-readiness">{metrics.fieldReadinessPct}%</span>
          <div className="metric-progress bg-primary"></div>
        </div>
      </section>

      <section className="dashboard-brief-grid">
        <article className="panel dashboard-brief-card">
          <div className="panel-header panel-header-spaced">
            <div>
              <h2 className="panel-title">
                <span className="material-symbols-outlined">overview</span>
                Autonomy brief
              </h2>
              <p className="panel-copy">
                Operio is strongest when it converts fragmented mall operations into a single queue with visible liability, staffing, and approval risk.
              </p>
            </div>
            <span className="status-pill neutral">
              {metrics.busiestSector ? `${metrics.busiestSector} busiest` : 'Live telemetry'}
            </span>
          </div>

          <div className="brief-stat-grid">
            <div className="brief-stat-card">
              <span className="brief-stat-label">Open incidents</span>
              <strong>{metrics.activeTickets}</strong>
            </div>
            <div className="brief-stat-card">
              <span className="brief-stat-label">Approval exposure</span>
              <strong>${metrics.blockedSpend}</strong>
            </div>
            <div className="brief-stat-card">
              <span className="brief-stat-label">Routing without manager touch</span>
              <strong>{metrics.straightThroughRate}%</strong>
            </div>
          </div>

          <p className="dashboard-brief-note">
            The strongest live proof path is still: tenant conversation, lease/manual retrieval, MCP trace, then approval gating only when landlord liability and cost justify human review.
          </p>
        </article>

        <article className="panel dashboard-spotlight-card">
          <div className="panel-header panel-header-spaced">
            <div>
              <h2 className="panel-title">
                <span className="material-symbols-outlined">target</span>
                Queue spotlight
              </h2>
              <p className="panel-copy">
                Surface the incident that best shows where automation, guardrails, and field operations converge.
              </p>
            </div>
            {spotlight ? (
              <span className={`status-pill ${spotlight.ticket.status === 'Pending Approval' ? 'warning' : 'success'}`}>
                {spotlight.ticket.status}
              </span>
            ) : null}
          </div>

          {spotlight ? (
            <div className="spotlight-body">
              <div className="spotlight-topline">
                <span className="spotlight-tenant">{tenantNameMap[spotlight.ticket.tenantId] || spotlight.ticket.tenantId}</span>
                <span className="spotlight-cost">${spotlight.ticket.costEstimation}</span>
              </div>
              <h3 className="spotlight-title">{spotlight.ticket.description}</h3>
              <div className="spotlight-chip-row">
                <span className="chip chip-primary">{spotlight.ticket.assetId}</span>
                <span className="chip chip-warning">{spotlight.ticket.emergencyLevel}</span>
                <span className="chip chip-success">{spotlight.ticket.leaseResponsibility}</span>
              </div>
              <p className="spotlight-action">{spotlight.recommendedAction}</p>
              <div className="spotlight-reasons">
                {spotlight.reasons.map((reason) => (
                  <div key={reason} className="spotlight-reason">
                    <span className="material-symbols-outlined">subdirectory_arrow_right</span>
                    <span>{reason}</span>
                  </div>
                ))}
              </div>
              <div className="spotlight-staff-note">
                <span className="material-symbols-outlined">groups</span>
                <span>{spotlight.matchingStaffSummary}</span>
              </div>
              {spotlight.ticket.status === 'Pending Approval' ? (
                <button
                  className="btn btn-secondary btn-xs"
                  type="button"
                  onClick={() => onReviewTicket(spotlight.ticket)}
                >
                  Review approval
                </button>
              ) : null}
            </div>
          ) : (
            <div className="empty-state">No active incidents to spotlight.</div>
          )}
        </article>
      </section>

      {/* Dashboard Workspace */}
      <div className="workspace-grid">
        {/* Queue Panel */}
        <section className="panel main-panel">
          <div className="panel-header">
            <h2 className="panel-title">
              <span className="material-symbols-outlined">fact_check</span>
              Operational Queue
            </h2>
            <div className="filter-actions">
              <button 
                className={`chip ${activeFilter === 'all' ? 'active-filter' : ''}`} 
                id="filter-all"
                onClick={() => setActiveFilter('all')}
              >
                Active Queue
              </button>
              <button 
                className={`chip ${activeFilter === 'pending' ? 'active-filter' : ''}`} 
                id="filter-pending"
                onClick={() => setActiveFilter('pending')}
              >
                Pending Approval
              </button>
              <button 
                className={`chip ${activeFilter === 'dispatched' ? 'active-filter' : ''}`} 
                id="filter-dispatched"
                onClick={() => setActiveFilter('dispatched')}
              >
                Dispatched
              </button>
              <button 
                className={`chip ${activeFilter === 'completed' ? 'active-filter' : ''}`} 
                id="filter-completed"
                onClick={() => setActiveFilter('completed')}
              >
                Closed & Completed
              </button>
            </div>
          </div>
          <div className="ticket-list" id="dashboard-ticket-list">
            {ticketsError ? (
              <div className="empty-state text-danger">Failed to retrieve operational queue.</div>
            ) : filteredTickets.length === 0 ? (
              <div className="empty-state">No tickets in this category.</div>
            ) : (
              filteredTickets.map(ticket => {
                let statusClass = 'chip-primary';
                if (ticket.status === 'Pending Approval') statusClass = 'chip-warning';
                else if (ticket.status === 'Rejected') statusClass = 'chip-danger';
                else if (ticket.status === 'Completed') statusClass = 'chip-success';

                const isPending = ticket.status === 'Pending Approval';
                const tenantName = tenantNameMap[ticket.tenantId] || ticket.tenantId;

                return (
                  <div key={ticket._id} className="ticket-row card">
                    <div className="ticket-info">
                      <span className="ticket-id font-mono">
                        {ticket._id.substring(0, 8).toUpperCase()}
                      </span>
                      <span className="ticket-title">{ticket.description}</span>
                      <span className="ticket-subtext muted">
                        {tenantName} · {ticket.assetId} · Estimated Cost: ${ticket.costEstimation}
                      </span>
                    </div>
                    <div className="ticket-meta">
                      <span className={`chip ${statusClass}`}>{ticket.status}</span>
                      {isPending && (
                        <button 
                          className="btn btn-secondary btn-xs btn-action-hitl" 
                          onClick={() => onReviewTicket(ticket)}
                        >
                          Review Approval
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Active Technicians Side Panel */}
        <aside className="panel side-panel">
          <div className="panel-header">
            <h2 className="panel-title">
              <span className="material-symbols-outlined">groups</span>
              Staff Status
            </h2>
          </div>
          <div className="staff-list" id="dashboard-staff-list">
            {staffError ? (
              <div className="empty-state text-danger">Failed to retrieve staff status.</div>
            ) : staff.length === 0 ? (
              <div className="empty-state">No staff on-site.</div>
            ) : (
              staff.map(person => {
                const assignedWOs = tickets.filter(
                  t => t.assignedTo === person._id && t.status === 'Dispatched'
                ).length;

                return (
                  <div key={person._id} className="staff-card card">
                    <div className="staff-header">
                      <span className="staff-name">{person.name}</span>
                      <span className={`staff-status-dot ${person.status === 'Available' ? 'online' : person.status === 'Busy' ? 'warning' : 'offline'}`} />
                    </div>
                    <div className="staff-details body-sm">
                      <div>
                        Skills: <span className="text-accent">{person.skills.join(', ')}</span>
                      </div>
                      <div>
                        Sector: <span className="text-accent">{person.currentLocation}</span>
                      </div>
                      <div>
                        Shift: {person.shiftStart} - {person.shiftEnd} (${person.ratePerHour}/hr)
                      </div>
                    </div>
                    <div className="staff-footer">
                      {assignedWOs > 0 ? (
                        <span className="staff-workload text-warning">{assignedWOs} active task(s)</span>
                      ) : (
                        <span className="staff-workload text-success">Idle</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
