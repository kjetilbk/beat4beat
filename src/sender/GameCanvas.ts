export interface Card {
  id: number;
  content: string;
  revealed: boolean;
}

export interface GameState {
  cards: Card[];
}

export interface GameCanvas {
  element: HTMLCanvasElement;
  render(state: GameState): void;
  pickCard(id: number): Promise<void>;
  handleKeyPress(key: string): void;
  addEventListener: (
    event: 'card-picked',
    callback: (id: number) => void
  ) => void;
}

const WIDTH = 3840;
const HEIGHT = 2160;
const SCALE = 2;
const CARD_WIDTH = 160;
const CARD_HEIGHT = 260;
const GAP = 42;

export function createGameCanvas(): GameCanvas {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const ctx = canvas.getContext('2d')!;
  ctx.scale(SCALE, SCALE);

  const styles = getComputedStyle(document.documentElement);
  const colors = {
    bgDark: styles.getPropertyValue('--bg-dark').trim(),
    bg: styles.getPropertyValue('--bg').trim(),
    text: styles.getPropertyValue('--text').trim(),
  };

  let cardIds: number[] = [];
  let currentState: GameState | null = null;
  const eventListeners: { 'card-picked'?: Array<(id: number) => void> } = {};

  function renderFrontContent(card: Card) {
    ctx.fillStyle = colors.text;
    ctx.font = '92px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(card.id), 0, 0);
  }

  function renderBackContent(card: Card) {
    ctx.fillStyle = colors.text;
    ctx.font = '36px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(card.content, 0, 0);
  }

  function drawCard(x: number, y: number, card: Card, scaleX: number = 1) {
    ctx.save();

    const centerX = x + CARD_WIDTH / 2;
    const scaledWidth = CARD_WIDTH * scaleX;
    const scaledX = centerX - scaledWidth / 2;

    ctx.shadowColor = 'rgba(0, 0, 0, 0.19)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;

    ctx.fillStyle = colors.bg;
    ctx.beginPath();
    ctx.roundRect(scaledX, y, scaledWidth, CARD_HEIGHT, 3);
    ctx.fill();

    ctx.shadowColor = 'transparent';

    ctx.strokeStyle = colors.bg;
    ctx.lineWidth = 1;
    ctx.stroke();

    const gradient = ctx.createLinearGradient(scaledX, y, scaledX, y + 4);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.19)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(scaledX, y, scaledWidth, 4, [3, 3, 0, 0]);
    ctx.fill();

    if (scaleX > 0.05) {
      ctx.save();
      ctx.translate(centerX, y + CARD_HEIGHT / 2);
      ctx.scale(scaleX, 1);

      if (card.revealed) {
        renderBackContent(card);
      } else {
        renderFrontContent(card);
      }

      ctx.restore();
    }

    ctx.restore();
  }

  function drawFlippingCard(
    x: number,
    y: number,
    card: Card,
    progress: number
  ) {
    const cosTheta = 1 - 2 * progress;
    const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
    const isFirstHalf = cosTheta > 0;

    const perspectiveDistance = 300;
    const centerX = x + CARD_WIDTH / 2;
    const centerY = y + CARD_HEIGHT / 2;

    function projectPoint(xLocal: number, yLocal: number): [number, number] {
      const xRotated = xLocal * cosTheta;
      const z = xLocal * sinTheta;
      const scale = 1 / (1 + z / perspectiveDistance);
      return [xRotated * scale, yLocal * scale];
    }

    const hw = CARD_WIDTH / 2;
    const hh = CARD_HEIGHT / 2;

    const [topLeftX, topLeftY] = projectPoint(-hw, -hh);
    const [topRightX, topRightY] = projectPoint(hw, -hh);
    const [bottomRightX, bottomRightY] = projectPoint(hw, hh);
    const [bottomLeftX, bottomLeftY] = projectPoint(-hw, hh);

    ctx.save();
    ctx.translate(centerX, centerY);

    ctx.shadowColor = 'rgba(0, 0, 0, 0.19)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;

    ctx.fillStyle = colors.bg;
    ctx.beginPath();
    ctx.moveTo(topLeftX, topLeftY);
    ctx.lineTo(topRightX, topRightY);
    ctx.lineTo(bottomRightX, bottomRightY);
    ctx.lineTo(bottomLeftX, bottomLeftY);
    ctx.closePath();
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = colors.bg;
    ctx.lineWidth = 1;
    ctx.stroke();

    if (Math.abs(topLeftX - topRightX) > 5) {
      ctx.save();

      const scaleXAmount = Math.abs(topRightX - topLeftX) / CARD_WIDTH;
      const scaleYAmount = (bottomRightY - topRightY) / CARD_HEIGHT;

      ctx.scale(scaleXAmount, scaleYAmount);

      if (isFirstHalf) {
        renderFrontContent(card);
      } else {
        renderBackContent(card);
      }

      ctx.restore();
    }

    ctx.restore();
  }

  function calculateGrid(cardCount: number) {
    const maxCols = Math.floor((WIDTH / SCALE + GAP) / (CARD_WIDTH + GAP));
    const cols = Math.min(cardCount, maxCols);
    const rows = Math.ceil(cardCount / cols);

    const gridWidth = cols * CARD_WIDTH + (cols - 1) * GAP;
    const gridHeight = rows * CARD_HEIGHT + (rows - 1) * GAP;
    const startX = (WIDTH / SCALE - gridWidth) / 2;
    const startY = (HEIGHT / SCALE - gridHeight) / 2;

    return { cols, rows, startX, startY };
  }

  function render(
    state: GameState,
    animatingCardIndex?: number,
    flipProgress?: number
  ) {
    currentState = state;
    cardIds = state.cards.map((c) => c.id);

    ctx.clearRect(0, 0, WIDTH / SCALE, HEIGHT / SCALE);
    ctx.fillStyle = colors.bgDark;
    ctx.fillRect(0, 0, WIDTH / SCALE, HEIGHT / SCALE);

    const { cols, startX, startY } = calculateGrid(state.cards.length);

    state.cards.forEach((card, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = startX + col * (CARD_WIDTH + GAP);
      const y = startY + row * (CARD_HEIGHT + GAP);

      if (index === animatingCardIndex && flipProgress !== undefined) {
        drawFlippingCard(x, y, card, flipProgress);
      } else {
        drawCard(x, y, card);
      }
    });
  }

  function addEventListener(
    event: 'card-picked',
    callback: (id: number) => void
  ) {
    if (!eventListeners[event]) {
      eventListeners[event] = [];
    }
    eventListeners[event]!.push(callback);
  }

  function handleKeyPress(key: string) {
    const keyNum = parseInt(key);
    if (isNaN(keyNum)) return;

    const cardIndex = keyNum - 1;

    if (cardIndex < 0 || cardIndex >= cardIds.length) return;

    const cardId = cardIds[cardIndex];
    if (cardId === undefined) return;

    eventListeners['card-picked']?.forEach((cb) => cb(cardId));
  }

  async function pickCard(id: number): Promise<void> {
    if (!currentState) return;

    const cardIndex = currentState.cards.findIndex((c) => c.id === id);
    if (cardIndex === -1) return;

    const duration = 400;
    const startTime = performance.now();

    return new Promise((resolve) => {
      function animate(currentTime: number) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        render(currentState!, cardIndex, progress);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      }

      requestAnimationFrame(animate);
    });
  }

  return {
    element: canvas,
    render,
    pickCard,
    addEventListener,
    handleKeyPress,
  };
}
