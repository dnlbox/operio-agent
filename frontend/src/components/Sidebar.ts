import { AppState } from '@/types';
import { qs, on, showSystemNotice } from '@/utils/dom';
import { dispatch, setWeather } from '@/state/store';

/**
 * Component representing the sidebar panel containing application navigation
 * and the environmental plaza weather feed control panel.
 */
export class Sidebar {
  private navDashboard: HTMLElement;
  private navTenant: HTMLElement;
  private navKnowledge: HTMLElement;
  private navStaff: HTMLElement;

  private weatherTempDisplay: HTMLElement;
  private weatherDescDisplay: HTMLElement;
  private weatherBtnWarm: HTMLButtonElement;
  private weatherBtnCold: HTMLButtonElement;

  /**
   * Constructs the Sidebar component.
   */
  constructor() {
    this.navDashboard = qs('#nav-dashboard');
    this.navTenant = qs('#nav-tenant');
    this.navKnowledge = qs('#nav-knowledge');
    this.navStaff = qs('#nav-staff');

    this.weatherTempDisplay = qs('#weather-temp-display');
    this.weatherDescDisplay = qs('#weather-desc-display');
    this.weatherBtnWarm = qs<HTMLButtonElement>('#weather-btn-warm');
    this.weatherBtnCold = qs<HTMLButtonElement>('#weather-btn-cold');

    this.bindEvents();
  }

  /**
   * Registers event handlers for view switching and weather toggles.
   */
  private bindEvents(): void {
    // Navigation routing triggers
    on(this.navDashboard, 'click', (e) => {
      e.preventDefault();
      window.location.hash = 'dashboard';
    });

    on(this.navTenant, 'click', (e) => {
      e.preventDefault();
      window.location.hash = 'tenanthub';
    });

    on(this.navKnowledge, 'click', (e) => {
      e.preventDefault();
      window.location.hash = 'knowledge';
    });

    on(this.navStaff, 'click', (e) => {
      e.preventDefault();
      window.location.hash = 'staff';
    });

    // Weather toggle listeners
    on(this.weatherBtnWarm, 'click', () => {
      dispatch(setWeather('20°C', 'Clear Sky', null));
    });

    on(this.weatherBtnCold, 'click', () => {
      dispatch(setWeather(
        '-22°C', 
        'Extreme Cold Warning', 
        'Extreme Cold Warning & Blizzard warning active across GTA plazas.'
      ));
      showSystemNotice('Weather Warning Active: Extreme Cold Warning & Blizzard warning active across GTA plazas.');
    });
  }

  /**
   * Re-renders the sidebar components matching current state.
   * 
   * @param state The current application state.
   */
  public render(state: AppState): void {
    // 1. Update navigation active states
    [this.navDashboard, this.navTenant, this.navKnowledge, this.navStaff].forEach(item => {
      item.classList.remove('active');
    });

    if (state.activeView === 'dashboard') {
      this.navDashboard.classList.add('active');
    } else if (state.activeView === 'tenanthub') {
      this.navTenant.classList.add('active');
    } else if (state.activeView === 'knowledge') {
      this.navKnowledge.classList.add('active');
    } else if (state.activeView === 'staff') {
      this.navStaff.classList.add('active');
    }

    // 2. Update weather display details
    this.weatherTempDisplay.textContent = state.weather.temp;
    this.weatherDescDisplay.textContent = state.weather.desc;

    if (state.weather.alert) {
      this.weatherBtnCold.classList.add('active');
      this.weatherBtnWarm.classList.remove('active');
      this.weatherTempDisplay.classList.add('temp-cold');
    } else {
      this.weatherBtnWarm.classList.add('active');
      this.weatherBtnCold.classList.remove('active');
      this.weatherTempDisplay.classList.remove('temp-cold');
    }
  }
}
