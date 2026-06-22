import { useState, useCallback } from 'react';
import { EMBEDDED_COMPONENT_MAX_WIDTH } from './embeddedComponentLayout';
import KYCComponent from './components/KYCComponent';
import KYCRFIComponent from './components/KYCRFIComponent';
import BeneficiaryComponent from './components/BeneficiaryComponent';
import TransferComponent from './components/TransferComponent';
import SCAComponent from './components/SCAComponent';

const BASE = window.__API_BASE__ || '';

const components = [
  {
    id: 'kyc',
    title: 'KYC Component',
    description: 'Complete Know Your Customer onboarding flow',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
    color: '#6366f1',
  },
  {
    id: 'kyc-rfi',
    title: 'KYC RFI Component',
    description: 'Handle Request for Information flows',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
    color: '#8b5cf6',
  },
  {
    id: 'beneficiary',
    title: 'Beneficiary Component',
    description: 'Create and manage payment beneficiaries',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    color: '#10b981',
  },
  {
    id: 'transfer',
    title: 'Transfer Component',
    description: 'Initiate and manage fund transfers',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <line x1="12" y1="1" x2="12" y2="23"/>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
    color: '#f59e0b',
  },
  {
    id: 'sca',
    title: 'SCA Component',
    description: 'Set up and verify Strong Customer Authentication',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    color: '#e11d48',
  },
];

export default function App() {
  const [clientId, setClientId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [accountId, setAccountId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleComponentSelect = useCallback(async (componentId) => {
    if (!clientId || !apiKey) {
      setError('Please enter both API Client ID and API Key');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Test credentials
      const response = await fetch(BASE + '/api/test-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, apiKey })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Invalid credentials');
      }

      setSelectedComponent(componentId);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [clientId, apiKey]);

  const handleBack = useCallback(() => {
    setSelectedComponent(null);
    setAccountId(null);
    setError(null);
  }, []);

  // If a component is selected, render it
  if (selectedComponent) {
    const credentials = { clientId, apiKey };
    const componentProps = {
      credentials,
      accountId,
      setAccountId,
      onBack: handleBack,
      setError
    };

    return (
      <div style={styles.container}>
        <main style={{ ...styles.main, maxWidth: `${EMBEDDED_COMPONENT_MAX_WIDTH + 48}px` }}>
          {error && (
            <div style={styles.errorBanner}>
              <span style={styles.errorIcon}>!</span>
              {error}
              <button onClick={() => setError(null)} style={styles.errorClose}>
                &times;
              </button>
            </div>
          )}
          {selectedComponent === 'kyc' && <KYCComponent {...componentProps} />}
          {selectedComponent === 'kyc-rfi' && <KYCRFIComponent {...componentProps} />}
          {selectedComponent === 'beneficiary' && <BeneficiaryComponent {...componentProps} />}
          {selectedComponent === 'transfer' && <TransferComponent {...componentProps} />}
          {selectedComponent === 'sca' && <SCAComponent {...componentProps} />}
        </main>
        <footer style={styles.footer}>
          <p>Demo environment - Using Airwallex Demo API</p>
        </footer>
      </div>
    );
  }

  // Landing page with credentials and component selector
  return (
    <div style={styles.container}>
      <main style={styles.main}>
        <div style={styles.landingContainer}>
          {/* Header */}
          <div style={styles.header}>
            <div style={styles.logoContainer}>
              <svg width="48" height="48" viewBox="0 0 100 100" fill="none">
                <circle cx="50" cy="50" r="50" fill="#FF5A5F"/>
                <path d="M30 65L50 35L70 65H30Z" fill="white"/>
              </svg>
            </div>
            <h1 style={styles.title}>Airwallex Embedded Components</h1>
            <p style={styles.subtitle}>
              Enter your API credentials and select a component to launch
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div style={styles.errorBanner}>
              <span style={styles.errorIcon}>!</span>
              {error}
              <button onClick={() => setError(null)} style={styles.errorClose}>
                &times;
              </button>
            </div>
          )}

          {/* Credentials Form */}
          <div style={styles.credentialsCard}>
            <h2 style={styles.cardTitle}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF5A5F" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              API Credentials
            </h2>
            <p style={styles.disclaimer}>
              Your API key is used only to authenticate with Airwallex and is never stored.
            </p>
            <div style={styles.credentialsGrid}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>API Client ID</label>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="e.g., p7KIl7twQcWfBEKzqYHaCw"
                  style={styles.input}
                />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your API key"
                  style={styles.input}
                />
              </div>
            </div>
          </div>

          {/* Component Grid */}
          <div style={styles.componentSection}>
            <h2 style={styles.sectionTitle}>Select a Component</h2>
            <div style={styles.componentGrid}>
              {components.map((component) => (
                <button
                  key={component.id}
                  onClick={() => handleComponentSelect(component.id)}
                  disabled={isLoading}
                  style={{
                    ...styles.componentCard,
                    opacity: isLoading ? 0.7 : 1,
                    cursor: isLoading ? 'wait' : 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoading) {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.12)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)';
                  }}
                >
                  <div
                    style={{
                      ...styles.iconWrapper,
                      backgroundColor: `${component.color}15`,
                      color: component.color,
                    }}
                  >
                    {component.icon}
                  </div>
                  <div style={styles.componentInfo}>
                    <h3 style={styles.componentTitle}>{component.title}</h3>
                    <p style={styles.componentDescription}>{component.description}</p>
                  </div>
                  <span
                    style={{
                      ...styles.launchBadge,
                      backgroundColor: component.color,
                    }}
                  >
                    {isLoading ? '...' : 'Launch'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <p style={styles.note}>
            Using Demo environment (api-demo.airwallex.com)
          </p>
        </div>
      </main>

      <footer style={styles.footer}>
        <p>Demo environment - Using Airwallex Demo API</p>
      </footer>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#f5f7fa',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  main: {
    flex: 1,
    padding: '24px',
    maxWidth: '1000px',
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box',
  },
  landingContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  header: {
    textAlign: 'center',
    paddingTop: '20px',
  },
  logoContainer: {
    marginBottom: '16px',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '16px',
    color: '#666',
  },
  credentialsCard: {
    backgroundColor: '#fff',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
  },
  cardTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: '20px',
  },
  credentialsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '20px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#333',
    marginBottom: '8px',
  },
  input: {
    padding: '12px 16px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  componentSection: {
    marginTop: '8px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: '16px',
  },
  componentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
  },
  componentCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '24px 16px',
    backgroundColor: '#fff',
    borderRadius: '16px',
    border: 'none',
    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
    transition: 'all 0.2s ease',
    textAlign: 'center',
  },
  iconWrapper: {
    width: '56px',
    height: '56px',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  componentInfo: {
    flex: 1,
    marginBottom: '16px',
  },
  componentTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: '6px',
  },
  componentDescription: {
    fontSize: '13px',
    color: '#666',
    lineHeight: '1.4',
  },
  launchBadge: {
    padding: '8px 20px',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '600',
  },
  note: {
    textAlign: 'center',
    fontSize: '12px',
    color: '#888',
    marginTop: '8px',
  },
  disclaimer: {
    fontSize: '12px',
    color: '#aaa',
    marginTop: '2px',
    marginBottom: '16px',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    backgroundColor: '#fff2f0',
    border: '1px solid #ffccc7',
    borderRadius: '8px',
    color: '#cf1322',
    fontSize: '14px',
  },
  errorIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: '#ff4d4f',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 'bold',
    flexShrink: 0,
  },
  errorClose: {
    marginLeft: 'auto',
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    color: '#cf1322',
    padding: '0',
    lineHeight: 1,
  },
  footer: {
    textAlign: 'center',
    padding: '16px',
    fontSize: '12px',
    color: '#888',
    borderTop: '1px solid #e8e8e8',
  },
};
