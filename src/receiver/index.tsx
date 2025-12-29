import { h } from 'dom-chef';

const NAMESPACE = 'urn:x-cast:com.beat4beat';

interface TestMessage {
  type: string;
  data: string;
  timestamp: number;
}

interface MessageLog {
  timestamp: number;
  senderId: string;
  message: TestMessage;
}

const messageLog: MessageLog[] = [];

function updateStatus(message: string) {
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.textContent = message;
  }
  console.log(`[Receiver Status] ${message}`);
}

function updateLastMessage(message: TestMessage, senderId: string) {
  const lastMessageEl = document.getElementById('lastMessage');
  const messageTimeEl = document.getElementById('messageTime');

  if (lastMessageEl) {
    lastMessageEl.textContent = JSON.stringify(message, null, 2);
  }

  if (messageTimeEl) {
    const date = new Date(message.timestamp);
    messageTimeEl.textContent = `From: ${senderId} at ${date.toLocaleTimeString()}`;
  }
}

function addToMessageLog(log: MessageLog) {
  messageLog.push(log);

  const messageLogEl = document.getElementById('messageLog');
  if (!messageLogEl) return;

  const date = new Date(log.timestamp);
  const logEntry = (
    <div
      style={{
        marginBottom: '10px',
        padding: '8px',
        borderLeft: '3px solid #9c27b0',
        background: '#fafafa',
      }}
    >
      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
        {date.toLocaleTimeString()} - Sender: {log.senderId.substring(0, 8)}...
      </div>
      <div style={{ fontFamily: 'monospace', fontSize: '13px' }}>
        {JSON.stringify(log.message)}
      </div>
    </div>
  );

  if (messageLog.length === 1) {
    messageLogEl.innerHTML = '';
  }

  messageLogEl.appendChild(logEntry);
  messageLogEl.scrollTop = messageLogEl.scrollHeight;
}

function onMessageReceived(event: any) {
  const messageEvent = event as {
    senderId: string;
    data: string;
  };

  console.log('[Receiver] Message received:', messageEvent);

  try {
    const message: TestMessage = JSON.parse(messageEvent.data);

    updateLastMessage(message, messageEvent.senderId);

    addToMessageLog({
      timestamp: Date.now(),
      senderId: messageEvent.senderId,
      message,
    });

    const context = (cast.framework as any).CastReceiverContext.getInstance();
    const ackMessage = {
      type: 'ack',
      receivedType: message.type,
      timestamp: Date.now(),
    };

    context.sendCustomMessage(NAMESPACE, messageEvent.senderId, ackMessage);

    console.log('[Receiver] Sent acknowledgment:', ackMessage);
  } catch (err) {
    console.error('[Receiver] Error parsing message:', err);
    updateStatus(
      `Error: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

function initializeReceiver() {
  updateStatus('Setting up receiver...');

  try {
    const context = (cast.framework as any).CastReceiverContext.getInstance();

    context.addCustomMessageListener(NAMESPACE, onMessageReceived);

    const options = new (cast.framework as any).CastReceiverOptions();
    options.disableIdleTimeout = true;

    context.start(options);

    updateStatus('✅ Receiver ready - Waiting for connection');
    console.log('[Receiver] Initialized successfully');
    console.log(`[Receiver] Listening on namespace: ${NAMESPACE}`);
  } catch (err) {
    console.error('[Receiver] Initialization error:', err);
    updateStatus(
      `❌ Error: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

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
      <h1>Beat for Beat - Receiver</h1>
      <div
        style={{
          margin: '20px 0',
          padding: '15px',
          background: '#e8f5e9',
          borderRadius: '8px',
        }}
      >
        <h2>Status</h2>
        <p id="status">Initializing...</p>
      </div>
      <div
        style={{
          margin: '20px 0',
          padding: '15px',
          background: '#fff3e0',
          borderRadius: '8px',
        }}
      >
        <h2>Last Message</h2>
        <pre
          id="lastMessage"
          style={{ background: 'white', padding: '10px', borderRadius: '4px' }}
        >
          None
        </pre>
        <p id="messageTime" style={{ color: '#666', fontSize: '14px' }}></p>
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
  initializeReceiver();
}
