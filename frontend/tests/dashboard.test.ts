import { describe, expect, it } from 'vitest';
import { buildDashboardMetrics, buildQueueSpotlight } from '@/utils/dashboard';
import { Staff, Ticket } from '@/types';

const sampleTickets: Ticket[] = [
  {
    _id: 'wo_001',
    tenantId: 'tenant_001',
    assetId: 'asset_roof_storefront',
    description: 'Water is dripping from the roof above the storefront entrance.',
    status: 'Pending Approval',
    assignedTo: null,
    costEstimation: 250,
    leaseResponsibility: 'Landlord',
    leaseClauseRef: 'Section 11.4',
    emergencyLevel: 'Urgent',
    timeline: [],
  },
  {
    _id: 'wo_002',
    tenantId: 'tenant_001',
    assetId: 'asset_hvac_104',
    description: 'Storefront AC unit blowing warm air.',
    status: 'Dispatched',
    assignedTo: 'staff_001',
    costEstimation: 80,
    leaseResponsibility: 'Tenant',
    leaseClauseRef: 'Section 9.1',
    emergencyLevel: 'Routine',
    timeline: [],
  },
  {
    _id: 'wo_003',
    tenantId: 'tenant_002',
    assetId: 'asset_escalator_b',
    description: 'Escalator error code E-04 requires manual lookup.',
    status: 'Completed',
    assignedTo: 'staff_002',
    costEstimation: 120,
    leaseResponsibility: 'Landlord',
    leaseClauseRef: 'Section 8.2',
    emergencyLevel: 'Routine',
    timeline: [],
  },
];

const sampleStaff: Staff[] = [
  {
    _id: 'staff_001',
    name: 'Sarah Connor',
    skills: ['HVAC', 'Electrical'],
    status: 'Available',
    currentLocation: 'Sector B',
    shiftStart: '08:00',
    shiftEnd: '17:00',
    ratePerHour: 45,
  },
  {
    _id: 'staff_002',
    name: 'Jamie Rivera',
    skills: ['Roofing', 'Plumbing'],
    status: 'Busy',
    currentLocation: 'Sector B',
    shiftStart: '09:00',
    shiftEnd: '18:00',
    ratePerHour: 55,
  },
];

describe('dashboard summaries', () => {
  it('builds aggregate queue metrics', () => {
    const metrics = buildDashboardMetrics(sampleTickets, sampleStaff);

    expect(metrics.totalTickets).toBe(3);
    expect(metrics.pendingApprovals).toBe(1);
    expect(metrics.dispatchedTickets).toBe(1);
    expect(metrics.activeTickets).toBe(2);
    expect(metrics.availableStaff).toBe(1);
    expect(metrics.fieldReadinessPct).toBe(50);
    expect(metrics.straightThroughRate).toBe(67);
    expect(metrics.blockedSpend).toBe(250);
    expect(metrics.busiestSector).toBe('Sector B');
  });

  it('selects the highest-signal queue spotlight', () => {
    const spotlight = buildQueueSpotlight(sampleTickets, sampleStaff);

    expect(spotlight?.ticket._id).toBe('wo_001');
    expect(spotlight?.recommendedAction).toContain('Review approval');
    expect(spotlight?.reasons.join(' ')).toContain('blocked behind HITL review');
    expect(spotlight?.matchingStaffSummary).toContain('No available Roofing/Plumbing specialist');
  });
});
