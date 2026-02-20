const CARD_VERSION = '1.0.1';
const DEFAULT_MIN_TEMP = 10;
const DEFAULT_MAX_TEMP = 65;
const COLD_HUE = 210;
const HOT_HUE = 0;
const SATURATION = 80;
const LIGHTNESS = 50;
const SVG_NS = 'http://www.w3.org/2000/svg';

class TankCard extends HTMLElement {

  static getStubConfig() {
    return {
      entity_top: '',
      entity_bottom: '',
      name: 'Hot Water',
      min_temp: DEFAULT_MIN_TEMP,
      max_temp: DEFAULT_MAX_TEMP,
    };
  }

  setConfig(config) {
    if (!config.entity_top) throw new Error('entity_top is required');
    if (!config.entity_bottom) throw new Error('entity_bottom is required');

    this._config = {
      name: 'Hot Water',
      min_temp: DEFAULT_MIN_TEMP,
      max_temp: DEFAULT_MAX_TEMP,
      ...config,
    };
    this._config.min_temp = Number(this._config.min_temp);
    this._config.max_temp = Number(this._config.max_temp);

    // Reset cached values so next hass update redraws
    this._lastTopTemp = undefined;
    this._lastBottomTemp = undefined;

    if (!this.shadowRoot) {
      this._buildCard();
    } else {
      this._haCard.header = this._config.name;
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;

    const topState = hass.states[this._config.entity_top];
    const bottomState = hass.states[this._config.entity_bottom];

    const topTemp = this._parseTemp(topState);
    const bottomTemp = this._parseTemp(bottomState);

    if (topTemp === this._lastTopTemp && bottomTemp === this._lastBottomTemp) return;
    this._lastTopTemp = topTemp;
    this._lastBottomTemp = bottomTemp;

    this._gradientStopTop.setAttribute('stop-color', this._tempToColour(topTemp));
    this._gradientStopBottom.setAttribute('stop-color', this._tempToColour(bottomTemp));

    const topUnit = topState?.attributes?.unit_of_measurement || '°C';
    const bottomUnit = bottomState?.attributes?.unit_of_measurement || '°C';

    this._topTempText.textContent = topTemp !== null
      ? `${topTemp.toFixed(1)} ${topUnit}` : '—';
    this._bottomTempText.textContent = bottomTemp !== null
      ? `${bottomTemp.toFixed(1)} ${bottomUnit}` : '—';
  }

  getCardSize() {
    return 4;
  }

  _parseTemp(stateObj) {
    if (!stateObj) return null;
    if (['unavailable', 'unknown'].includes(stateObj.state)) return null;
    const val = parseFloat(stateObj.state);
    return isNaN(val) ? null : val;
  }

  _tempToColour(temp) {
    if (temp === null) return 'hsl(210, 10%, 70%)';
    const min = this._config.min_temp;
    const max = this._config.max_temp;
    const range = max - min;
    const ratio = range === 0 ? 0.5 : Math.max(0, Math.min(1, (temp - min) / range));
    const hue = COLD_HUE - ratio * (COLD_HUE - HOT_HUE);
    return `hsl(${hue}, ${SATURATION}%, ${LIGHTNESS}%)`;
  }

  _buildCard() {
    const shadow = this.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      :host { display: block; }
      ha-card { overflow: hidden; }
      .card-content {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 16px 16px 24px;
      }
    `;
    shadow.appendChild(style);

    this._haCard = document.createElement('ha-card');
    this._haCard.header = this._config.name;

    const content = document.createElement('div');
    content.className = 'card-content';
    content.appendChild(this._buildSVG());

    this._haCard.appendChild(content);
    shadow.appendChild(this._haCard);
  }

  _buildSVG() {
    const uid = 'tg-' + Math.random().toString(36).slice(2, 8);

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 200 300');
    svg.style.width = '100%';
    svg.style.maxWidth = '200px';
    svg.style.display = 'block';
    svg.style.margin = '0 auto';

    // Defs container
    const defs = document.createElementNS(SVG_NS, 'defs');

    // Tank gradient
    const grad = document.createElementNS(SVG_NS, 'linearGradient');
    grad.setAttribute('id', uid);
    grad.setAttribute('x1', '0');
    grad.setAttribute('y1', '0');
    grad.setAttribute('x2', '0');
    grad.setAttribute('y2', '1');

    this._gradientStopTop = document.createElementNS(SVG_NS, 'stop');
    this._gradientStopTop.setAttribute('offset', '0%');
    this._gradientStopTop.setAttribute('stop-color', 'hsl(210, 10%, 70%)');

    this._gradientStopBottom = document.createElementNS(SVG_NS, 'stop');
    this._gradientStopBottom.setAttribute('offset', '100%');
    this._gradientStopBottom.setAttribute('stop-color', 'hsl(210, 10%, 70%)');

    grad.appendChild(this._gradientStopTop);
    grad.appendChild(this._gradientStopBottom);
    defs.appendChild(grad);

    // Drop shadow filter for text readability
    const shadowFilter = document.createElementNS(SVG_NS, 'filter');
    shadowFilter.setAttribute('id', 'shadow-' + uid);
    shadowFilter.setAttribute('x', '-20%');
    shadowFilter.setAttribute('y', '-20%');
    shadowFilter.setAttribute('width', '140%');
    shadowFilter.setAttribute('height', '140%');
    const feDropShadow = document.createElementNS(SVG_NS, 'feDropShadow');
    feDropShadow.setAttribute('dx', '0');
    feDropShadow.setAttribute('dy', '1');
    feDropShadow.setAttribute('stdDeviation', '2');
    feDropShadow.setAttribute('flood-color', 'rgba(0,0,0,0.6)');
    shadowFilter.appendChild(feDropShadow);
    defs.appendChild(shadowFilter);

    svg.appendChild(defs);

    // Tank body (pill shape)
    const body = document.createElementNS(SVG_NS, 'rect');
    body.setAttribute('x', '40');
    body.setAttribute('y', '20');
    body.setAttribute('width', '120');
    body.setAttribute('height', '260');
    body.setAttribute('rx', '60');
    body.setAttribute('ry', '60');
    body.setAttribute('fill', `url(#${uid})`);
    body.setAttribute('stroke', '#555');
    body.setAttribute('stroke-width', '2');
    svg.appendChild(body);

    // Highlight sheen for 3D effect
    const sheen = document.createElementNS(SVG_NS, 'rect');
    sheen.setAttribute('x', '55');
    sheen.setAttribute('y', '30');
    sheen.setAttribute('width', '30');
    sheen.setAttribute('height', '240');
    sheen.setAttribute('rx', '15');
    sheen.setAttribute('ry', '15');
    sheen.setAttribute('fill', 'rgba(255,255,255,0.15)');
    svg.appendChild(sheen);

    // Top pipe stub
    const pipeTop = document.createElementNS(SVG_NS, 'rect');
    pipeTop.setAttribute('x', '90');
    pipeTop.setAttribute('y', '5');
    pipeTop.setAttribute('width', '20');
    pipeTop.setAttribute('height', '20');
    pipeTop.setAttribute('rx', '3');
    pipeTop.setAttribute('fill', '#777');
    svg.appendChild(pipeTop);

    // Bottom pipe stub
    const pipeBot = document.createElementNS(SVG_NS, 'rect');
    pipeBot.setAttribute('x', '90');
    pipeBot.setAttribute('y', '275');
    pipeBot.setAttribute('width', '20');
    pipeBot.setAttribute('height', '20');
    pipeBot.setAttribute('rx', '3');
    pipeBot.setAttribute('fill', '#777');
    svg.appendChild(pipeBot);

    // Top temperature text
    this._topTempText = document.createElementNS(SVG_NS, 'text');
    this._topTempText.setAttribute('x', '100');
    this._topTempText.setAttribute('y', '80');
    this._topTempText.setAttribute('text-anchor', 'middle');
    this._topTempText.setAttribute('font-size', '22');
    this._topTempText.setAttribute('font-weight', 'bold');
    this._topTempText.setAttribute('fill', 'white');
    this._topTempText.setAttribute('filter', 'url(#shadow-' + uid + ')');
    this._topTempText.textContent = '—';
    svg.appendChild(this._topTempText);

    // Bottom temperature text
    this._bottomTempText = document.createElementNS(SVG_NS, 'text');
    this._bottomTempText.setAttribute('x', '100');
    this._bottomTempText.setAttribute('y', '245');
    this._bottomTempText.setAttribute('text-anchor', 'middle');
    this._bottomTempText.setAttribute('font-size', '22');
    this._bottomTempText.setAttribute('font-weight', 'bold');
    this._bottomTempText.setAttribute('fill', 'white');
    this._bottomTempText.setAttribute('filter', 'url(#shadow-' + uid + ')');
    this._bottomTempText.textContent = '—';
    svg.appendChild(this._bottomTempText);

    return svg;
  }
}

if (!customElements.get('tank-card')) {
  customElements.define('tank-card', TankCard);

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: 'tank-card',
    name: 'Tank Card',
    description: 'Displays a hot water cylinder with temperature gradient',
    preview: false,
  });

  console.info(
    `%c TANK-CARD %c v${CARD_VERSION} `,
    'color: white; background: #3498db; font-weight: bold;',
    'color: #3498db; background: white; font-weight: bold;'
  );
}
