import React from 'react';
import { useStore } from '@/state/store';
import { showSystemNotice } from '@/utils/dom';

/**
 * Functional component representing the sidebar panel containing application navigation
 * and the environmental plaza weather feed control panel.
 * 
 * @returns The rendered Sidebar React element.
 */
export const Sidebar: React.FC = () => {
  const activeView = useStore((state) => state.activeView);
  const weather = useStore((state) => state.weather);
  const setWeather = useStore((state) => state.setWeather);

  const handleNavClick = (view: 'dashboard' | 'tenanthub' | 'knowledge' | 'staff') => (e: React.MouseEvent) => {
    e.preventDefault();
    window.location.hash = view;
  };

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
        <div className="logo-symbol"></div>
        <span className="logo-text">OPERIO</span>
      </div>
      
      <nav className="nav-links">
        <a 
          href="#dashboard" 
          className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`} 
          id="nav-dashboard"
          onClick={handleNavClick('dashboard')}
        >
          <span className="material-symbols-outlined">dashboard</span>
          Command Center
        </a>
        <a 
          href="#tenanthub" 
          className={`nav-item ${activeView === 'tenanthub' ? 'active' : ''}`} 
          id="nav-tenant"
          onClick={handleNavClick('tenanthub')}
        >
          <span className="material-symbols-outlined">hub</span>
          Tenant Hub
        </a>
        <a 
          href="#knowledge" 
          className={`nav-item ${activeView === 'knowledge' ? 'active' : ''}`} 
          id="nav-knowledge"
          onClick={handleNavClick('knowledge')}
        >
          <span className="material-symbols-outlined">search_insights</span>
          RAG Explorer
        </a>
        <a 
          href="#staff" 
          className={`nav-item ${activeView === 'staff' ? 'active' : ''}`} 
          id="nav-staff"
          onClick={handleNavClick('staff')}
        >
          <span className="material-symbols-outlined">badge</span>
          Staff & Vendors
        </a>
      </nav>

      <div className="weather-widget">
        <div className="weather-header">
          <span className="weather-title">ENVIRONMENT CANADA</span>
          <span className="weather-badge">GTA Feed</span>
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
              Winter Alert
            </button>
          </div>
        </div>
      </div>

      <div className="sidebar-footer">
        <span className="status-indicator online"></span>
        <span className="status-label">Agent Orchestrator Online</span>
      </div>
    </aside>
  );
};
