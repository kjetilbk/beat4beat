import { h } from 'dom-chef';
import * as icons from './icons';
import { createGameCanvas } from './GameCanvas';

const landingUi = (
  <main>
    <div className="mode-picker">
      <div className="mode-icon">
        <icons.Chromecast />
      </div>
      <div className="mode-title">Chromecast</div>
      <div className="mode-description">
        May not work with built-in TV Chromecast
      </div>
    </div>
    <div className="mode-picker">
      <div className="mode-icon">
        <icons.Airplay />
      </div>
      <div className="mode-title">AirPlay</div>
      <div className="mode-description">Stream game board using AirPlay</div>
    </div>
    <div
      className="mode-picker"
      onClick={() => {
        window.app.removeChild(landingUi);
        window.app.appendChild(thisScreenUi);
      }}
    >
      <div className="mode-icon">
        <icons.Screen />
      </div>
      <div className="mode-title">This screen</div>
      <div className="mode-description">
        Display game board here (for HDMI etc)
      </div>
    </div>
  </main>
);

const gameState = {
  cards: [
    { id: 1, content: 'love', revealed: false },
    { id: 2, content: 'summer', revealed: false },
    { id: 3, content: 'skip', revealed: false },
  ],
};

const gameCanvas = createGameCanvas();

gameCanvas.element.style.width = '100vw';
gameCanvas.element.style.height = '100vh';
gameCanvas.element.style.objectFit = 'contain';

document.addEventListener('keyup', (e: KeyboardEvent) => {
  gameCanvas.handleKeyPress(e.key);
});

gameCanvas.addEventListener('card-picked', async (id: number) => {
  console.log('Card picked:', id);
  const card = gameState.cards.find((c) => c.id === id);
  await gameCanvas.pickCard(id);
  if (card) {
    card.revealed = true;
    gameCanvas.render(gameState);
  }
});

gameCanvas.render(gameState);

const styles = getComputedStyle(document.documentElement);
const bgDark = styles.getPropertyValue('--bg-dark').trim();

const thisScreenUi = (
  <main
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100vw',
      height: '100vh',
      background: bgDark,
    }}
  >
    {gameCanvas.element}
  </main>
);

window.app.appendChild(landingUi);
