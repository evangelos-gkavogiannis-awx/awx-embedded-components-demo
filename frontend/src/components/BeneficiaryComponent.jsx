import { useState, useEffect, useRef } from 'react';
import { init, createElement } from '@airwallex/components-sdk';
import { embeddedMountContainerStyle, embeddedIframeStyles, embeddedPageContainerStyle } from '../embeddedComponentLayout';

const BASE = window.__API_BASE__ || '';

export default function BeneficiaryComponent({ credentials, onBack, setError }) {
  const [step, setStep] = useState('enter-account'); // 'enter-account', 'initializing', 'ready'
  const [accountId, setAccountId] = useState('');
  const [activeAccountId, setActiveAccountId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const elementRef = useRef(null);
  const containerRef = useRef(null);

  const handleInitialize = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Get auth code with payout scopes
      const authRes = await fetch(BASE + '/api/get-auth-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: credentials.clientId,
          apiKey: credentials.apiKey,
          accountId,
          scopes: ['w:awx_action:transfers_edit'],
        }),
      });

      if (!authRes.ok) {
        const data = await authRes.json();
        throw new Error(data.message || 'Failed to get auth code');
      }

      const { authCode, codeVerifier } = await authRes.json();
      setActiveAccountId(accountId.trim());
      setStep('initializing');

      // Initialize SDK
      await init({
        locale: 'en',
        env: 'demo',
        enabledElements: ['payouts'],
        authCode,
        codeVerifier,
        clientId: credentials.clientId,
      });

      // Create beneficiary form element
      const element = await createElement('beneficiaryForm', {
        defaultValues: {
          beneficiary: {
            entity_type: 'COMPANY',
            bank_details: {
              account_currency: 'AUD',
              bank_country_code: 'AU',
              local_clearing_system: 'BANK_TRANSFER',
            },
          },
          transfer_methods: ['LOCAL'],
        },
      });

      elementRef.current = element;

      element.on('ready', () => {
        console.log('Beneficiary form ready');
        setStep('ready');
        setIsLoading(false);
      });

      element.on('error', (event) => {
        console.error('Beneficiary form error:', event);
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

  const handleSubmit = async () => {
    if (!elementRef.current) return;

    setIsSubmitting(true);
    try {
      const results = await elementRef.current.submit();

      if (results.errors) {
        throw new Error(results.errors.message || 'Please fix the form errors before submitting');
      }

      const payload = results.values;

      const response = await fetch(BASE + '/api/create-beneficiary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: credentials.clientId,
          apiKey: credentials.apiKey,
          accountId: activeAccountId,
          beneficiaryPayload: payload,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create beneficiary');
      }

      const data = await response.json();
      alert('Beneficiary created successfully! ID: ' + data.id);
      console.log('Created beneficiary:', data);
    } catch (err) {
      console.error('Submit error:', err);
      setError(err.message);
    } finally {
      setIsSubmitting(false);
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
        <h1 style={styles.title}>Beneficiary Embedded Component</h1>
        <p style={styles.subtitle}>
          Create and manage payment beneficiaries
        </p>
      </div>

      {step === 'enter-account' && (
        <div style={styles.formCard}>
          <h2 style={styles.formTitle}>Enter Account ID</h2>
          <p style={styles.formSubtitle}>
            Provide a connected account ID to create beneficiaries
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
              {isLoading ? 'Initializing...' : 'Launch Beneficiary Form'}
            </button>
          </form>
        </div>
      )}

      {step === 'initializing' && (
        <div style={styles.loadingCard}>
          <div style={styles.spinner}></div>
          <p style={styles.loadingText}>Initializing beneficiary form...</p>
        </div>
      )}

      <div
        ref={containerRef}
        id="beneficiary-container"
        className="awx-embedded-mount"
        style={{
          ...embeddedMountContainerStyle,
          display: step === 'initializing' || step === 'ready' ? 'block' : 'none',
        }}
      />

      {step === 'ready' && (
        <div style={styles.buttonContainer}>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{
              ...styles.actionButton,
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? 'Creating...' : 'Create Beneficiary'}
          </button>
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
    backgroundColor: '#10b981',
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
    borderTopColor: '#10b981',
    borderRadius: '50%',
    margin: '0 auto 16px',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    fontSize: '16px',
    color: '#666',
  },
  buttonContainer: {
    marginTop: '24px',
  },
  actionButton: {
    padding: '14px 32px',
    fontSize: '16px',
    fontWeight: '600',
    color: '#fff',
    backgroundColor: '#10b981',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
};
