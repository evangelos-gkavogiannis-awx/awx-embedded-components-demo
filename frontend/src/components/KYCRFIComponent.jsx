import { useState, useEffect, useRef } from 'react';
import { init, createElement } from '@airwallex/components-sdk';
import { embeddedMountContainerStyle, embeddedIframeStyles, embeddedPageContainerStyle } from '../embeddedComponentLayout';

const BASE = window.__API_BASE__ || '';

export default function KYCRFIComponent({ credentials, onBack, setError }) {
  const [step, setStep] = useState('enter-account'); // 'enter-account', 'initializing', 'ready'
  const [accountId, setAccountId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const elementRef = useRef(null);
  const containerRef = useRef(null);

  const handleInitialize = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Get auth code with RFI scopes
      const authRes = await fetch(BASE + '/api/get-auth-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: credentials.clientId,
          apiKey: credentials.apiKey,
          accountId,
          scopes: ['r:awx_action:rfi_view', 'w:awx_action:rfi_edit'],
        }),
      });

      if (!authRes.ok) {
        const data = await authRes.json();
        throw new Error(data.message || 'Failed to get auth code');
      }

      const { authCode, codeVerifier } = await authRes.json();
      setStep('initializing');

      // Initialize SDK
      await init({
        authCode,
        codeVerifier,
        env: 'demo',
        enabledElements: ['kycRfi'],
        clientId: credentials.clientId,
      });

      // Create and mount KYC RFI element
      const element = await createElement('kycRfi');
      elementRef.current = element;

      element.on('ready', () => {
        console.log('KYC RFI ready');
        setStep('ready');
        setIsLoading(false);
      });

      element.on('success', (event) => {
        console.log('KYC RFI success:', event);
      });

      element.on('error', (event) => {
        console.error('KYC RFI error:', event);
        setError('An error occurred. Please try again.');
      });

      if (containerRef.current) {
        await element.mount(containerRef.current);
      }
    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
      setIsLoading(false);
      setStep('enter-account');
    }
  };

  useEffect(() => {
    return () => {
      if (elementRef.current) {
        try {
          elementRef.current.unmount();
        } catch (e) {
          // Ignore unmount errors
        }
      }
    };
  }, []);

  return (
    <div style={{ ...styles.container, ...embeddedPageContainerStyle }}>
      <div style={styles.header}>
        <button onClick={onBack} style={styles.backButton}>
          &larr; Back to components
        </button>
        <h1 style={styles.title}>KYC RFI Embedded Component</h1>
        <p style={styles.subtitle}>
          Handle Request for Information (RFI) flows for existing accounts
        </p>
      </div>

      {step === 'enter-account' && (
        <div style={styles.formCard}>
          <h2 style={styles.formTitle}>Enter Account ID</h2>
          <p style={styles.formSubtitle}>
            Provide an existing connected account ID that has pending RFI requests
          </p>
          <form onSubmit={handleInitialize} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Account ID</label>
              <input
                type="text"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                placeholder="e.g., acct_xxxxxxxxxxxxxxxxxxxx"
                style={styles.input}
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !accountId}
              style={{
                ...styles.submitButton,
                opacity: isLoading || !accountId ? 0.7 : 1,
              }}
            >
              {isLoading ? 'Initializing...' : 'Launch RFI Component'}
            </button>
          </form>
        </div>
      )}

      {step === 'initializing' && (
        <div style={styles.loadingCard}>
          <div style={styles.spinner}></div>
          <p style={styles.loadingText}>Initializing KYC RFI component...</p>
        </div>
      )}

      <div
        ref={containerRef}
        id="kyc-rfi-container"
        className="awx-embedded-mount"
        style={{
          ...embeddedMountContainerStyle,
          display: step === 'initializing' || step === 'ready' ? 'block' : 'none',
        }}
      />

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        ${embeddedIframeStyles}
      `}</style>
    </div>
  );
}

const styles = {
  container: {},
  header: {
    marginBottom: '24px',
  },
  backButton: {
    background: 'none',
    border: 'none',
    color: '#666',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '0',
    marginBottom: '16px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#666',
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: '16px',
    padding: '32px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
    maxWidth: '480px',
  },
  formTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: '8px',
  },
  formSubtitle: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '24px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
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
  },
  submitButton: {
    padding: '14px',
    fontSize: '16px',
    fontWeight: '600',
    color: '#fff',
    backgroundColor: '#8b5cf6',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  loadingCard: {
    backgroundColor: '#fff',
    borderRadius: '16px',
    padding: '48px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
    textAlign: 'center',
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: '3px solid #f0f0f0',
    borderTopColor: '#8b5cf6',
    borderRadius: '50%',
    margin: '0 auto 16px',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    fontSize: '16px',
    color: '#666',
  },
};
