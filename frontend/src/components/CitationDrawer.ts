import { qs, qsa, on } from '@/utils/dom';
import { parseMarkdown } from '@/utils/markdown';

/** Mock dataset of lease sections and manufacturer equipment manuals. */
export const MOCK_CITATIONS: Record<string, string> = {
  'Section 9.1': `### Section 9.1 - Tenant AHU Maintenance
The Tenant shall, at its sole cost and expense, maintain, repair, and replace all components of the Air Handling Unit (AHU) serving the leased premises (Premises HVAC), provided that the cost of any single repair or maintenance event does not exceed **One Thousand Dollars ($1,000.00)**.
* **Routine Maintenance:** The Tenant is responsible for all routine filter replacements, belt adjustments, and coil cleanings.
* **Limitation of Liability:** If a licensed mechanical contractor determines that a repair event requires structural replacement of the compressor or coils, or if the estimated cost of a single repair event exceeds **$1,000.00**, the Landlord shall assume operational and financial responsibility for such repair, subject to Tenant reimbursing the Landlord for the first $150.00 of such repair cost.`,
  
  'Section 9.2': `### Section 9.2 - Electrical Systems
The Tenant shall maintain all lighting fixtures, ballasts, and switches within the Premises. Landlord is responsible for main electrical risers and panels feeding Unit 104.`,

  'Section 12': `### Section 12 - Common Area & Structural Repairs
The Landlord shall maintain and repair the foundations, exterior walls, and roof of the building, including common area systems, sidewalks, and parking areas, except where damage is caused by the negligence of the Tenant or its invitees.`,

  'Carrier Manual': `### Temperature Control Issues - Blowing Warm Air
If the unit is blowing warm air while set to cooling mode, perform the following troubleshooting steps:
1. **Check Thermostat Settings:** Ensure thermostat is set to "Cool" and temperature setpoint is below current ambient air temperature.
2. **Verify Compressor Status:** Check if the compressor is cycling. If compressor does not cycle:
   * **Error Code 1 flashes:** Indicates a High-Pressure Lockout. Reset the primary circuit breaker.
   * **Error Code 2 flashes:** Indicates a Low-Pressure Lockout (potential refrigerant leak). Contact a certified technician.
3. **Check Condenser Fan:** Ensure condenser fan is spinning and clear of debris.
4. **Inspect Evaporator Air Filter:** Clogged filter restricts airflow, causing evaporator coils to freeze. Replace filters if dust exceeds 2mm.`,

  'Otis Manual': `### Escalator Fault Code Diagnostic - Error E-04
Error Code E-04 indicates a **Comb Plate Safety Switch Tripped** event (comb teeth obstruction or impact).
1. **Emergency Stop verification:** Check if emergency stop button is depressed.
2. **Obstruction Check:** Inspect comb plates at both upper and lower landings. Clear any debris, pebbles, or clothing fibers.
3. **Manual Reset:** Once obstruction is cleared, insert key into reset panel and turn clockwise to reset switch state.
4. **Startup Cycle:** Run escalator in test mode for 3 full cycles before restoring to public service.`
};

/**
 * Initializes and manages the citation drawer dialog component.
 */
export class CitationDrawer {
  private dialog: HTMLDialogElement;
  private titleEl: HTMLElement;
  private contentEl: HTMLElement;
  private closeBtn: HTMLElement;

  /**
   * Constructs the CitationDrawer.
   */
  constructor() {
    this.dialog = qs<HTMLDialogElement>('#citation-drawer');
    this.titleEl = qs('#drawer-title', this.dialog);
    this.contentEl = qs('#drawer-content', this.dialog);
    this.closeBtn = qs('#btn-close-drawer', this.dialog);

    this.bindEvents();
  }

  /**
   * Binds event listeners for the drawer dialog.
   */
  private bindEvents(): void {
    on(this.closeBtn, 'click', () => this.close());

    // Light dismissal: close when clicking on the backdrop
    on(this.dialog, 'click', (event: MouseEvent) => {
      if (event.target === this.dialog) {
        const rect = this.dialog.getBoundingClientRect();
        const isClickedOutside = (
          event.clientY < rect.top ||
          event.clientY > rect.bottom ||
          event.clientX < rect.left ||
          event.clientX > rect.right
        );
        if (isClickedOutside) {
          this.close();
        }
      }
    });
  }

  /**
   * Opens the drawer to view a specific document citation reference.
   * 
   * @param ref The citation code or description string.
   */
  public open(ref: string): void {
    const markdown = MOCK_CITATIONS[ref] || `### Document Reference: ${ref}\nClause details are fetched from Elastic RAG database index.`;
    const html = parseMarkdown(markdown);

    this.titleEl.textContent = `Document Audit: ${ref}`;
    this.contentEl.innerHTML = html;

    // Attach click listeners to any nested citations that get generated inside the drawer
    qsa<HTMLElement>('.citation-btn', this.contentEl).forEach(btn => {
      on(btn, 'click', () => {
        const nestedRef = btn.getAttribute('data-ref');
        if (nestedRef) this.open(nestedRef);
      });
    });

    if (typeof this.dialog.showModal === 'function') {
      this.dialog.showModal();
    } else {
      this.dialog.classList.remove('hidden');
    }
  }

  /**
   * Closes the citation drawer.
   */
  public close(): void {
    if (typeof this.dialog.close === 'function') {
      this.dialog.close();
    } else {
      this.dialog.classList.add('hidden');
    }
  }
}
