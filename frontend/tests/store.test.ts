import { describe, it, expect, beforeEach } from 'vitest';
import { useStore, setView, setWeather, setTenant } from '@/state/store';

/**
 * Unit test suite verifying Zustand store behavior and actions.
 */
describe('Zustand Store and Actions', () => {
  beforeEach(() => {
    // Reset Zustand store to initial state before each test case
    useStore.setState(useStore.getInitialState());
  });

  it('should verify initial state parameters', () => {
    const state = useStore.getState();
    expect(state.activeView).toBe('dashboard');
    expect(state.currentTenant).toBe('tenant_001');
    expect(state.weather.temp).toBe('20°C');
    expect(state.tickets).toEqual([]);
  });

  it('should update active view using setView action', () => {
    useStore.getState().setView('tenanthub');
    expect(useStore.getState().activeView).toBe('tenanthub');
  });

  it('should update weather conditions using setWeather action', () => {
    useStore.getState().setWeather('-10°C', 'Blizzard', 'Cold Warning');
    expect(useStore.getState().weather).toEqual({
      temp: '-10°C',
      desc: 'Blizzard',
      alert: 'Cold Warning',
    });
  });

  it('should update tenant and lease references using setTenant action', () => {
    useStore.getState().setTenant('tenant_003');
    expect(useStore.getState().currentTenant).toBe('tenant_003');
    expect(useStore.getState().currentLeaseId).toBe('lease_zara_106');
  });

  it('should support legacy dispatch compatibility function', () => {
    const { dispatch } = useStore.getState();
    dispatch(setView('staff'));
    expect(useStore.getState().activeView).toBe('staff');
  });
});
