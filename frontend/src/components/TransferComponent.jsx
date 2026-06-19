import { useState, useEffect, useRef } from 'react';
import { init, createElement } from '@airwallex/components-sdk';
import { embeddedMountContainerStyle, embeddedIframeStyles, embeddedPageContainerStyle } from '../embeddedComponentLayout';

const BASE = window.__API_BASE__ || '';

export default function TransferComponent({ credentials, onBack, setError }) {
  const [step, setStep] = useState('enter-details'); // 'enter-details', 'initializing', 'ready'
  const [accountId, setAccountId] = useState('');
  const [beneficiaryId, setBeneficiaryId] = useState('');
  const [activeAccountId, setActiveAccountId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const elementRef = useRef(null);
  const containerRef = useRef(null);

  const handleInitialize = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Get auth code with transfer scopes
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

      // Create payout form element with optional beneficiary pre-fill
      const elementOptions = {
        defaultValues: {
          source_currency: 'USD',
        },
      };

      if (beneficiaryId.trim()) {
        elementOptions.defaultValues.beneficiary_id = beneficiaryId.trim();
      }

      const element = await createElement('payoutForm', elementOptions);
      elementRef.current = element;

      element.on('ready', () => {
        console.log('Transfer form ready');
        setStep('ready');
        setIsLoading(false);
      });

      element.on('error', (event) => {
        console.error('Transfer error:', event);
        setError(event?.message || 'An error occurred. Please try again.');
      });

      if (containerRef.current) {
        await element.mount(containerRef.current);
      }
    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
      setIsLoading(false);
      setStep('enter-details');
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

      const response = await fetch(BASE + '/api/create-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: credentials.clientId,
          apiKey: credentials.apiKey,
          accountId: activeAccountId,
          transferPayload: results.values,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create transfer');
      }

      const data = await response.json();
      alert('Transfer created successfully! ID: ' + data.id);
      console.log('Created transfer:', data);
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
        <h1 style={styles.title}>Transfer Embedded Component</h1>
        <p style={styles.subtitle}>
          Initiate fund transfers to beneficiaries
        </p>
      </div>

      {step === 'enter-details' && (
        <div style={styles.formCard}>
          <h2 style={styles.formTitle}>Transfer Details</h2>
          <p style={styles.formSubtitle}>
            Enter account and optionally a beneficiary to pre-fill
          </p>
          <form onSubmit={handleInitialize} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Account ID *</label>
              <input
                type="text"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                placeholder="e.g., acct_xxxxxxxxxxxxxxxxxxxx"
                style={styles.input}
                required
              />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>
                Beneficiary ID <span style={styles.optional}>(optional)</span>
              </label>
              <input
                type="text"
                value={beneficiaryId}
                onChange={(e) => setBeneficiaryId(e.target.value)}
                placeholder="e.g., ben_xxxxxxxxxxxxxxxxxxxx"
                style={styles.input}
              />
              <p style={styles.hint}>
                If provided, the transfer form will be pre-filled with this beneficiary
              </p>
            </div>
            <button
              type="submit"
              disabled={isLoading || !accountId}
              style={{
                ...styles.submitButton,
                opacity: isLoading || !accountId ? 0.7 : 1,
              }}
            >
              {isLoading ? 'Initializing...' : 'Launch Transfer Form'}
            </button>
          </form>
        </div>
      )}

      {step === 'initializing' && (
        <div style={styles.loadingCard}>
          <div style={styles.spinner}></div>
          <p style={styles.loadingText}>Initializing transfer form...</p>
        </div>
      )}

      <div
        ref={containerRef}
        id="transfer-container"
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
            {isSubmitting ? 'Creating...' : 'Create Transfer'}
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
  optional: {
    fontWeight: '400',
    color: '#888',
  },
  input: {
    padding: '12px 16px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    outline: 'none',
  },
  hint: {
    fontSize: '12px',
    color: '#888',
    marginTop: '6px',
  },
  submitButton: {
    padding: '14px',
    fontSize: '16px',
    fontWeight: '600',
    color: '#fff',
    backgroundColor: '#f59e0b',
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
    borderTopColor: '#f59e0b',
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
    backgroundColor: '#f59e0b',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
};
