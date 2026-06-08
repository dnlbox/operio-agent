import React, { useState, useEffect } from 'react';
import { Ticket, Staff } from '@/types';
import { useStore, tenantNameMap } from '@/state/store';
import { useQuery } from '@tanstack/react-query';
import { fetchTickets, fetchStaff } from '@/api/client';

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
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'dispatched'>('all');
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
  const total = tickets.length;
  const pending = tickets.filter(t => t.status === 'Pending Approval').length;
  const dispatched = tickets.filter(t => t.status === 'Dispatched').length;

  // 4. Apply filter chips
  const filteredTickets = tickets.filter(ticket => {
    if (activeFilter === 'pending') return ticket.status === 'Pending Approval';
    if (activeFilter === 'dispatched') return ticket.status === 'Dispatched';
    return true;
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
          <span className="metric-value" id="kpi-total-orders">{total}</span>
          <div className="metric-progress bg-primary"></div>
        </div>
        <div className="metric-card">
          <div className="metric-header">
            <div className="metric-label-group">
              <span className="metric-icon material-symbols-outlined">approval_delegation</span>
              <span className="label-sm uppercase muted">Pending Approval (HITL)</span>
            </div>
            <span className={`trend-badge warning ${pending > 0 ? 'blink' : ''}`} id="kpi-pending-badge">
              {pending} Pending
            </span>
          </div>
          <span className="metric-value text-warning" id="kpi-pending-orders">{pending}</span>
          <div className="metric-progress bg-warning"></div>
        </div>
        <div className="metric-card">
          <div className="metric-header">
            <div className="metric-label-group">
              <span className="metric-icon material-symbols-outlined">local_shipping</span>
              <span className="label-sm uppercase muted">Auto-Dispatched</span>
            </div>
            <span className="trend-badge positive">Uptime 100%</span>
          </div>
          <span className="metric-value text-success" id="kpi-dispatched-orders">{dispatched}</span>
          <div className="metric-progress bg-success"></div>
        </div>
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
                All
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
            </div>
          </div>
          <div className="ticket-list" id="dashboard-ticket-list">
            {ticketsError ? (
              <div className="empty-state text-danger">Failed to retrieve operational queue.</div>
            ) : filteredTickets.length === 0 ? (
              <div className="empty-state">No tickets in this category.</div>
            ) : (
              filteredTickets.map(ticket => {
                let statusClass = 'chip-success';
                if (ticket.status === 'Pending Approval') statusClass = 'chip-warning';
                else if (ticket.status === 'Rejected') statusClass = 'chip-danger';
                else if (ticket.status === 'Created') statusClass = 'chip-primary';

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
