# Tank Card for Home Assistant

A custom Lovelace card that displays a hot water cylinder with a temperature gradient. Shows top and bottom temperatures with a colour scale from blue (cold) to red (hot).

![Tank Card Screenshot](Snapshot.png)

## Installation

1. Copy `tank-card.js` to your Home Assistant `config/www/` folder
2. Add the resource in **Settings > Dashboards > Resources**:
   - URL: `/local/tank-card.js`
   - Type: JavaScript module
3. Restart Home Assistant

## Usage

```yaml
type: custom:tank-card
entity_top: sensor.hot_water_top_temperature
entity_bottom: sensor.hot_water_bottom_temperature
name: Hot Water
min_temp: 10
max_temp: 65
```

## Options

| Option | Type | Default | Required | Description |
|---|---|---|---|---|
| `entity_top` | string | — | Yes | Entity ID for the top temperature sensor |
| `entity_bottom` | string | — | Yes | Entity ID for the bottom temperature sensor |
| `name` | string | `Hot Water` | No | Card title |
| `min_temp` | number | `10` | No | Minimum temperature for colour scale (°C) |
| `max_temp` | number | `65` | No | Maximum temperature for colour scale (°C) |
