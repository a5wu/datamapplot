# DataMapPlot Codebase Map

## Core Architecture

DataMapPlot is an interactive data visualization library that creates interactive plots from 2D embeddings (coordinates). It combines Python backend processing with JavaScript frontend rendering to create dynamic visualizations.

### Key Files and Their Roles

1. **producer_embeddings.py** - Example script that:
   - Loads embeddings and community data
   - Uses UMAP for dimensionality reduction
   - Configures visualization settings
   - Creates an interactive plot with `datamapplot.create_interactive_plot()`

2. **datamapplot/create_plots.py** - Entry point for creating plots with two key functions:
   - `create_plot()` - Creates static plots (matplotlib-based)
   - `create_interactive_plot()` - Creates interactive HTML/JS-based plots
     - Handles parameter processing and data preparation
     - Delegates rendering to `render_html()` in interactive_rendering.py

3. **datamapplot/interactive_rendering.py** - Core rendering backend:
   - Contains the `render_html()` function that:
     - Processes data and parameters
     - Uses Jinja2 templates to generate HTML
     - Encodes/compresses data for transfer to frontend
   - Defines `InteractiveFigure` class for notebook integration
   - Contains utility functions for color processing and data transformation

4. **datamapplot/deckgl_template.html** - HTML template for visualization:
   - Defines layout and styling
   - Loads external dependencies
   - Contains JavaScript for data loading and initialization
   - Creates the `DataMap` object

5. **datamapplot/static/js/datamap.js** - Core frontend visualization:
   - Defines the `DataMap` class with methods for:
     - Adding and rendering points, labels, and boundaries
     - Handling user interaction (hover, click, search)
     - Managing viewport and zoom levels
     - Supporting text rendering at specific zoom levels

## Key Abstractions

### Python Side

1. **Data Processing Flow**:
   ```
   create_interactive_plot() → render_html() → InteractiveFigure
   ```

2. **Data Transformation**:
   - 2D embeddings → Color mapping → Compressed data chunks
   - Labels/clusters → Boundary polygons
   - Metadata → Tooltip content

### JavaScript Side

1. **DataMap Class** - Core visualization controller:
   - Manages visualization state (points, colors, zoom)
   - Controls Deck.gl layers (scatter, text, polygon)
   - Handles user interactions and viewport changes

2. **Layer Management**:
   - Layers are ordered according to `LAYER_ORDER` global
   - Each layer is created with specific settings and added to the visualization
   - Layers include: points, labels, and boundaries

3. **Zoom-Based Rendering**:
   - `onViewStateChange()` handler monitors zoom level
   - Elements can be conditionally displayed based on zoom threshold
   - `pointTextMinZoom` controls when text appears
   - This zoom-based approach can be extended for other features

## Current Features and Enhancement Opportunities

### Current Features

1. **Point Rendering**:
   - Points rendered as circles using Deck.gl's ScatterplotLayer
   - Configurable size, color, and outline properties
   - Selection and highlighting capabilities
   - Custom color mapping and filtering

2. **Text Labels**:
   - Cluster labels using Deck.gl's TextLayer
   - Support for dynamic font loading and styling
   - Text collision detection and resolution

3. **Point Text**:
   - Text labels for individual points
   - Visibility controlled by zoom level via `pointTextMinZoom`
   - Custom styling and positioning

4. **Interactive Controls**:
   - Search functionality through `searchText()` method
   - Selection system with `addSelection()` and `removeSelection()`
   - Tooltips and click handlers via metadata

5. **Zoom-Based Visualization**:
   - `onViewStateChange()` handler monitors zoom level
   - Different elements can be displayed at different zoom levels
   - Currently implemented for point text (shows at higher zoom levels)

## Enhancement Opportunities

### 1. Image Rendering

- **Basic Implementation**:
  ```javascript
  // Example implementation for point image support
  addPointImages(imageField, {
    pointImageMinZoom = 12,
    pointImageSize = 24,
    pointImageSizeUnits = 'pixels',
    pointImageSizeScale = 1
  }) {
    this.imageField = imageField;
    this.imageMinZoom = pointImageMinZoom;
    this.imageSize = pointImageSize;
    this.imageSizeUnits = pointImageSizeUnits;
    this.imageSizeScale = pointImageSizeScale;
    
    // Add view state change handler for zoom detection
    this.deckgl.setProps({
      onViewStateChange: params => {
        this.onViewStateChange(params);
      }
    });
  }
  ```

- **Zoom-Based Visibility**:
  - Show images only when zoomed beyond a certain threshold
  - Switch between point representation and image representation
  - Filter to only render images in current viewport

- **Image Loading and Handling**:
  - Support for both remote URLs and local images
  - Fallback images for loading/error states
  - Image caching to prevent redundant requests

### 2. Advanced Visualization Features

- **Enhanced Styling**:
  - Customizable borders, shadows, and visual effects
  - Support for different point shapes beyond circles
  - Custom rendering for highlighted or selected points

- **Improved Interactions**:
  - Extended hover and click behaviors
  - Drag-to-reposition capabilities
  - Custom right-click context menus

- **Animation and Transitions**:
  - Smooth transitions between zoom levels
  - Animated data changes and updates
  - Motion effects for selection and highlighting

### 3. Performance Optimizations

- **Efficient Rendering**:
  - Viewport culling (only render visible elements)
  - Level-of-detail rendering based on zoom
  - WebGL instancing for better performance

- **Data Management**:
  - Chunked/progressive data loading
  - On-demand data fetching based on viewport
  - Memory optimization for large datasets

### 4. Extended UI Components

- **Controls and Panels**:
  - Customizable legend and info panels
  - Advanced filtering and selection controls
  - Zoom/viewport control widgets

- **Annotation Features**:
  - Drawing and annotation tools
  - User-created labels and markers
  - Persistent annotations with save/load

### 5. Implementation Approach

1. **Extend Core Classes**:
   - Add new methods to DataMap for enhanced functionality
   - Create helper classes for specific features
   - Maintain backward compatibility

2. **Python-JavaScript Integration**:
   - Add parameters to Python interface
   - Implement data preprocessing functions
   - Create serialization helpers for complex data

3. **Leverage Deck.gl Capabilities**:
   - Use existing layer types (ScatterplotLayer, IconLayer, etc.)
   - Create custom layers for specialized effects
   - Utilize Deck.gl's composite layers for complex visualizations