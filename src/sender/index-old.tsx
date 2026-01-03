import { h } from 'dom-chef';

const NAMESPACE = 'urn:x-cast:com.beat4beat';
const APP_ID = process.env.CAST_APP_ID!;

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

type AppMode = 'landing' | 'screen' | 'chromecast' | 'airplay';

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
    console.log({context})
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
      autoJoinPolicy: chrome.cast.AutoJoinPolicy.PAGE_SCOPED,
      resumeSavedSession: false,
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

function showAirPlayPicker() {
  const video = document.getElementById('airplayVideo') as HTMLVideoElement & {
    webkitShowPlaybackTargetPicker?: () => void;
  };

  if (video && video.webkitShowPlaybackTargetPicker) {
    video.webkitShowPlaybackTargetPicker();
  } else {
    alert('AirPlay not available. Use Safari on iOS/macOS.');
  }
}

function showMode(mode: AppMode) {
  const landing = document.getElementById('mode-landing');
  const screen = document.getElementById('mode-screen');
  const chromecast = document.getElementById('mode-chromecast');
  const airplay = document.getElementById('mode-airplay');

  if (landing) landing.style.display = 'none';
  if (screen) screen.style.display = 'none';
  if (chromecast) chromecast.style.display = 'none';
  if (airplay) airplay.style.display = 'none';

  if (mode === 'screen' && screen) {
    screen.style.display = 'block';
    setupScreenCanvas();
  } else if (mode === 'chromecast' && chromecast) {
    chromecast.style.display = 'block';
  } else if (mode === 'airplay' && airplay) {
    airplay.style.display = 'block';
    setupAirPlayCanvas();
  }
}

function setupScreenCanvas() {
  const canvas = document.getElementById('screenCanvas') as HTMLCanvasElement;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const safeCtx = ctx;

  function drawGameBoard() {
    safeCtx.fillStyle = '#1a1a2e';
    safeCtx.fillRect(0, 0, canvas.width, canvas.height);

    safeCtx.fillStyle = '#16213e';
    safeCtx.fillRect(50, 50, canvas.width - 100, canvas.height - 100);

    safeCtx.fillStyle = '#0f3460';
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 4; j++) {
        const x = 100 + j * 200;
        const y = 100 + i * 150;
        safeCtx.fillRect(x, y, 180, 130);
      }
    }

    safeCtx.fillStyle = '#e94560';
    safeCtx.font = 'bold 48px sans-serif';
    safeCtx.textAlign = 'center';
    safeCtx.fillText('Beat for Beat', canvas.width / 2, canvas.height / 2);

    safeCtx.fillStyle = '#ffffff';
    safeCtx.font = '24px sans-serif';
    safeCtx.fillText('Screen Mode - Mirror this tab to TV', canvas.width / 2, canvas.height / 2 + 50);

    const time = new Date().toLocaleTimeString();
    safeCtx.font = '18px monospace';
    safeCtx.fillText(time, canvas.width / 2, canvas.height - 50);
  }

  drawGameBoard();
  setInterval(drawGameBoard, 1000);

  console.log('[Screen] Canvas initialized');
}

function setupAirPlayCanvas() {
  const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
  const video = document.getElementById('airplayVideo') as HTMLVideoElement;

  if (!canvas || !video) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const safeCtx = ctx;

  function drawGameBoard() {
    safeCtx.fillStyle = '#1a1a2e';
    safeCtx.fillRect(0, 0, canvas.width, canvas.height);

    safeCtx.fillStyle = '#16213e';
    safeCtx.fillRect(50, 50, canvas.width - 100, canvas.height - 100);

    safeCtx.fillStyle = '#0f3460';
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 4; j++) {
        const x = 100 + j * 200;
        const y = 100 + i * 150;
        safeCtx.fillRect(x, y, 180, 130);
      }
    }

    safeCtx.fillStyle = '#e94560';
    safeCtx.font = 'bold 48px sans-serif';
    safeCtx.textAlign = 'center';
    safeCtx.fillText('Beat for Beat', canvas.width / 2, canvas.height / 2);

    safeCtx.fillStyle = '#ffffff';
    safeCtx.font = '24px sans-serif';
    safeCtx.fillText('AirPlay Game Board', canvas.width / 2, canvas.height / 2 + 50);

    const time = new Date().toLocaleTimeString();
    safeCtx.font = '18px monospace';
    safeCtx.fillText(time, canvas.width / 2, canvas.height - 50);
  }

  drawGameBoard();
  setInterval(drawGameBoard, 1000);

  const stream = canvas.captureStream(30);
  video.srcObject = stream;
  video.play();

  console.log('[AirPlay] Canvas stream initialized');
}

const app = document.getElementById('app');
if (app) {
  const ui = (
    <div
      style={{
        fontFamily: 'sans-serif',
        padding: '20px',
        margin: '0 auto',
      }}
    >
      <div id="mode-landing" style={{ display: 'block', maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ textAlign: 'center', fontSize: '48px', marginBottom: '20px' }}>Beat for Beat</h1>
        <p style={{ textAlign: 'center', fontSize: '18px', color: '#666', marginBottom: '40px' }}>
          Choose how to display the game board
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '30px',
            maxWidth: '1000px',
            margin: '0 auto',
          }}
        >
          <div
            onClick={() => showMode('screen')}
            style={{
              padding: '40px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '12px',
              cursor: 'pointer',
              textAlign: 'center',
              color: 'white',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.transform = 'scale(1.05)'; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.transform = 'scale(1)'; }}
          >
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>🖥️</div>
            <h2 style={{ fontSize: '28px', marginBottom: '15px' }}>This Screen</h2>
            <p style={{ fontSize: '16px', opacity: 0.9 }}>
              Display game board here, then mirror your screen to TV
            </p>
          </div>

          <div
            onClick={() => showMode('chromecast')}
            style={{
              padding: '40px',
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              borderRadius: '12px',
              cursor: 'pointer',
              textAlign: 'center',
              color: 'white',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.transform = 'scale(1.05)'; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.transform = 'scale(1)'; }}
          >
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>📺</div>
            <h2 style={{ fontSize: '28px', marginBottom: '15px' }}>Chromecast</h2>
            <p style={{ fontSize: '16px', opacity: 0.9 }}>
              Cast directly to Chromecast device with custom receiver
            </p>
          </div>

          <div
            onClick={() => showMode('airplay')}
            style={{
              padding: '40px',
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              borderRadius: '12px',
              cursor: 'pointer',
              textAlign: 'center',
              color: 'white',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.transform = 'scale(1.05)'; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.transform = 'scale(1)'; }}
          >
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>📡</div>
            <h2 style={{ fontSize: '28px', marginBottom: '15px' }}>AirPlay</h2>
            <p style={{ fontSize: '16px', opacity: 0.9 }}>
              Stream game board to Apple TV via AirPlay
            </p>
          </div>
        </div>
      </div>

      <div id="mode-screen" style={{ display: 'none', maxWidth: '1200px', margin: '0 auto' }}>
        <h1>Screen Mode</h1>
        <p style={{ fontSize: '18px', color: '#666', marginBottom: '20px' }}>
          Use your OS screen sharing to mirror this tab to your TV
        </p>
        <div style={{ textAlign: 'center' }}>
          <canvas
            id="screenCanvas"
            width={1920}
            height={1080}
            style={{
              width: '100%',
              maxWidth: '900px',
              background: '#000',
              borderRadius: '8px',
            }}
          />
        </div>
      </div>

      <div id="mode-chromecast" style={{ display: 'none', maxWidth: '800px', margin: '0 auto' }}>
        <h1>Chromecast Mode</h1>

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

      <div id="mode-airplay" style={{ display: 'none', maxWidth: '800px', margin: '0 auto' }}>
        <h1>AirPlay Mode</h1>

        <div
          style={{
            margin: '20px 0',
            padding: '15px',
            background: '#e8f5e9',
            borderRadius: '8px',
          }}
        >
          <h2>AirPlay Stream</h2>
          <button
            onClick={showAirPlayPicker}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              background: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginBottom: '10px',
            }}
          >
            📺 Connect to Apple TV
          </button>
          <p style={{ color: '#666', fontSize: '14px', marginBottom: '10px' }}>
            Stream game board to Apple TV via AirPlay
          </p>
          <canvas
            id="gameCanvas"
            width={1920}
            height={1080}
            style={{
              display: 'none',
            }}
          />
          <video
            id="airplayVideo"
            x-webkit-airplay="allow"
            webkit-playsinline="true"
            playsInline={false}
            style={{
              width: '100%',
              maxWidth: '600px',
              background: '#000',
              borderRadius: '4px',
              display: 'none',
            }}
          />
          <p style={{ color: '#999', fontSize: '12px', marginTop: '8px', fontStyle: 'italic' }}>
            Note: Requires Safari on iOS/macOS with Apple TV on same network
          </p>
        </div>
      </div>
    </div>
  );

  app.appendChild(ui);
}
