const CARD_VERSION = '1.2.0';
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
      entity_mid: '',
      entity_bottom: '',
      name: 'Hot Water',
      min_temp: DEFAULT_MIN_TEMP,
      max_temp: DEFAULT_MAX_TEMP,
      entity_boost: '',
    };
  }

  static getConfigForm() {
    return {
      schema: [
        { name: 'name', selector: { text: {} } },
        { name: 'entity_top', required: true, selector: { entity: { domain: 'sensor' } } },
        { name: 'entity_mid', selector: { entity: { domain: 'sensor' } } },
        { name: 'entity_bottom', required: true, selector: { entity: { domain: 'sensor' } } },
        { name: 'entity_boost', selector: { entity: { domain: ['switch', 'input_boolean'] } } },
        { name: 'min_temp', selector: { number: { min: 0, max: 100, step: 1, unit_of_measurement: '°C' } } },
        { name: 'max_temp', selector: { number: { min: 0, max: 100, step: 1, unit_of_measurement: '°C' } } },
      ],
      assertConfig: (config) => {
        if (!config.entity_top) throw new Error('entity_top is required');
        if (!config.entity_bottom) throw new Error('entity_bottom is required');
      },
      computeLabel: (schema) => {
        const labels = {
          name: 'Card Title',
          entity_top: 'Top Temperature Sensor',
          entity_mid: 'Middle Temperature Sensor (optional)',
          entity_bottom: 'Bottom Temperature Sensor',
          entity_boost: 'Boost Heater Switch (optional)',
          min_temp: 'Minimum Temperature',
          max_temp: 'Maximum Temperature',
        };
        return labels[schema.name] ?? schema.name;
      },
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
    this._lastMidTemp = undefined;
    this._lastBottomTemp = undefined;
    this._lastBoostOn = undefined;

    const structureChanged = this.shadowRoot && (
      this._builtWithMid !== !!this._config.entity_mid ||
      this._builtWithBoost !== !!this._config.entity_boost
    );

    if (!this.shadowRoot) {
      this._buildCard();
    } else if (structureChanged) {
      this.shadowRoot.replaceChildren();
      this._buildCard();
    } else {
      this._haCard.header = this._config.name;
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;

    const topState = hass.states[this._config.entity_top];
    const midState = this._config.entity_mid ? hass.states[this._config.entity_mid] : null;
    const bottomState = hass.states[this._config.entity_bottom];

    const topTemp = this._parseTemp(topState);
    const midTemp = this._parseTemp(midState);
    const bottomTemp = this._parseTemp(bottomState);

    // Update boost button state
    if (this._config.entity_boost && this._boostBtn) {
      const boostState = hass.states[this._config.entity_boost];
      const boostOn = boostState?.state === 'on';
      if (boostOn !== this._lastBoostOn) {
        this._lastBoostOn = boostOn;
        this._boostBtn.style.background = boostOn
          ? 'rgba(255, 160, 0, 0.9)' : 'rgba(120, 120, 120, 0.5)';
        this._boostBtn.style.color = boostOn ? '#fff' : 'rgba(255,255,255,0.6)';
        this._boostBtn.classList.toggle('active', boostOn);
        this._boostBtn.title = boostOn ? 'Boost ON — tap to turn off' : 'Boost OFF — tap to turn on';
      }
    }

    if (topTemp === this._lastTopTemp && midTemp === this._lastMidTemp && bottomTemp === this._lastBottomTemp) return;
    this._lastTopTemp = topTemp;
    this._lastMidTemp = midTemp;
    this._lastBottomTemp = bottomTemp;

    this._gradientStopTop.setAttribute('stop-color', this._tempToColour(topTemp));
    this._gradientStopBottom.setAttribute('stop-color', this._tempToColour(bottomTemp));
    if (this._gradientStopMid) {
      this._gradientStopMid.setAttribute('stop-color', this._tempToColour(midTemp));
    }

    const topUnit = topState?.attributes?.unit_of_measurement || '°C';
    const bottomUnit = bottomState?.attributes?.unit_of_measurement || '°C';

    this._topTempText.textContent = topTemp !== null
      ? `${topTemp.toFixed(1)} ${topUnit}` : '—';
    this._bottomTempText.textContent = bottomTemp !== null
      ? `${bottomTemp.toFixed(1)} ${bottomUnit}` : '—';
    if (this._midTempText) {
      const midUnit = midState?.attributes?.unit_of_measurement || '°C';
      this._midTempText.textContent = midTemp !== null
        ? `${midTemp.toFixed(1)} ${midUnit}` : '—';
    }
  }

  getCardSize() {
    return 4;
  }

  _toggleBoost() {
    if (!this._hass || !this._config.entity_boost) return;
    const [domain] = this._config.entity_boost.split('.');
    this._hass.callService(domain, 'toggle', {
      entity_id: this._config.entity_boost,
    });
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
    const shadow = this.shadowRoot || this.attachShadow({ mode: 'open' });
    this._builtWithMid = !!this._config.entity_mid;
    this._builtWithBoost = !!this._config.entity_boost;

    const style = document.createElement('style');
    style.textContent = `
      :host { display: block; }
      ha-card { overflow: hidden; }
      .card-content {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 16px 16px 24px;
        gap: 12px;
      }
      .boost-btn {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(120, 120, 120, 0.5);
        color: rgba(255,255,255,0.6);
        transition: background 0.3s, color 0.3s;
        flex-shrink: 0;
      }
      .boost-btn:active {
        transform: scale(0.93);
      }
      .boost-btn.active {
        animation: boost-pulse 2s ease-in-out infinite;
      }
      @keyframes boost-pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(255, 160, 0, 0.6); }
        50% { box-shadow: 0 0 12px 4px rgba(255, 160, 0, 0.3); }
      }
      .boost-btn ha-icon {
        --mdc-icon-size: 28px;
      }
    `;
    shadow.appendChild(style);

    this._haCard = document.createElement('ha-card');
    this._haCard.header = this._config.name;

    const content = document.createElement('div');
    content.className = 'card-content';

    if (this._config.entity_boost) {
      this._boostBtn = document.createElement('button');
      this._boostBtn.className = 'boost-btn';
      this._boostBtn.title = 'Boost OFF — tap to turn on';
      const icon = document.createElement('ha-icon');
      icon.setAttribute('icon', 'mdi:lightning-bolt');
      this._boostBtn.appendChild(icon);
      this._boostBtn.addEventListener('click', () => this._toggleBoost());
      content.appendChild(this._boostBtn);
    }

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
    if (this._config.entity_mid) {
      this._gradientStopMid = document.createElementNS(SVG_NS, 'stop');
      this._gradientStopMid.setAttribute('offset', '50%');
      this._gradientStopMid.setAttribute('stop-color', 'hsl(210, 10%, 70%)');
      grad.appendChild(this._gradientStopMid);
    } else {
      this._gradientStopMid = null;
    }
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

    // Clip path to keep bubbles inside the tank body
    const clipPath = document.createElementNS(SVG_NS, 'clipPath');
    clipPath.setAttribute('id', 'tank-clip-' + uid);
    const clipRect = document.createElementNS(SVG_NS, 'rect');
    clipRect.setAttribute('x', '42');
    clipRect.setAttribute('y', '22');
    clipRect.setAttribute('width', '116');
    clipRect.setAttribute('height', '256');
    clipRect.setAttribute('rx', '58');
    clipRect.setAttribute('ry', '58');
    clipPath.appendChild(clipRect);
    defs.appendChild(clipPath);

    // Bubbling water — rising bubbles clipped to tank
    const bubbleGroup = document.createElementNS(SVG_NS, 'g');
    bubbleGroup.setAttribute('clip-path', `url(#tank-clip-${uid})`);
    const bubbles = [
      { cx: 75,  r: 4,   dur: '5s',   delay: '0s'   },
      { cx: 110, r: 3,   dur: '4.2s', delay: '1.5s' },
      { cx: 90,  r: 3.5, dur: '6s',   delay: '0.8s' },
      { cx: 125, r: 2.5, dur: '4.8s', delay: '2.5s' },
      { cx: 80,  r: 2,   dur: '5.5s', delay: '3.2s' },
      { cx: 105, r: 3,   dur: '4.5s', delay: '1.2s' },
      { cx: 135, r: 2,   dur: '5.8s', delay: '0.5s' },
      { cx: 70,  r: 2.5, dur: '4s',   delay: '2s'   },
    ];
    for (const b of bubbles) {
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('cx', String(b.cx));
      circle.setAttribute('cy', '270');
      circle.setAttribute('r', String(b.r));
      circle.setAttribute('fill', 'rgba(255, 255, 255, 0.25)');

      const rise = document.createElementNS(SVG_NS, 'animate');
      rise.setAttribute('attributeName', 'cy');
      rise.setAttribute('values', '270;30');
      rise.setAttribute('dur', b.dur);
      rise.setAttribute('begin', b.delay);
      rise.setAttribute('repeatCount', 'indefinite');
      circle.appendChild(rise);

      const fade = document.createElementNS(SVG_NS, 'animate');
      fade.setAttribute('attributeName', 'opacity');
      fade.setAttribute('values', '0;0.7;0.5;0');
      fade.setAttribute('dur', b.dur);
      fade.setAttribute('begin', b.delay);
      fade.setAttribute('repeatCount', 'indefinite');
      circle.appendChild(fade);

      bubbleGroup.appendChild(circle);
    }
    svg.appendChild(bubbleGroup);

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

    // Mid temperature text (optional)
    if (this._config.entity_mid) {
      this._midTempText = document.createElementNS(SVG_NS, 'text');
      this._midTempText.setAttribute('x', '100');
      this._midTempText.setAttribute('y', '162');
      this._midTempText.setAttribute('text-anchor', 'middle');
      this._midTempText.setAttribute('font-size', '22');
      this._midTempText.setAttribute('font-weight', 'bold');
      this._midTempText.setAttribute('fill', 'white');
      this._midTempText.setAttribute('filter', 'url(#shadow-' + uid + ')');
      this._midTempText.textContent = '—';
      svg.appendChild(this._midTempText);
    } else {
      this._midTempText = null;
    }

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
