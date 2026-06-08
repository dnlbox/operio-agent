import { Staff, Ticket } from '@/types';

const closedStatuses = new Set<Ticket['status']>(['Completed', 'Rejected']);

const severityWeights: Record<Ticket['emergencyLevel'], number> = {
  Routine: 1,
  Urgent: 2,
  Emergency: 3,
};

const statusWeights: Record<Ticket['status'], number> = {
  Created: 1,
  'In Progress': 2,
  'Pending Approval': 3,
  Dispatched: 2,
  Completed: 0,
  Rejected: 0,
};

const assetSkillSignals: Array<{ keyword: string; skill: string }> = [
  { keyword: 'hvac', skill: 'HVAC' },
  { keyword: 'air', skill: 'HVAC' },
  { keyword: 'roof', skill: 'Roofing' },
  { keyword: 'water', skill: 'Plumbing' },
  { keyword: 'pipe', skill: 'Plumbing' },
  { keyword: 'electrical', skill: 'Electrical' },
  { keyword: 'lighting', skill: 'Electrical' },
  { keyword: 'escalator', skill: 'Escalator' },
  { keyword: 'elevator', skill: 'Elevator' },
];

/**
 * Aggregated dashboard metrics used to summarize queue health and staffing.
 */
export interface DashboardMetrics {
  totalTickets: number;
  pendingApprovals: number;
  activeTickets: number;
  dispatchedTickets: number;
  availableStaff: number;
  fieldReadinessPct: number;
  straightThroughRate: number;
  blockedSpend: number;
  busiestSector: string | null;
}

/**
 * Curated summary for the single most important queue item to surface.
 */
export interface QueueSpotlight {
  ticket: Ticket;
  recommendedAction: string;
  matchingStaffSummary: string;
  reasons: string[];
}

const inferTicketSkills = (ticket: Ticket): string[] => {
  const haystack = `${ticket.assetId} ${ticket.description}`.toLowerCase();

  return Array.from(
    new Set(
      assetSkillSignals
        .filter((signal) => haystack.includes(signal.keyword))
        .map((signal) => signal.skill)
    )
  );
};

const countByLocation = (staff: Staff[]): Record<string, number> =>
  staff.reduce<Record<string, number>>((counts, person) => ({
    ...counts,
    [person.currentLocation]: (counts[person.currentLocation] ?? 0) + 1,
  }), {});

const getBusiestSector = (staff: Staff[]): string | null => {
  const entries = Object.entries(countByLocation(staff));
  if (entries.length === 0) {
    return null;
  }

  const [sector] = entries.sort((left, right) => right[1] - left[1])[0];
  return sector;
};

const getPriorityScore = (ticket: Ticket): number => {
  const pendingBoost = ticket.status === 'Pending Approval' ? 3 : 0;
  const liabilityBoost = ticket.leaseResponsibility === 'Landlord' ? 2 : 0;
  const costBoost = ticket.costEstimation >= 500 ? 1 : 0;

  return (
    severityWeights[ticket.emergencyLevel] +
    statusWeights[ticket.status] +
    pendingBoost +
    liabilityBoost +
    costBoost
  );
};

/**
 * Calculates high-signal queue and staffing metrics for the command dashboard.
 *
 * @param tickets Current work-order dataset.
 * @param staff Current technician roster.
 * @returns Aggregate metrics suitable for executive-style summaries.
 */
export const buildDashboardMetrics = (tickets: Ticket[], staff: Staff[]): DashboardMetrics => {
  const totalTickets = tickets.length;
  const pendingApprovals = tickets.filter((ticket) => ticket.status === 'Pending Approval').length;
  const activeTickets = tickets.filter((ticket) => !closedStatuses.has(ticket.status)).length;
  const dispatchedTickets = tickets.filter((ticket) => ticket.status === 'Dispatched').length;
  const availableStaff = staff.filter((person) => person.status === 'Available').length;
  const straightThroughCount = tickets.filter((ticket) => ticket.status !== 'Pending Approval').length;
  const blockedSpend = tickets
    .filter((ticket) => ticket.status === 'Pending Approval')
    .reduce((sum, ticket) => sum + ticket.costEstimation, 0);

  return {
    totalTickets,
    pendingApprovals,
    activeTickets,
    dispatchedTickets,
    availableStaff,
    fieldReadinessPct: staff.length === 0 ? 0 : Math.round((availableStaff / staff.length) * 100),
    straightThroughRate: totalTickets === 0 ? 0 : Math.round((straightThroughCount / totalTickets) * 100),
    blockedSpend,
    busiestSector: getBusiestSector(staff),
  };
};

/**
 * Selects the queue item that best illustrates operational risk or agent value.
 *
 * @param tickets Current work-order dataset.
 * @param staff Current technician roster.
 * @returns A single spotlight summary or null when the queue is empty.
 */
export const buildQueueSpotlight = (tickets: Ticket[], staff: Staff[]): QueueSpotlight | null => {
  const activeTickets = tickets.filter((ticket) => !closedStatuses.has(ticket.status));
  if (activeTickets.length === 0) {
    return null;
  }

  const ticket = [...activeTickets].sort((left, right) => getPriorityScore(right) - getPriorityScore(left))[0];
  const inferredSkills = inferTicketSkills(ticket);
  const matchingStaff = staff.filter((person) => (
    person.status === 'Available' &&
    inferredSkills.some((skill) => person.skills.includes(skill))
  ));

  const recommendedAction = ticket.status === 'Pending Approval'
    ? 'Review approval packet and assign a technician.'
    : ticket.status === 'Dispatched'
      ? 'Monitor field execution and confirm completion evidence.'
      : 'Advance the incident before it compounds downtime.';

  const matchingStaffSummary = matchingStaff.length > 0
    ? `${matchingStaff.length} available technician${matchingStaff.length === 1 ? '' : 's'} match ${inferredSkills.join(', ')}.`
    : inferredSkills.length > 0
      ? `No available ${inferredSkills.join('/')} specialist is currently free.`
      : 'No direct skill inference available from the incident text.';

  const reasons = [
    ticket.emergencyLevel === 'Emergency'
      ? 'Emergency severity makes tenant downtime immediately visible.'
      : `${ticket.emergencyLevel} severity still requires active queue attention.`,
    ticket.leaseResponsibility === 'Landlord'
      ? 'Landlord liability means approval latency directly affects mall operations.'
      : ticket.leaseResponsibility === 'Unknown'
        ? 'Liability is still unresolved because the issue crosses a fixture-versus-infrastructure demarcation.'
      : `Lease responsibility is currently assigned to the ${ticket.leaseResponsibility.toLowerCase()}.`,
    ticket.status === 'Pending Approval'
      ? `Estimated cost of $${ticket.costEstimation} is currently blocked behind HITL review.`
      : `${ticket.status} status shows the agent has already advanced the request.`,
  ];

  return {
    ticket,
    recommendedAction,
    matchingStaffSummary,
    reasons,
  };
};
