# Plan for Implementing Zoom-Based Information Display in DataMapPlot

## Overview
This plan outlines the steps required to implement a feature in DataMapPlot that automatically displays information about data points when the user zooms in beyond a certain threshold, without requiring hover interaction.

## Current State
Currently, DataMapPlot provides several ways to display information:
1. Hover text that appears when a user mouses over a point
2. Static labels for clusters/groups of points
3. No built-in way to show text labels on individual points based on zoom level

## Implementation Goals
1. Add the ability to display text labels on points when zoomed in past a certain threshold
2. Make the feature customizable in terms of appearance, content, and zoom level trigger
3. Ensure performance remains good even with large datasets
4. Maintain compatibility with existing features

## Implementation Steps

### 1. Modify Python API (datamapplot/create_plots.py and datamapplot/interactive_rendering.py)

#### New Parameters for `create_interactive_plot` and `render_html`:
- `point_text_field`: Field from data to use as text for points (e.g., "handle")
- `point_text_min_zoom`: Zoom level at which point text becomes visible (e.g., 8)
- `point_text_size`: Font size for point text (e.g., 12)
- `point_text_offset`: [x, y] offset for positioning text relative to points (e.g., [0, 14])
- `point_text_outline_width`: Width of text outline for better readability (e.g., 2)
- `point_text_outline_color`: Color for the text outline (e.g., [255, 255, 255, 200])
- `point_text_font_family`: Font family for point text (defaults to main font_family)
- `point_text_template`: Optional HTML template for more complex displays

#### Implementation in `render_html`:
1. Add the new parameters with appropriate defaults
2. Pass these parameters to the JavaScript through the HTML template
3. Update the dataframe to include the field specified in `point_text_field` if not already present

### 2. Modify JavaScript (datamapplot/static/js/datamap.js)

#### Create a new `PointTextLayer` class that leverages viewport filtering:
```javascript
addPointText(textField, {
  pointTextMinZoom = 8,
  pointTextSize = 12,
  pointTextOffset = [0, 14],
  pointTextOutlineWidth = 2, 
  pointTextOutlineColor = [255, 255, 255, 200],
  fontFamily = this.fontFamily,
  fontWeight = 600,
}) {
  // Create a new text layer for point labels that only shows when zoomed in
  this.pointTextLayer = new deck.TextLayer({
    id: 'pointTextLayer',
    data: this.pointLayer.props.data,  // Use same data as point layer
    pickable: false,
    getPosition: d => [d.attributes.getPosition.value[d.index * 2], 
                       d.attributes.getPosition.value[d.index * 2 + 1]],
    getText: d => this.metaData[textField][d.index],
    getColor: [255, 255, 255],  // Default color
    getSize: pointTextSize,
    sizeScale: 1,
    getPixelOffset: pointTextOffset,
    outlineWidth: pointTextOutlineWidth,
    outlineColor: pointTextOutlineColor,
    background: false,
    fontFamily: fontFamily,
    fontWeight: fontWeight,
    characterSet: "auto",
    visible: false,  // Start hidden
    
    // Critical for performance - only render text for points in the current viewport
    // This uses deck.gl's built-in viewport filtering
    _filterData: ({props, attributes, context}) => {
      const {viewport} = context;
      return props.data.filter((d, i) => {
        const x = attributes.getPosition.value[i * 2];
        const y = attributes.getPosition.value[i * 2 + 1];
        // Only include points that are in the current viewport
        return viewport.containsPixel([x, y]);
      });
    },
    updateTriggers: {
      _filterData: [context.viewport]
    }
  });
  
  this.layers.push(this.pointTextLayer);
  this.layers.sort((a, b) => getLayerIndex(a) - getLayerIndex(b));
  this.deckgl.setProps({ layers: [...this.layers] });
  
  // Add event listener for viewState changes to check zoom level
  this.pointTextMinZoom = pointTextMinZoom;
  this.deckgl.setProps({
    onViewStateChange: ({viewState}) => {
      if (this.pointTextLayer) {
        const visible = viewState.zoom >= this.pointTextMinZoom;
        if (visible !== this.pointTextLayer.props.visible) {
          this.pointTextLayer.setProps({ visible });
        }
      }
    }
  });
}
```

#### Update LAYER_ORDER constant:
```javascript
LAYER_ORDER = ['imageLayer', 'dataPointLayer', 'pointTextLayer', 'boundaryLayer', 'LabelLayer'];
```

#### Update DataMap constructor to handle viewState changes:
1. Save initial viewState settings
2. Add handler for viewState changes

### 3. Modify the HTML Template (datamapplot/deckgl_template.html)

#### Add code to initialize point text layer if enabled:
```javascript
{%- if point_text_field %}
// Add point text layer
datamap.addPointText("{{ point_text_field }}", {
  pointTextMinZoom: {{ point_text_min_zoom }},
  pointTextSize: {{ point_text_size }},
  pointTextOffset: {{ point_text_offset }},
  pointTextOutlineWidth: {{ point_text_outline_width }},
  pointTextOutlineColor: {{ point_text_outline_color }},
  fontFamily: "{{ point_text_font_family or font_family }}",
  fontWeight: {{ point_text_font_weight or font_weight }},
});
{% endif -%}
```

### 4. Performance Optimizations for Large Datasets

#### Viewport Filtering (Critical for Performance):
1. Leverage deck.gl's built-in viewport culling to only render text for points visible in the current viewport
2. Implement dynamic level-of-detail rendering based on zoom level and point density:
   ```javascript
   // In the onViewStateChange handler
   const pointsPerPixel = calculatePointDensity(viewState);
   // Only show text for points when density is below a threshold
   const shouldShowLabels = pointsPerPixel < maxDensityThreshold;
   ```

#### Additional Optimizations:
1. Add a sampling option to display text for only a subset of points (e.g., every nth point)
2. Add a `max_visible_points` parameter to limit the number of text labels shown
3. Use importance scoring to prioritize certain labels when many points are in view

### 5. Advanced Features (Future Enhancement)

#### HTML Templates for Rich Display:
1. Add support for HTML templates similar to hover text:
```javascript
addPointHTMLText(textField, textTemplate, {
  // Same parameters as addPointText
}) {
  // Create the text layer with HTML formatting
}
```

#### Dynamic Filtering:
1. Only show labels for points that match certain criteria
2. Allow sorting by importance to prioritize certain labels

## Example Usage

```python
plot = datamapplot.create_interactive_plot(
    embeddings_2d, 
    communities,
    hover_text=df['display_name'].to_list(),
    extra_point_data=df[['handle','description', 'followers', 'following', 'url', 'posts']].fillna(''),
    # Point text settings
    point_text_field="handle",                   # Use handle as the text label
    point_text_min_zoom=8,                       # Show labels when zoom level is 8 or higher
    point_text_size=12,                          # 12px font size
    point_text_offset=[0, 14],                   # Position labels 14px above the points
    point_text_outline_width=2,                  # Add a 2px outline for better readability
    point_text_outline_color=[255, 255, 255, 200], # White outline with 80% opacity
    point_text_font_family="Arial, sans-serif",  # Use a system font
)
```

## Implementation Timeline

1. Core functionality: 1-2 days
   - Add basic parameters to Python API
   - Implement basic text layer in JavaScript

2. Optimization and performance: 1-2 days
   - Implement viewport filtering
   - Add density-based rendering controls
   - Test with large datasets

3. Advanced features: 2-3 days
   - HTML templates
   - Dynamic filtering
   - Additional customization options 