import { useState, useEffect, useRef } from 'react';
import { init, createElement } from '@airwallex/components-sdk';
import {
  embeddedMountContainerStyle,
  embeddedIframeStyles,
  embeddedPageContainerStyle,
} from '../embeddedComponentLayout';

const BASE = window.__API_BASE__ || '';

export default function KYCComponent({ credentials, onBack, setError }) {
  const [step, setStep] = useState('create-account'); // 'create-account', 'initializing', 'ready'
  const [email, setEmail] = useState('test@airwallex.com');
  const [isLoading, setIsLoading] = useState(false);
  const [accountId, setAccountId] = useState(null);
  const [kycStatus, setKycStatus] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const elementRef = useRef(null);
  const containerRef = useRef(null);

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setStatusMessage('Creating connected account...');

    try {
      // Step 1: Create account
      console.log('Step 1: Creating account...');
      const accountRes = await fetch(BASE + '/api/create-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: credentials.clientId,
          apiKey: credentials.apiKey,
          email,
        }),
      });

      const accountData = await accountRes.json();

      if (!accountRes.ok) {
        throw new Error(accountData.message || 'Failed to create account');
      }

      const newAccountId = accountData.accountId;
      setAccountId(newAccountId);
      console.log('Account created:', newAccountId);

      setStep('initializing');
      setStatusMessage('Getting authorization code...');

      // Step 2: Get auth code
      console.log('Step 2: Getting auth code...');
      const authRes = await fetch(BASE + '/api/get-auth-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: credentials.clientId,
          apiKey: credentials.apiKey,
          accountId: newAccountId,
          scopes: ['w:awx_action:onboarding'],
        }),
      });

      const authData = await authRes.json();

      if (!authRes.ok) {
        throw new Error(authData.message || 'Failed to get auth code');
      }

      const { authCode, codeVerifier } = authData;
      console.log('Auth code received');

      setStatusMessage('Initializing Airwallex SDK...');

      // Step 3: Initialize SDK
      console.log('Step 3: Initializing SDK...');
      await init({
        authCode,
        codeVerifier,
        env: 'demo',
        enabledElements: ['onboarding'],
        clientId: credentials.clientId,
      });
      console.log('SDK initialized');

      setStatusMessage('Creating KYC component...');

      // Step 4: Create KYC element
      console.log('Step 4: Creating KYC element...');
      const element = await createElement('kyc');
      elementRef.current = element;

      // Event listeners
      element.on('ready', (event) => {
        console.log('KYC ready event:', event);
        setKycStatus(event.kycStatus);
        setStatusMessage('');

        if (event.kycStatus === 'INIT') {
          setStep('ready');
          setIsLoading(false);
        } else {
          // Handle different KYC statuses
          switch (event.kycStatus) {
            case 'SUBMITTED':
              setStatusMessage('Account already submitted for onboarding');
              break;
            case 'SUCCESS':
              setStatusMessage('Account already onboarded successfully');
              break;
            case 'FAILURE':
              setStatusMessage('Account was rejected for onboarding');
              break;
            default:
              setStep('ready');
          }
          setIsLoading(false);
        }
      });

      element.on('success', (event) => {
        console.log('KYC success event:', event);
        setKycStatus('SUCCESS');
        setStatusMessage('Onboarding completed successfully!');
      });

      element.on('error', (event) => {
        console.error('KYC error event:', event);
        const errorMessage = event?.message || event?.code || 'An error occurred during onboarding';
        setError(errorMessage);
        setIsLoading(false);
      });

      // Step 5: Mount the element
      console.log('Step 5: Mounting element...');
      if (containerRef.current) {
        await element.mount(containerRef.current);
        console.log('Element mounted');
      }
    } catch (err) {
      console.error('Error:', err);
      setError(err.message || 'An unexpected error occurred');
      setIsLoading(false);
      setStep('create-account');
      setStatusMessage('');
    }
  };

  // Cleanup on unmount
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
        <h1 style={styles.title}>KYC Embedded Component</h1>
        {accountId && (
          <p style={styles.accountId}>Account ID: {accountId}</p>
        )}
      </div>

      {step === 'create-account' && (
        <div style={styles.formCard}>
          <h2 style={styles.formTitle}>Create a Connected Account</h2>
          <p style={styles.formSubtitle}>
            Enter an email to create a new connected account for KYC onboarding
          </p>
          <form onSubmit={handleCreateAccount} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email address"
                style={styles.input}
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              style={{
                ...styles.submitButton,
                opacity: isLoading ? 0.7 : 1,
                cursor: isLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {isLoading ? 'Processing...' : 'Start KYC Onboarding'}
            </button>
          </form>
        </div>
      )}

      {step === 'initializing' && (
        <div style={styles.loadingCard}>
          <div style={styles.spinner}></div>
          <p style={styles.loadingText}>{statusMessage || 'Initializing...'}</p>
        </div>
      )}

      {/* KYC Component Container */}
      <div
        ref={containerRef}
        id="kyc-container"
        className="awx-embedded-mount"
        style={{
          ...embeddedMountContainerStyle,
          display: step === 'initializing' || step === 'ready' ? 'block' : 'none',
        }}
      />

      {kycStatus === 'SUCCESS' && (
        <div style={styles.successBanner}>
          KYC Onboarding completed successfully!
        </div>
      )}

      {kycStatus === 'SUBMITTED' && (
        <div style={styles.infoBanner}>
          This account has already been submitted for onboarding review.
        </div>
      )}

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
  accountId: {
    fontSize: '13px',
    color: '#888',
    fontFamily: 'monospace',
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
    backgroundColor: '#6366f1',
    border: 'none',
    borderRadius: '8px',
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
    borderTopColor: '#6366f1',
    borderRadius: '50%',
    margin: '0 auto 16px',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    fontSize: '16px',
    color: '#666',
  },
  successBanner: {
    marginTop: '24px',
    padding: '16px',
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '8px',
    color: '#15803d',
    textAlign: 'center',
    fontSize: '16px',
    fontWeight: '500',
  },
  infoBanner: {
    marginTop: '24px',
    padding: '16px',
    backgroundColor: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '8px',
    color: '#1d4ed8',
    textAlign: 'center',
    fontSize: '16px',
    fontWeight: '500',
  },
};
