import React, { useEffect, useMemo, useState } from 'react';
import { AppView } from '@/types';
import { useStore } from '@/state/store';
import { showSystemNotice } from '@/utils/dom';

const navItems: Array<{ icon: string; label: string; view: AppView }> = [
  { icon: 'space_dashboard', label: 'Command Center', view: 'dashboard' },
  { icon: 'forum', label: 'Tenant Chat', view: 'tenanthub' },
  { icon: 'assignment', label: 'Intake Studio', view: 'intake' },
  { icon: 'search_insights', label: 'Evidence Explorer', view: 'knowledge' },
  { icon: 'badge', label: 'Field Team', view: 'staff' },
];

/**
 * Functional component representing the sidebar panel containing application
 * navigation and the environmental weather control.
 *
 * @returns The rendered sidebar.
 */
export const Sidebar: React.FC = () => {
  const activeView = useStore((state) => state.activeView);
  const weather = useStore((state) => state.weather);
  const setWeather = useStore((state) => state.setWeather);
  const [currentTime, setCurrentTime] = useState<string>('');

  const handleNavClick = (view: AppView) => (event: React.MouseEvent) => {
    event.preventDefault();
    window.location.hash = view;
  };

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Toronto',
    });

    const syncTime = () => {
      setCurrentTime(formatter.format(new Date()));
    };

    syncTime();
    const intervalId = window.setInterval(syncTime, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const weatherStatus = useMemo(
    () => (weather.alert ? 'Winter alert active' : 'No critical weather alerts'),
    [weather.alert]
  );

  const handleWarmClick = () => {
    setWeather('20°C', 'Clear Sky', null);
  };

  const handleColdClick = () => {
    setWeather(
      '-22°C',
      'Extreme Cold Warning',
      'Extreme Cold Warning & Blizzard warning active across GTA plazas.'
    );
    showSystemNotice('Weather Warning Active: Extreme Cold Warning & Blizzard warning active across GTA plazas.');
  };

  return (
    <aside className="sidebar">
      <div className="logo-area">
        <div className="logo-symbol" />
        <div>
          <span className="logo-text">OPERIO</span>
          <p className="logo-subtitle">Mall operations orchestration</p>
        </div>
      </div>

      <nav className="nav-links">
        {navItems.map((item) => (
          <a
            key={item.view}
            href={`#${item.view}`}
            className={`nav-item ${activeView === item.view ? 'active' : ''}`}
            onClick={handleNavClick(item.view)}
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span>{item.label}</span>
          </a>
        ))}
      </nav>

      <div className="weather-widget">
        <div className="weather-header">
          <span className="weather-title">Operations snapshot</span>
          <span className="weather-badge">Toronto region</span>
        </div>
        <div className="weather-body">
          <div className="weather-info">
            <span className={`weather-temp ${weather.alert ? 'temp-cold' : ''}`} id="weather-temp-display">
              {weather.temp}
            </span>
            <span className="weather-desc" id="weather-desc-display">
              {weather.desc}
            </span>
          </div>
          <div className="telemetry-grid">
            <div className="telemetry-item">
              <div className="telemetry-heading">
                <span className="material-symbols-outlined">schedule</span>
                <span className="telemetry-label">Local time</span>
              </div>
              <strong>{currentTime || 'Loading...'}</strong>
            </div>
            <div className="telemetry-item">
              <div className="telemetry-heading">
                <span className="material-symbols-outlined">storefront</span>
                <span className="telemetry-label">Operations</span>
              </div>
              <strong>08:00 AM - 06:00 PM</strong>
            </div>
            <div className="telemetry-item">
              <div className="telemetry-heading">
                <span className="material-symbols-outlined">warning</span>
                <span className="telemetry-label">Weather status</span>
              </div>
              <strong>{weatherStatus}</strong>
            </div>
            <div className="telemetry-item">
              <div className="telemetry-heading">
                <span className="material-symbols-outlined">tune</span>
                <span className="telemetry-label">Site mode</span>
              </div>
              <strong>{weather.alert ? 'Cold-weather readiness' : 'Standard operations'}</strong>
            </div>
          </div>
          <div className="weather-toggle-container">
            <button
              className={`weather-toggle-btn ${!weather.alert ? 'active' : ''}`}
              id="weather-btn-warm"
              onClick={handleWarmClick}
            >
              Summer
            </button>
            <button
              className={`weather-toggle-btn ${weather.alert ? 'active' : ''}`}
              id="weather-btn-cold"
              onClick={handleColdClick}
            >
              Winter alert
            </button>
          </div>
        </div>
      </div>

      <div className="sidebar-footer">
        <span className="status-indicator online" />
        <span className="status-label">Agent orchestrator online</span>
      </div>
    </aside>
  );
};
