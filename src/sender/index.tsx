import { h } from 'dom-chef';

const NAMESPACE = 'urn:x-cast:com.beat4beat';
const APP_ID = 'CC1AD845';

interface TestMessage {
  type: string;
  data: string;
  timestamp: number;
}

interface AckMessage {
  type: string;
  receivedType: string;
  timestamp: number;
}

let castSession: cast.framework.CastSession | null = null;
const messageLog: {
  timestamp: number;
  direction: string;
  message: unknown;
}[] = [];

function updateStatus(message: string) {
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.textContent = message;
  }
  console.log(`[Sender Status] ${message}`);
}

function updateUI() {
  const sendTestBtn = document.getElementById(
    'sendTestBtn'
  ) as HTMLButtonElement | null;
  const connectBtn = document.getElementById(
    'connectBtn'
  ) as HTMLButtonElement | null;

  if (sendTestBtn) {
    sendTestBtn.disabled = !castSession;
    if (castSession) {
      sendTestBtn.style.opacity = '1';
      sendTestBtn.style.cursor = 'pointer';
    } else {
      sendTestBtn.style.opacity = '0.5';
      sendTestBtn.style.cursor = 'not-allowed';
    }
  }

  if (connectBtn) {
    connectBtn.disabled = !!castSession;
    if (castSession) {
      connectBtn.textContent = 'Connected';
      connectBtn.style.opacity = '0.5';
      connectBtn.style.cursor = 'not-allowed';
    } else {
      connectBtn.textContent = 'Connect to Cast Device';
      connectBtn.style.opacity = '1';
      connectBtn.style.cursor = 'pointer';
    }
  }
}

function addToMessageLog(
  direction: string,
  message: TestMessage | AckMessage
) {
  messageLog.push({
    timestamp: Date.now(),
    direction,
    message,
  });

  const messageLogEl = document.getElementById('messageLog');
  if (!messageLogEl) return;

  const date = new Date();
  const isOutgoing = direction === 'sent';
  const logEntry = (
    <div
      style={{
        marginBottom: '10px',
        padding: '8px',
        borderLeft: `3px solid ${isOutgoing ? '#4caf50' : '#2196f3'}`,
        background: '#fafafa',
      }}
    >
      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
        {date.toLocaleTimeString()} - {direction.toUpperCase()}
      </div>
      <div style={{ fontFamily: 'monospace', fontSize: '13px' }}>
        {JSON.stringify(message)}
      </div>
    </div>
  );

  if (messageLog.length === 1) {
    messageLogEl.innerHTML = '';
  }

  messageLogEl.appendChild(logEntry);
  messageLogEl.scrollTop = messageLogEl.scrollHeight;
}

function onMessageReceived(_namespace: string, messageString: string) {
  console.log('[Sender] Message received:', messageString);

  try {
    const message: AckMessage = JSON.parse(messageString);
    addToMessageLog('received', message);
  } catch (err) {
    console.error('[Sender] Error parsing message:', err);
  }
}

async function requestCastSession() {
  try {
    const context = cast.framework.CastContext.getInstance();
    await context.requestSession();
    console.log('[Sender] Cast session requested');
  } catch (err) {
    console.error('[Sender] Error requesting session:', err);
    updateStatus(
      `❌ Connection failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

async function sendTestMessage() {
  if (!castSession) {
    updateStatus('❌ No active cast session');
    return;
  }

  const message: TestMessage = {
    type: 'test',
    data: 'hello from sender',
    timestamp: Date.now(),
  };

  try {
    await castSession.sendMessage(NAMESPACE, message);
    console.log('[Sender] Message sent:', message);
    addToMessageLog('sent', message);
    updateStatus('✅ Message sent successfully');
  } catch (err) {
    console.error('[Sender] Error sending message:', err);
    updateStatus(
      `❌ Error: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

function onSessionStateChanged(event: any) {
  console.log('[Sender] Session state changed:', event);

  castSession = cast.framework.CastContext.getInstance().getCurrentSession();

  if (castSession) {
    updateStatus(
      `✅ Connected to ${castSession.getCastDevice().friendlyName}`
    );

    castSession.addMessageListener(NAMESPACE, onMessageReceived);

    console.log('[Sender] Added message listener for namespace:', NAMESPACE);
  } else {
    updateStatus('⚪ Not connected');
  }

  updateUI();
}

function initializeCastApi() {
  console.log('[Sender] Initializing Cast API...');
  updateStatus('Initializing Cast API...');

  try {
    const context = cast.framework.CastContext.getInstance();

    context.setOptions({
      receiverApplicationId: APP_ID,
      autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
      resumeSavedSession: true,
    });

    context.addEventListener(
      cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
      onSessionStateChanged
    );

    castSession = context.getCurrentSession();
    if (castSession) {
      castSession.addMessageListener(NAMESPACE, onMessageReceived);
    }

    updateStatus('✅ Cast API initialized - Ready to cast');
    updateUI();

    const connectBtn = document.getElementById(
      'connectBtn'
    ) as HTMLButtonElement | null;
    if (connectBtn) connectBtn.disabled = false;

    console.log('[Sender] Cast API initialized successfully');
    console.log(`[Sender] App ID: ${APP_ID}`);
    console.log(`[Sender] Namespace: ${NAMESPACE}`);
  } catch (err) {
    console.error('[Sender] Cast API initialization error:', err);
    updateStatus(
      `❌ Error: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

window['__onGCastApiAvailable'] = (isAvailable: boolean) => {
  console.log('[Sender] Cast API available:', isAvailable);

  if (isAvailable) {
    initializeCastApi();
  } else {
    updateStatus('❌ Cast API not available');
  }
};

const app = document.getElementById('app');
if (app) {
  const ui = (
    <div
      style={{
        fontFamily: 'sans-serif',
        padding: '20px',
        maxWidth: '800px',
        margin: '0 auto',
      }}
    >
      <h1>Beat for Beat - Sender</h1>

      <div
        style={{
          margin: '20px 0',
          padding: '15px',
          background: '#e3f2fd',
          borderRadius: '8px',
        }}
      >
        <h2>Cast Control</h2>
        <button
          id="connectBtn"
          disabled
          onClick={requestCastSession}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            background: '#2196f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Connect to Cast Device
        </button>
        <p id="status" style={{ color: '#666', fontSize: '14px', marginTop: '10px' }}>
          SDK loading...
        </p>
      </div>

      <div
        style={{
          margin: '20px 0',
          padding: '15px',
          background: '#fff3e0',
          borderRadius: '8px',
        }}
      >
        <h2>Actions</h2>
        <button
          id="sendTestBtn"
          disabled
          onClick={sendTestMessage}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            background: '#ff9800',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Send Test Message
        </button>
      </div>

      <div
        style={{
          margin: '20px 0',
          padding: '15px',
          background: '#f3e5f5',
          borderRadius: '8px',
        }}
      >
        <h2>Message Log</h2>
        <div
          id="messageLog"
          style={{
            maxHeight: '300px',
            overflowY: 'auto',
            background: 'white',
            padding: '10px',
            borderRadius: '4px',
          }}
        >
          <p style={{ color: '#999' }}>No messages yet...</p>
        </div>
      </div>
    </div>
  );

  app.appendChild(ui);
}
