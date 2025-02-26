# Plan for Implementing Point Text Labels in DataMapPlot

## Overview

This plan outlines the approach to render text labels for individual data points in datamapplot when the user zooms in close enough. This will enhance user experience by providing additional context (like usernames/handles) when examining specific points in detail.

## Goals

1. Display text labels (e.g., handles) next to data points when zoomed in sufficiently
2. Avoid visual clutter by only showing labels at appropriate zoom levels
3. Prevent overlapping text labels for readability
4. Ensure good performance even with large datasets
5. Make the feature configurable with customizable appearance

## Implementation Plan

### 1. Extend the Data Structure

- Add text label information to the point data structure
- Implement parameter passing for text labels in `create_interactive_plot()`

```python
# New parameter in create_interactive_plot()
def create_interactive_plot(
    ...,
    point_text_field=None,  # The field to use for point text labels (e.g., "handle")
    point_text_min_zoom=10,  # Minimum zoom level to show text
    point_text_size=12,      # Text size in pixels
    point_text_offset=[0, 10],  # Offset from point center
    point_text_color=None,   # Text color (default: match point color)
    ...
):
```

### 2. Modify DataMap Class in datamap.js

- Add a new deck.gl TextLayer to render point text labels
- Make the layer's visibility conditional on the current zoom level
- Implement collision detection to prevent overlapping text

```javascript
// In DataMap class in datamap.js
addPoints(pointData, {
    ...,
    pointTextField = null,  // Field name for text labels
    pointTextMinZoom = 10,  // Only show text above this zoom level
    pointTextSize = 12,     // Text size
    pointTextOffset = [0, 10], // Offset from point center [x, y]
    pointTextColor = null,  // Use specific color or match point color
}) {
    // Existing point layer setup
    ...

    // Only create text layer if pointTextField is specified
    if (pointTextField && pointData[pointTextField]) {
        this.pointTextLayer = new deck.TextLayer({
            id: 'pointTextLayer',
            data: {
                length: numPoints,
                attributes: {
                    ...scatterAttributes,
                    getText: { value: pointData[pointTextField], size: 1 }
                }
            },
            getPosition: d => [d.x, d.y],
            getText: d => d[pointTextField],
            getColor: pointTextColor || (d => [d.r, d.g, d.b]),
            getSize: pointTextSize,
            sizeScale: 1,
            getTextAnchor: 'middle',
            getAlignmentBaseline: 'top',
            getPixelOffset: pointTextOffset,
            // Only show text when zoomed in enough
            visible: false,
            // Use collision detection similar to cluster labels
            collisionEnabled: true,
            extensions: [new deck.CollisionFilterExtension()],
        });

        this.layers.push(this.pointTextLayer);
    }
}
```

### 3. Add Zoom-Level Dependent Visibility

- Implement an onViewStateChange handler to toggle visibility based on zoom level

```javascript
// In DataMap constructor
this.deckgl.setProps({
  onViewStateChange: ({ viewState }) => {
    // If we have a point text layer
    if (this.pointTextLayer) {
      // Show text only when zoomed in enough
      const showText = viewState.zoom >= this.pointTextMinZoom;
      if (showText !== this.pointTextLayer.props.visible) {
        const updatedTextLayer = this.pointTextLayer.clone({
          visible: showText,
        });

        const idx = this.layers.indexOf(this.pointTextLayer);
        this.layers = [
          ...this.layers.slice(0, idx),
          updatedTextLayer,
          ...this.layers.slice(idx + 1),
        ];
        this.pointTextLayer = updatedTextLayer;
        this.deckgl.setProps({ layers: this.layers });
      }
    }
  },
});
```

### 4. Update the render_html Function

- Add parameters to the render_html function to control text labels
- Pass these parameters to the JavaScript code

```python
# In render_html function parameters
def render_html(
    ...,
    point_text_field=None,
    point_text_min_zoom=10,
    point_text_size=12,
    point_text_offset=[0, 10],
    point_text_color=None,
    point_text_outline_width=2,
    point_text_outline_color=[255, 255, 255, 200],
    ...
):
    # In the function body, pass these parameters to the JavaScript template
    # Add to the context for the template
```

### 5. Implement High-Performance Rendering

- Add level-of-detail (LOD) rendering to handle large datasets
- Only render text for points that are visible in the current viewport
- Use binary search to determine which points are in the viewport

```javascript
// Efficiently determine which points are in the viewport
function getPointsInViewport(points, viewport) {
  // Filter points by viewport bounds
  return points.filter(
    (p) =>
      p.x >= viewport.minX &&
      p.x <= viewport.maxX &&
      p.y >= viewport.minY &&
      p.y <= viewport.maxY
  );
}

// Update point text layer data based on visible points
function updateVisibleTextLabels() {
  const { viewport } = this.deckgl;
  const visiblePoints = getPointsInViewport(this.pointData, viewport);

  // Update text layer with just visible points
  const updatedTextLayer = this.pointTextLayer.clone({
    data: visiblePoints,
  });
  // Update the layer in this.layers
}
```

### 6. Add Styling and Customization Options

- Provide appearance options for text labels
- Include text outline for better visibility
- Allow different placement options relative to points

### 7. Update Documentation and Examples

- Document the new features in the library documentation
- Create example code showing how to use text labels
- Add visual examples showing the feature in action

### 8. Testing

- Test with various datasets to ensure performance
- Verify correct zoom-level behavior
- Test with various text length scenarios
- Test collision detection with different point densities

## Usage Example

```python
# Example of using the new text label features
plot = datamapplot.create_interactive_plot(
    embeddings_2d,
    communities,
    point_text_field="handle",  # Show handles as labels
    point_text_min_zoom=8,      # Only show when zoomed in
    point_text_color=[0, 0, 0, 255], # Black text
    point_text_outline_width=2,  # White outline for readability
    point_text_outline_color=[255, 255, 255, 200]
)
```

## Implementation Timeline

1. Extend data structures - 1 day
2. Add TextLayer implementation - 2 days
3. Implement zoom-level visibility - 1 day
4. Add performance optimizations - 2 days
5. Documentation and testing - 2 days

Total estimated time: 8 days
