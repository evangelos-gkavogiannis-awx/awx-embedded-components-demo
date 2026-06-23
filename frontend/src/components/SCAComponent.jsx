import { useState, useEffect, useRef, useCallback } from 'react';
import { init, createElement } from '@airwallex/components-sdk';
import {
  embeddedMountContainerStyle,
  embeddedIframeStyles,
  embeddedPageContainerStyle,
} from '../embeddedComponentLayout';

const BASE = window.__API_BASE__ || '';

export default function SCAComponent({ credentials, onBack, setError }) {
  const [accountId, setAccountId] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [sdkReady, setSdkReady] = useState(false);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isLaunchingSetup, setIsLaunchingSetup] = useState(false);
  const [showSetupContainer, setShowSetupContainer] = useState(false);
  const [balanceData, setBalanceData] = useState(null);
  const [scaSessionCode, setScaSessionCode] = useState(null);
  const [pendingVerify, setPendingVerify] = useState(false);
  const setupElementRef = useRef(null);
  const verifyElementRef = useRef(null);
  const setupContainerRef = useRef(null);
  const verifyContainerRef = useRef(null);
  const pendingSessionCodeRef = useRef(null);

  const initializeSdk = useCallback(async () => {
    if (sdkReady) return;

    const authRes = await fetch(BASE + '/api/get-auth-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: credentials.clientId,
        apiKey: credentials.apiKey,
        accountId: accountId.trim(),
        identity: accountId.trim(),
        scopes: ['w:awx_action:sca_edit', 'r:awx_action:sca_view'],
      }),
    });

    const authData = await authRes.json();
    if (!authRes.ok) {
      throw new Error(authData.message || 'Failed to get auth code');
    }

    await init({
      locale: 'en',
      env: 'demo',
      enabledElements: ['risk'],
      authCode: authData.authCode,
      codeVerifier: authData.codeVerifier,
      clientId: credentials.clientId,
    });

    setSdkReady(true);
  }, [sdkReady, credentials, accountId]);

  const mountScaVerify = useCallback(async (sessionCode) => {
    if (!userEmail.trim()) {
      setPendingVerify(true);
      setScaSessionCode(sessionCode);
      pendingSessionCodeRef.current = sessionCode;
      setIsLoadingBalance(false);
      return;
    }

    await initializeSdk();

    if (verifyElementRef.current) {
      try {
        verifyElementRef.current.unmount();
      } catch {
        // ignore
      }
      verifyElementRef.current = null;
    }

    setScaSessionCode(sessionCode);
    setPendingVerify(false);
    pendingSessionCodeRef.current = sessionCode;

    const element = await createElement('scaVerify', {
      userEmail: userEmail.trim(),
      scaSessionCode: sessionCode,
    });

    verifyElementRef.current = element;

    element.on('ready', () => {
      setIsLoadingBalance(false);
    });

    element.on('verificationSucceed', async ({ token: scaToken }) => {
      try {
        const verifiedRes = await fetch(BASE + '/api/get-balance-verified', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: credentials.clientId,
            apiKey: credentials.apiKey,
            accountId: accountId.trim(),
            scaToken,
            scaSessionCode: sessionCode,
          }),
        });

        const verifiedData = await verifiedRes.json();
        if (!verifiedRes.ok) {
          throw new Error(verifiedData.message || 'SCA verification failed');
        }

        setBalanceData(verifiedData.balance);
        setScaSessionCode(null);
        setPendingVerify(false);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoadingBalance(false);
      }
    });

    element.on('verificationFailed', ({ reason }) => {
      setError(reason || 'SCA verification failed');
      setIsLoadingBalance(false);
    });

    element.on('cancel', () => {
      setIsLoadingBalance(false);
    });

    element.on('error', (event) => {
      setError(event?.message || 'SCA verification error');
      setIsLoadingBalance(false);
    });

    if (verifyContainerRef.current) {
      await element.mount(verifyContainerRef.current);
    }
  }, [userEmail, initializeSdk, credentials, accountId, setError]);

  const handleLaunchScaSetup = async () => {
    if (!accountId.trim() || !userEmail.trim()) {
      setError('Connected Account ID and user email are required for SCA Setup');
      return;
    }

    setIsLaunchingSetup(true);
    setShowSetupContainer(true);
    setError(null);
    setBalanceData(null);

    try {
      await initializeSdk();

      if (setupElementRef.current) {
        try {
          setupElementRef.current.unmount();
        } catch {
          // ignore
        }
      }

      const element = await createElement('scaManagement', {
        userEmail: userEmail.trim(),
        prefilledMobileInfo: {},
      });

      setupElementRef.current = element;

      element.on('ready', () => {
        setIsLaunchingSetup(false);
      });

      element.on('scaSetupSucceed', () => {
        setError(null);
      });

      element.on('cancel', () => {
        setIsLaunchingSetup(false);
      });

      element.on('error', (event) => {
        setError(event?.message || 'SCA setup failed');
        setIsLaunchingSetup(false);
      });

      if (setupContainerRef.current) {
        await element.mount(setupContainerRef.current);
      }
    } catch (err) {
      console.error('SCA setup error:', err);
      setError(err.message);
      setIsLaunchingSetup(false);
    }
  };

  const handleGetBalance = async () => {
    if (!accountId.trim()) {
      setError('Connected Account ID is required');
      return;
    }

    setIsLoadingBalance(true);
    setError(null);
    setBalanceData(null);
    setScaSessionCode(null);
    setPendingVerify(false);

    if (verifyElementRef.current) {
      try {
        verifyElementRef.current.unmount();
      } catch {
        // ignore
      }
      verifyElementRef.current = null;
    }

    try {
      const res = await fetch(BASE + '/api/get-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: credentials.clientId,
          apiKey: credentials.apiKey,
          accountId: accountId.trim(),
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.message || 'Failed to fetch balance');
      }

      if (result.code === 'sca_token_missing') {
        await mountScaVerify(result.sca_session_code);
      } else {
        setBalanceData(result.balance);
        setIsLoadingBalance(false);
      }
    } catch (err) {
      console.error('Get balance error:', err);
      setError(err.message);
      setIsLoadingBalance(false);
    }
  };

  const handleContinueVerify = async () => {
    if (!userEmail.trim()) {
      setError('Enter user email to complete SCA verification');
      return;
    }
    const sessionCode = pendingSessionCodeRef.current || scaSessionCode;
    if (!sessionCode) {
      setError('No SCA session found. Click GET Balance again.');
      return;
    }

    setIsLoadingBalance(true);
    setError(null);
    try {
      await mountScaVerify(sessionCode);
    } catch (err) {
      setError(err.message);
      setIsLoadingBalance(false);
    }
  };

  useEffect(() => {
    return () => {
      [setupElementRef, verifyElementRef].forEach((ref) => {
        if (ref.current) {
          try {
            ref.current.unmount();
          } catch {
            // ignore
          }
        }
      });
    };
  }, []);

  const canSetup = accountId.trim() && userEmail.trim();
  const canGetBalance = accountId.trim();

  const balanceItems = balanceData
    ? (Array.isArray(balanceData) ? balanceData : (balanceData?.items || []))
    : [];
  const nonZeroBalances = balanceItems.filter(b => (b.total_amount || 0) > 0);

  return (
    <div style={{ ...styles.container, ...embeddedPageContainerStyle }}>
      <div style={styles.header}>
        <button onClick={onBack} style={styles.backButton}>
          &larr; Back to components
        </button>
        <h1 style={styles.title}>SCA Embedded Component</h1>
        <p style={styles.subtitle}>
          Set up Strong Customer Authentication and test balance retrieval with SCA verify
        </p>
      </div>

      <div style={styles.formCard}>
        <h2 style={styles.formTitle}>Connected account details</h2>
        <p style={styles.formSubtitle}>
          Requires a platform with SCA enabled and an EU/UK connected account
        </p>
        <div style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Connected Account ID *</label>
            <input
              type="text"
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value);
                setSdkReady(false);
              }}
              placeholder="e.g., acct_xxxxxxxxxxxxxxxxxxxx"
              style={styles.input}
              required
            />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>
              User email {pendingVerify ? '*' : '(for SCA Setup / Verify)'}
            </label>
            <input
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="user@example.com"
              style={styles.input}
            />
            <p style={styles.hint}>
              Not needed for GET Balance. Required for SCA Setup, and for SCA Verify if authentication is triggered.
            </p>
          </div>
          <div style={styles.actionSections}>
            <div style={styles.actionBlock}>
              <button
                type="button"
                onClick={handleLaunchScaSetup}
                disabled={!canSetup || isLaunchingSetup}
                style={{
                  ...styles.primaryButton,
                  opacity: !canSetup || isLaunchingSetup ? 0.7 : 1,
                }}
              >
                {isLaunchingSetup ? 'Launching...' : 'Launch SCA Setup'}
              </button>
              <p style={styles.actionNote}>
                This is about to set up Strong Customer Authentication for the connected account user.
              </p>
            </div>
            <div style={styles.actionBlock}>
              <button
                type="button"
                onClick={handleGetBalance}
                disabled={!canGetBalance || isLoadingBalance}
                style={{
                  ...styles.secondaryButton,
                  opacity: !canGetBalance || isLoadingBalance ? 0.7 : 1,
                }}
              >
                {isLoadingBalance ? 'Loading...' : 'GET Balance'}
              </button>
              <p style={styles.actionNote}>
                Retrieves the balance of the connected account. SCA verification will be triggered automatically if required.
              </p>
            </div>
          </div>
          {pendingVerify && (
            <div style={styles.verifyPrompt}>
              <p style={styles.verifyPromptText}>
                SCA is required to view the balance. Enter the user email above, then continue verification.
              </p>
              <button
                type="button"
                onClick={handleContinueVerify}
                disabled={!userEmail.trim() || isLoadingBalance}
                style={{
                  ...styles.primaryButton,
                  opacity: !userEmail.trim() || isLoadingBalance ? 0.7 : 1,
                }}
              >
                Continue SCA Verify
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        ref={setupContainerRef}
        id="sca-setup-container"
        className="awx-embedded-mount"
        style={{
          ...embeddedMountContainerStyle,
          display: showSetupContainer ? 'block' : 'none',
          marginTop: showSetupContainer ? '24px' : 0,
        }}
      />

      {scaSessionCode && !pendingVerify && (
        <p style={styles.verifyHint}>SCA verification required — complete the form below</p>
      )}

      <div
        ref={verifyContainerRef}
        id="sca-verify-container"
        className="awx-embedded-mount"
        style={{
          ...embeddedMountContainerStyle,
          display: scaSessionCode && !pendingVerify ? 'block' : 'none',
          marginTop: scaSessionCode && !pendingVerify ? '24px' : 0,
        }}
      />

      {balanceData && (
        <div style={styles.balanceCard}>
          <h3 style={styles.balanceTitle}>Account Balance</h3>
          {nonZeroBalances.length === 0 ? (
            <p style={styles.noBalance}>No non-zero balances found for this account.</p>
          ) : (
            <div style={styles.balanceGrid}>
              {nonZeroBalances.map((b) => (
                <div key={b.currency} style={styles.balanceItem}>
                  <div style={styles.currencyTag}>{b.currency}</div>
                  <div style={styles.balanceRow}>
                    <span style={styles.balanceLabel}>Available</span>
                    <span style={styles.balanceValue}>{(b.available_amount || 0).toLocaleString()}</span>
                  </div>
                  {(b.pending_amount || 0) > 0 && (
                    <div style={styles.balanceRow}>
                      <span style={styles.balanceLabel}>Pending</span>
                      <span style={styles.balanceValue}>{b.pending_amount.toLocaleString()}</span>
                    </div>
                  )}
                  <div style={styles.balanceTotalRow}>
                    <span style={styles.balanceTotalLabel}>Total</span>
                    <span style={styles.balanceTotalValue}>{(b.total_amount || 0).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
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
    marginBottom: '24px',
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
  hint: {
    fontSize: '12px',
    color: '#888',
    marginTop: '6px',
  },
  actionSections: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '20px',
    alignItems: 'flex-start',
  },
  actionBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  actionNote: {
    fontSize: '12px',
    color: '#666',
    margin: 0,
    maxWidth: '220px',
    lineHeight: '1.5',
  },
  primaryButton: {
    padding: '14px 24px',
    fontSize: '15px',
    fontWeight: '600',
    color: '#fff',
    backgroundColor: '#e11d48',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  secondaryButton: {
    padding: '14px 24px',
    fontSize: '15px',
    fontWeight: '600',
    color: '#e11d48',
    backgroundColor: '#fff',
    border: '2px solid #e11d48',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  verifyPrompt: {
    padding: '16px',
    backgroundColor: '#fff7ed',
    border: '1px solid #fed7aa',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  verifyPromptText: {
    margin: 0,
    fontSize: '14px',
    color: '#9a3412',
  },
  verifyHint: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '12px',
  },
  balanceCard: {
    marginTop: '24px',
    backgroundColor: '#fff',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
  },
  balanceTitle: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '12px',
    color: '#1a1a1a',
  },
  noBalance: {
    fontSize: '14px',
    color: '#666',
    margin: 0,
  },
  balanceGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
  },
  balanceItem: {
    backgroundColor: '#f5f7fa',
    borderRadius: '12px',
    padding: '16px 20px',
    minWidth: '180px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  currencyTag: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#e11d48',
    marginBottom: '4px',
    letterSpacing: '0.5px',
  },
  balanceRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '24px',
  },
  balanceLabel: {
    fontSize: '12px',
    color: '#888',
  },
  balanceValue: {
    fontSize: '14px',
    color: '#333',
    fontWeight: '500',
  },
  balanceTotalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '24px',
    borderTop: '1px solid #e8e8e8',
    paddingTop: '8px',
    marginTop: '2px',
  },
  balanceTotalLabel: {
    fontSize: '12px',
    color: '#333',
    fontWeight: '600',
  },
  balanceTotalValue: {
    fontSize: '18px',
    color: '#1a1a1a',
    fontWeight: '700',
  },
};
