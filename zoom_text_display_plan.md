# Plan: Dynamic Text Display on Zoom for DataMapPlot

This document outlines a plan to implement a feature where text labels appear near data points when the user zooms in close enough. The text content will be configurable via a parameter.

## Overview

The goal is to enhance DataMapPlot by displaying text labels (such as user handles, names, or any text attribute) near data points when a certain zoom threshold is reached. This creates a more detailed view when zoomed in, while maintaining a clean, uncluttered visualization when zoomed out.

## Implementation Plan

### 1. Python API Modifications

#### Modify `create_interactive_plot()` function:

1. Add new parameters:

   ```python
   def create_interactive_plot(
       # ... existing parameters ...
       zoom_text_field=None,            # Field name to display on zoom (e.g., 'handle')
       zoom_text_threshold=10,          # Zoom level at which to show the text
       zoom_text_size=12,               # Size of the zoom text
       zoom_text_offset=[0, -15],       # Offset position relative to points
       zoom_text_color=None,            # Optional custom color for zoom text
       # ... other parameters
   ):
   ```

2. Process the zoom text data:
   - If `zoom_text_field` is provided, extract this data from `extra_point_data`
   - Pass this data to `render_html()` function

#### Update the `render_html()` function:

1. Accept new parameters related to zoom text
2. Add these parameters to the template context

### 2. JavaScript Implementation

#### Create a new DeckGL Layer:

1. Add a new `zoomTextLayer` property to the `DataMap` class:

   ```javascript
   this.zoomTextLayer = null;
   ```

2. Implement a method to create and update the zoom text layer:

   ```javascript
   createZoomTextLayer(zoomTextData, {
     zoomThreshold,
     textSize,
     textOffset,
     textColor
   }) {
     this.zoomTextLayer = new deck.TextLayer({
       id: 'zoomTextLayer',
       data: zoomTextData,
       getPosition: d => [d.x, d.y],
       getText: d => d.zoomText,
       getSize: textSize,
       getColor: textColor || [0, 0, 0, 255],
       getTextAnchor: 'middle',
       getAlignmentBaseline: 'center',
       getPixelOffset: textOffset,
       // Only visible based on zoom threshold
       updateTriggers: {
         getSize: this.deckgl.viewState.zoom
       }
     });

     this.layers.push(this.zoomTextLayer);
     this.layers.sort((a, b) => getLayerIndex(a) - getLayerIndex(b));
     this.deckgl.setProps({ layers: [...this.layers] });
   }
   ```

#### Add Zoom-Level Detection:

1. Modify the DeckGL initialization to track view state changes:

   ```javascript
   this.deckgl = new deck.DeckGL({
     // ... existing configuration ...
     onViewStateChange: ({ viewState }) =>
       this.handleViewStateChange(viewState),
   });
   ```

2. Implement the view state change handler:

   ```javascript
   handleViewStateChange(viewState) {
     const currentZoom = viewState.zoom;

     // Update text visibility based on zoom level
     if (this.zoomTextLayer && this.zoomTextThreshold) {
       const updatedLayer = this.zoomTextLayer.clone({
         visible: currentZoom >= this.zoomTextThreshold,
         updateTriggers: {
           getSize: currentZoom
         }
       });

       // Replace the layer
       const idx = this.layers.indexOf(this.zoomTextLayer);
       this.layers = [
         ...this.layers.slice(0, idx),
         updatedLayer,
         ...this.layers.slice(idx + 1)
       ];
       this.deckgl.setProps({ layers: this.layers });
       this.zoomTextLayer = updatedLayer;
     }
   }
   ```

### 3. HTML Template Updates

Update the `deckgl_template.html` file to initialize the zoom text features:

```javascript
// In the JavaScript initialization block
{% if zoom_text_field %}
const zoomTextData = [];
for (let i = 0; i < pointData.x.length; i++) {
  zoomTextData.push({
    x: pointData.x[i],
    y: pointData.y[i],
    zoomText: hoverData['{{ zoom_text_field }}'][i] || ''
  });
}

datamap.zoomTextThreshold = {{ zoom_text_threshold }};
datamap.createZoomTextLayer(zoomTextData, {
  zoomThreshold: {{ zoom_text_threshold }},
  textSize: {{ zoom_text_size }},
  textOffset: {{ zoom_text_offset }},
  textColor: {{ zoom_text_color if zoom_text_color else "null" }}
});
{% endif %}
```

### 4. Performance Considerations

1. **Filtering Displayed Text**:

   - For large datasets, implement a filtering mechanism that only shows text for points currently in the viewport
   - Add distance-based filtering to prevent text overlap in dense areas

2. **Text Culling**:
   - When too many points are visible, implement a priority system to show only the most important labels
   - Consider using the same collision detection system used for cluster labels

### 5. Implementation Steps

1. Add the new parameters to the Python functions
2. Update the HTML template to pass zoom text data to JavaScript
3. Implement the JavaScript zoom text layer
4. Test with different zoom levels and datasets
5. Optimize for performance with large datasets
6. Add documentation for the new feature

### 6. Testing Strategy

1. Test with small datasets to verify basic functionality
2. Test with large datasets to ensure performance remains acceptable
3. Test across different browsers to ensure compatibility
4. Test different text fields and formatting options

## Example Usage

```python
plot = datamapplot.create_interactive_plot(
    embeddings_2d,
    producer_communities,
    hover_text=producer_df['display_name'].to_list(),
    extra_point_data=producer_df[['handle','description', 'followers', 'following', 'bsky_url']],
    # Zoom text configuration
    zoom_text_field='handle',
    zoom_text_threshold=9.5,
    zoom_text_size=14,
    zoom_text_offset=[0, -15],
    enable_search=True
)
```

This will show the user's handle as text above each point when zoomed in to level 9.5 or higher.

## Conclusion

This feature will significantly enhance the user experience by providing dynamic detail levels based on zoom. It follows the "overview first, zoom and filter, then details-on-demand" principle of information visualization.
