import React, { useState } from 'react';
import { tenantNameMap, tenantUnitMap, useStore } from '@/state/store';

type IntakeUrgency = 'Routine' | 'Urgent' | 'Emergency';
type IntakeCategory = 'Roof / Structural' | 'HVAC' | 'Electrical' | 'Plumbing' | 'Life Safety';

interface IntakeDraft {
  assetId: string;
  category: IntakeCategory;
  summary: string;
  location: string;
  urgency: IntakeUrgency;
  estimatedCost: string;
  requestedOutcome: string;
  attachments: string;
}

const initialDraft: IntakeDraft = {
  assetId: 'asset_roof_storefront',
  category: 'Roof / Structural',
  summary: 'Water is dripping from the roof above the storefront entrance during active rain.',
  location: 'Front entrance canopy above Unit 104',
  urgency: 'Urgent',
  estimatedCost: '250',
  requestedOutcome: 'Landlord approval requested before dispatch to structural vendor.',
  attachments: '2 mobile photos, timestamped incident note, contractor estimate',
};

const comparisonSignals = [
  {
    icon: 'forum',
    title: 'Conversational flow',
    highlight: 'Higher flexibility',
    body: 'Best when the tenant is unsure what matters and the agent must infer liability, duplicates, and next steps.',
  },
  {
    icon: 'assignment',
    title: 'Structured flow',
    highlight: 'Higher determinism',
    body: 'Best when the tenant can provide known fields up front and the landlord needs a clean approval brief.',
  },
];

/**
 * Compares conversational and structured order-intake flows while generating
 * a landlord-facing structured report preview from deterministic inputs.
 *
 * @returns The rendered intake comparison workspace.
 */
export const IntakeStudio: React.FC = () => {
  const currentTenant = useStore((state) => state.currentTenant);
  const weather = useStore((state) => state.weather);
  const [draft, setDraft] = useState<IntakeDraft>(initialDraft);

  const tenantName = tenantNameMap[currentTenant] || currentTenant;
  const tenantUnit = tenantUnitMap[currentTenant] || 'Unit Unknown';
  const estimatedCost = Number(draft.estimatedCost || '0');
  const requiresApproval = estimatedCost > 150;
  const recommendedTrack = requiresApproval ? 'Structured landlord approval brief' : 'Conversational dispatch flow';

  const reportSummary = [
    `${tenantName} (${tenantUnit}) submitted a structured service request for ${draft.category.toLowerCase()}.`,
    `The reported asset/location is "${draft.location}" with asset reference ${draft.assetId}.`,
    `The tenant-provided summary is: ${draft.summary}`,
    `Requested handling: ${draft.requestedOutcome}`,
  ].join(' ');

  const handleUpdate = <K extends keyof IntakeDraft>(key: K, value: IntakeDraft[K]) => {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  };

  return (
    <div className="intake-studio">
      <section className="flow-overview">
        {comparisonSignals.map((signal) => (
          <article key={signal.title} className="flow-card">
            <div className="flow-card-icon">
              <span className="material-symbols-outlined">{signal.icon}</span>
            </div>
            <div className="flow-card-copy">
              <span className="eyebrow">{signal.title}</span>
              <h3>{signal.highlight}</h3>
              <p>{signal.body}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="lab-shell">
        <div className="panel intake-form-panel">
          <div className="panel-header panel-header-spaced">
            <div>
              <h2 className="panel-title">
                <span className="material-symbols-outlined">note_stack</span>
                Structured intake form
              </h2>
              <p className="panel-copy">
                Capture known facts first, then generate a landlord-ready approval report with less inference.
              </p>
            </div>
            <span className="status-pill neutral">Deterministic-first</span>
          </div>

          <div className="form-grid form-grid-2">
            <label className="form-stack">
              <span className="field-label">Issue category</span>
              <select
                className="form-control-glass"
                value={draft.category}
                onChange={(event) => handleUpdate('category', event.target.value as IntakeCategory)}
              >
                <option value="Roof / Structural">Roof / Structural</option>
                <option value="HVAC">HVAC</option>
                <option value="Electrical">Electrical</option>
                <option value="Plumbing">Plumbing</option>
                <option value="Life Safety">Life Safety</option>
              </select>
            </label>

            <label className="form-stack">
              <span className="field-label">Urgency</span>
              <select
                className="form-control-glass"
                value={draft.urgency}
                onChange={(event) => handleUpdate('urgency', event.target.value as IntakeUrgency)}
              >
                <option value="Routine">Routine</option>
                <option value="Urgent">Urgent</option>
                <option value="Emergency">Emergency</option>
              </select>
            </label>

            <label className="form-stack">
              <span className="field-label">Asset reference</span>
              <input
                className="form-control-glass"
                value={draft.assetId}
                onChange={(event) => handleUpdate('assetId', event.target.value)}
              />
            </label>

            <label className="form-stack">
              <span className="field-label">Estimated cost ($)</span>
              <input
                className="form-control-glass"
                inputMode="numeric"
                value={draft.estimatedCost}
                onChange={(event) => handleUpdate('estimatedCost', event.target.value)}
              />
            </label>

            <label className="form-stack form-span-2">
              <span className="field-label">Location</span>
              <input
                className="form-control-glass"
                value={draft.location}
                onChange={(event) => handleUpdate('location', event.target.value)}
              />
            </label>

            <label className="form-stack form-span-2">
              <span className="field-label">Incident summary</span>
              <textarea
                className="form-control-glass form-textarea"
                value={draft.summary}
                onChange={(event) => handleUpdate('summary', event.target.value)}
              />
            </label>

            <label className="form-stack form-span-2">
              <span className="field-label">Requested outcome</span>
              <textarea
                className="form-control-glass form-textarea compact"
                value={draft.requestedOutcome}
                onChange={(event) => handleUpdate('requestedOutcome', event.target.value)}
              />
            </label>

            <label className="form-stack form-span-2">
              <span className="field-label">Attachments / evidence bundle</span>
              <input
                className="form-control-glass"
                value={draft.attachments}
                onChange={(event) => handleUpdate('attachments', event.target.value)}
              />
              <span className="field-note">
                This route is designed to make landlord approval easier by packaging evidence explicitly instead of relying on conversational recall.
              </span>
            </label>
          </div>
        </div>

        <div className="panel report-panel">
          <div className="panel-header panel-header-spaced">
            <div>
              <h2 className="panel-title">
                <span className="material-symbols-outlined">approval_delegation</span>
                Landlord approval brief
              </h2>
              <p className="panel-copy">
                A structured artifact for approval queues, property managers, and external systems.
              </p>
            </div>
            <span className={`status-pill ${requiresApproval ? 'warning' : 'success'}`}>
              {requiresApproval ? 'Approval likely required' : 'Eligible for direct dispatch'}
            </span>
          </div>

          <div className="report-block">
            <div className="report-row">
              <span className="report-label">Tenant</span>
              <strong>{tenantName}</strong>
            </div>
            <div className="report-row">
              <span className="report-label">Unit</span>
              <strong>{tenantUnit}</strong>
            </div>
            <div className="report-row">
              <span className="report-label">Weather context</span>
              <strong>
                {weather.temp} · {weather.desc}
                {weather.alert ? ` · ${weather.alert}` : ''}
              </strong>
            </div>
            <div className="report-row">
              <span className="report-label">Recommended operating track</span>
              <strong>{recommendedTrack}</strong>
            </div>
          </div>

          <div className="report-block">
            <h3>Executive summary</h3>
            <p>{reportSummary}</p>
          </div>

          <div className="report-block">
            <h3>Decision signals</h3>
            <div className="signal-grid compact">
              <div className="signal-chip">
                <span className="material-symbols-outlined">gavel</span>
                <div>
                  <strong>Liability path</strong>
                  <p>Structural/common-area items should bias toward landlord review when lease language is silent.</p>
                </div>
              </div>
              <div className="signal-chip">
                <span className="material-symbols-outlined">receipt_long</span>
                <div>
                  <strong>Cost threshold</strong>
                  <p>
                    ${estimatedCost || '0'} estimated cost
                    {requiresApproval ? ' exceeds' : ' does not exceed'} the current $150 approval threshold.
                  </p>
                </div>
              </div>
              <div className="signal-chip">
                <span className="material-symbols-outlined">attachment</span>
                <div>
                  <strong>Evidence bundle</strong>
                  <p>{draft.attachments}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="report-block">
            <h3>Proposed landlord note</h3>
            <p className="report-quote">
              Please review this request for {draft.category.toLowerCase()} work at {tenantName}. The tenant submitted a
              structured incident record with a stated estimate of ${estimatedCost || '0'} and requested outcome:
              {' '}{draft.requestedOutcome}
            </p>
          </div>

          <div className="flow-cta-row">
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => {
                window.location.hash = 'tenanthub';
              }}
            >
              <span className="material-symbols-outlined">forum</span>
              Open conversational flow
            </button>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => {
                window.location.hash = 'dashboard';
              }}
            >
              <span className="material-symbols-outlined">fact_check</span>
              Review approval queue
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
