LAYER_ORDER = ['imageLayer', 'dataPointLayer', 'pointImageLayer', 'pointTextLayer', 'boundaryLayer', 'LabelLayer'];

// Create a circular version of an image URL
function createCircularImage(imageUrl) {
  // Create an offscreen canvas
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  // Set dimensions
  const size = 128;
  canvas.width = size;
  canvas.height = size;
  
  // Create a new image
  const img = new Image();
  img.crossOrigin = 'anonymous';
  
  // Return a promise that resolves to the data URL
  return new Promise((resolve, reject) => {
    img.onload = () => {
      // Clear the canvas
      ctx.clearRect(0, 0, size, size);
      
      // Create circular clipping path
      ctx.beginPath();
      ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.clip();
      
      // Draw the image
      ctx.drawImage(img, 0, 0, size, size);
      
      // Border (optional)
      ctx.beginPath();
      ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'white';
      ctx.stroke();
      
      // Convert to data URL
      resolve(canvas.toDataURL('image/png'));
    };
    
    img.onerror = () => {
      console.warn(`Failed to load image from ${imageUrl}`);
      // Return a simple colored circle as fallback
      ctx.beginPath();
      ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.fillStyle = '#4285F4';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'white';
      ctx.stroke();
      resolve(canvas.toDataURL('image/png'));
    };
    
    img.src = imageUrl;
  });
}

function getLayerIndex(object) {
  return LAYER_ORDER.indexOf(object.id);
}

function isFontLoaded(fontName) {
  return document.fonts.check(`12px "${fontName}"`);
}

// Function to wait for a font to load
function waitForFont(fontName, maxWait = 500) {
  return new Promise((resolve, reject) => {
      if (isFontLoaded(fontName)) {
          resolve();
      } else {
          const startTime = Date.now();
          const interval = setInterval(() => {
              if (isFontLoaded(fontName)) {
                  clearInterval(interval);
                  resolve();
              } else if (Date.now() - startTime > maxWait) {
                  clearInterval(interval);
                  reject(new Error(`Font ${fontName} did not load within ${maxWait}ms`));
              }
          }, 50);
      }
  });
}

function getInitialViewportSize() {
  const width = document.documentElement.clientWidth;
  const height = document.documentElement.clientHeight;
  
  return { viewportWidth: width, viewportHeight: height };
}

function calculateZoomLevel(bounds, viewportWidth, viewportHeight, padding = 0.5) {
  // Calculate the range of the bounds
  const lngRange = bounds[1] - bounds[0];
  const latRange = bounds[3] - bounds[2];

  // Calculate the center of the bounds
  const centerLng = (bounds[0] + bounds[1]) / 2;
  const centerLat = (bounds[2] + bounds[3]) / 2;

  // Calculate the zoom level for both dimensions
  const zoomX = Math.log2(360 / (lngRange / (viewportWidth / 256)));
  const zoomY = Math.log2(180 / (latRange / (viewportHeight / 256)));

  const zoom = Math.min(zoomX, zoomY) - padding;

  return { zoomLevel: zoom, dataCenter: [centerLng, centerLat] };
}

class DataMap {
  constructor({
    container,
    bounds,
    searchItemId = "text-search",
    lassoSelectionItemId = "lasso-selection",
  }) {
    this.container = container;
    this.searchItemId = searchItemId;
    this.lassoSelectionItemId = lassoSelectionItemId;
    this.pointData = null;
    this.metaData = null;
    this.layers = [];
    const { viewportWidth, viewportHeight } = getInitialViewportSize();
    const { zoomLevel, dataCenter } = calculateZoomLevel(bounds, viewportWidth, viewportHeight);
    this.deckgl = new deck.DeckGL({
      container: container,
      initialViewState: {
        latitude: dataCenter[1],
        longitude: dataCenter[0],
        zoom: zoomLevel
      },
      controller: { scrollZoom: { speed: 0.01, smooth: true } },
    });
    this.updateTriggerCounter = 0;
    this.dataSelectionManager = new DataSelectionManager(lassoSelectionItemId);
  }

  addPoints(pointData, {
    pointSize,
    pointOutlineColor = [250, 250, 250, 128],
    pointLineWidth = 0.001,
    pointHoverColor = [170, 0, 0, 187],
    pointLineWidthMaxPixels = 3,
    pointLineWidthMinPixels = 0.001,
    pointRadiusMaxPixels = 16,
    pointRadiusMinPixels = 0.2,
  }) {
    // Parse out and reformat data for deck.gl
    const numPoints = pointData.x.length;
    const positions = new Float32Array(numPoints * 2);
    const colors = new Uint8Array(numPoints * 4);
    const variableSize = pointSize < 0;
    let sizes;
    if (variableSize) {
      sizes = new Float32Array(numPoints);
    } else {
      sizes = null;
    }

    // Populate the arrays
    for (let i = 0; i < numPoints; i++) {
      positions[i * 2] = pointData.x[i];
      positions[i * 2 + 1] = pointData.y[i];
      colors[i * 4] = pointData.r[i];
      colors[i * 4 + 1] = pointData.g[i];
      colors[i * 4 + 2] = pointData.b[i];
      colors[i * 4 + 3] = pointData.a[i];
      if (variableSize) {
        sizes[i] = pointData.size[i];
      }
    }
    this.originalColors = colors;
    this.selected = new Float32Array(numPoints).fill(1.0);
    this.pointSize = pointSize;
    this.pointOutlineColor = pointOutlineColor;
    this.pointLineWidth = pointLineWidth;
    this.pointHoverColor = pointHoverColor;
    this.pointLineWidthMaxPixels = pointLineWidthMaxPixels;
    this.pointLineWidthMinPixels = pointLineWidthMinPixels;
    this.pointRadiusMaxPixels = pointRadiusMaxPixels;
    this.pointRadiusMinPixels = pointRadiusMinPixels;

    let scatterAttributes = {
      getPosition: { value: positions, size: 2 },
      getFillColor: { value: colors, size: 4 },
      getFilterValue: { value: this.selected, size: 1 }
    };
    if (variableSize) {
      scatterAttributes.getRadius = { value: sizes, size: 1 };
    }

    this.pointLayer = new deck.ScatterplotLayer({
      id: 'dataPointLayer',
      data: {
        length: numPoints,
        attributes: scatterAttributes
      },
      getRadius: this.pointSize,
      getLineColor: this.pointOutlineColor,
      getLineWidth: this.pointLineWidth,
      highlightColor: this.pointHoverColor,
      lineWidthMaxPixels: this.pointLineWidthMaxPixels,
      lineWidthMinPixels: this.pointLineWidthMinPixels,
      radiusMaxPixels: this.pointRadiusMaxPixels,
      radiusMinPixels: this.pointRadiusMinPixels,
      radiusUnits: "common",
      lineWidthUnits: "common",
      autoHighlight: true,
      pickable: true,
      stroked: true,
      extensions: [new deck.DataFilterExtension({ filterSize: 1 })],
      filterRange: [-0.5, 1.5],
      filterSoftRange: [0.75, 1.25],
      updateTriggers: {
        getFilterValue: this.updateTriggerCounter  // We'll increment this to trigger updates
      },
      instanceCount: numPoints,
      parameters: {
        depthTest: false
      }
    });

    this.layers.push(this.pointLayer);
    this.layers.sort((a, b) => getLayerIndex(a) - getLayerIndex(b));
    this.deckgl.setProps({ layers: [...this.layers] });
  }

  addLabels(labelData, {
    labelTextColor = d => [d.r, d.g, d.b],
    textMinPixelSize = 18,
    textMaxPixelSize = 36,
    textOutlineWidth = 8,
    textOutlineColor = [238, 238, 238, 221],
    textBackgroundColor = [255, 255, 255, 64],
    fontFamily = "Roboto",
    fontWeight = 900,
    lineSpacing = 0.95,
    textCollisionSizeScale = 3.0,
  }) {
    const numLabels = labelData.length;
    this.labelTextColor = labelTextColor;
    this.textMinPixelSize = textMinPixelSize;
    this.textMaxPixelSize = textMaxPixelSize;
    this.textOutlineWidth = textOutlineWidth;
    this.textOutlineColor = textOutlineColor;
    this.textBackgroundColor = textBackgroundColor;
    this.fontFamily = fontFamily;
    this.fontWeight = fontWeight;
    this.lineSpacing = lineSpacing;
    this.textCollisionSizeScale = textCollisionSizeScale;

    waitForFont(this.fontFamily);

    this.labelLayer = new deck.TextLayer({
      id: 'LabelLayer',
      data: labelData,
      pickable: false,
      getPosition: d => [d.x, d.y],
      getText: d => d.label,
      getColor: this.labelTextColor,
      getSize: d => d.size,
      sizeScale: 1,
      sizeMinPixels: this.textMinPixelSize,
      sizeMaxPixels: this.textMaxPixelSize,
      outlineWidth: this.textOutlineWidth,
      outlineColor: this.textOutlineColor,
      getBackgroundColor: this.textBackgroundColor,
      getBackgroundPadding: [15, 15, 15, 15],
      background: true,
      characterSet: "auto",
      fontFamily: this.fontFamily,
      fontWeight: this.fontWeight,
      lineHeight: this.lineSpacing,
      fontSettings: { "sdf": true },
      getTextAnchor: "middle",
      getAlignmentBaseline: "center",
      lineHeight: 0.95,
      elevation: 100,
      // CollideExtension options
      collisionEnabled: true,
      getCollisionPriority: d => d.size,
      collisionTestProps: {
        sizeScale: this.textCollisionSizeScale,
        sizeMaxPixels: this.textMaxPixelSize * 2,
        sizeMinPixels: this.textMinPixelSize * 2
      },
      extensions: [new deck.CollisionFilterExtension()],
      instanceCount: numLabels,
      parameters: {
        depthTest: false
      }
    });

    this.layers.push(this.labelLayer);
    this.layers.sort((a, b) => getLayerIndex(a) - getLayerIndex(b));
    this.deckgl.setProps({ layers: [...this.layers] });
  }

  addBoundaries(boundaryData, {clusterBoundaryLineWidth = 0.5}) {
    const numBoundaries = boundaryData.length;
    this.clusterBoundaryLineWidth = clusterBoundaryLineWidth;

    this.boundaryLayer = new deck.PolygonLayer({
      id: 'boundaryLayer',
      data: boundaryData,
      stroked: true,
      filled: false,
      getLineColor: d => [d.r, d.g, d.b, d.a],
      getPolygon: d => d.polygon,
      lineWidthUnits: "common",
      getLineWidth: d => d.size * d.size,
      lineWidthScale: this.clusterBoundaryLineWidth * 5e-5,
      lineJointRounded: true,
      lineWidthMaxPixels: 4,
      lineWidthMinPixels: 0.0,
      instanceCount: numBoundaries,
      parameters: {
        depthTest: false
      }
    });

    this.layers.push(this.boundaryLayer);
    this.layers.sort((a, b) => getLayerIndex(a) - getLayerIndex(b));
    this.deckgl.setProps({ layers: [...this.layers] });
  }

  addPointText(textField, {
    pointTextMinZoom = 8,
    pointTextSize = 12,
    pointTextOffset = [0, 14],
    pointTextOutlineWidth = 2, 
    pointTextOutlineColor = [255, 255, 255, 200],
    fontFamily = this.fontFamily,
    fontWeight = 600,
  }) {
    if (!this.metaData || !this.metaData[textField]) {
      console.warn(`Field "${textField}" not found in metadata. Point text layer will not be created.`);
      return;
    }

    // Save the text field name for later use in filtering
    this.pointTextField = textField;

    // Wait for font to load
    waitForFont(fontFamily);

    // Create a text layer that displays point data when zoomed in
    this.pointTextLayer = new deck.TextLayer({
      id: 'pointTextLayer',
      data: Array.from({length: this.pointLayer.props.data.length}, (_, i) => ({index: i})),
      pickable: false,
      getPosition: d => {
        const idx = d.index * 2;
        return [
          this.pointLayer.props.data.attributes.getPosition.value[idx],
          this.pointLayer.props.data.attributes.getPosition.value[idx + 1]
        ];
      },
      getText: d => this.metaData[textField][d.index],
      getColor: [255, 255, 255],  // Default color, will be customizable in future
      getSize: pointTextSize,
      sizeScale: 1,
      getPixelOffset: pointTextOffset,
      outlineWidth: pointTextOutlineWidth,
      outlineColor: pointTextOutlineColor,
      background: false,
      fontFamily: fontFamily,
      fontWeight: fontWeight,
      characterSet: "auto",
      fontSettings: {
        sdf: true,
        fontSize: 64,
        buffer: 6
      },
      visible: false,  // Start hidden until zoom threshold is reached
    });
    
    this.layers.push(this.pointTextLayer);
    this.layers.sort((a, b) => getLayerIndex(a) - getLayerIndex(b));
    this.deckgl.setProps({ layers: [...this.layers] });
    
    // Save the minimum zoom level
    this.pointTextMinZoom = pointTextMinZoom;
    
    // Add a view state change handler if not already present
    if (!this._hasViewStateChangeHandler) {
      this.deckgl.setProps({
        onViewStateChange: ({viewState, oldViewState}) => {
          // Use the shared handler method
          this._handleLayerVisibilityOnZoom(viewState);
        }
      });
      this._hasViewStateChangeHandler = true;
    }
  }

  // New method for displaying images instead of dots when zoomed in
  addPointImages({
    pointImageMinZoom = 8,
    pointImageUrl = 'https://cdn.bsky.app/img/avatar/plain/did:plc:7l75ck5g4b5k6gxqaq5rejit/bafkreia2gyds76c6uk5szzdxvsfcvnm4nh5nvudchuu3tqc6nlkwetcjai@jpeg',
    pointImageField = null,  // Field in metadata for per-node URLs
    pointImageBorderSizeFactor = 0.85,  // Controls border thickness (smaller = thicker border)
    pointImageShowOutline = false  // Whether to show the grey outline around the colored border
  }) {
    if (!this.pointLayer) {
      console.warn("Point layer not initialized. Image layer will not be created.");
      return;
    }

    // Check if the metadata field exists if provided
    if (pointImageField && (!this.metaData || !this.metaData[pointImageField])) {
      console.warn(`Field "${pointImageField}" not found in metadata. Using default image.`);
    }

    // Get the exact properties from the point layer
    const pointProps = this.pointLayer.props;
    
    // Create placeholder for image layer - we'll create it when needed
    this.pointImageLayer = null;
    
    // Image loading state tracking
    this.imagesLoaded = false;
    this.pointImageUrl = pointImageUrl;
    this.pointImageField = pointImageField;
    this.pointImageBorderSizeFactor = pointImageBorderSizeFactor;
    this.pointImageShowOutline = pointImageShowOutline;
    this.pointImageProps = {
      pointProps: pointProps,
      // Store other settings we'll need when creating the layer
      sizeUnits: pointProps.radiusUnits === 'common' ? 'common' : 'pixels',
      sizeScale: pointProps.radiusScale || 1,
      sizeMinPixels: (pointProps.radiusMinPixels || 1) * 2,
      sizeMaxPixels: (pointProps.radiusMaxPixels || 100) * 2,
    };
    
    // Save the minimum zoom level
    this.pointImageMinZoom = pointImageMinZoom;
    
    // Add or modify view state change handler
    if (!this._hasViewStateChangeHandler) {
      this.deckgl.setProps({
        onViewStateChange: ({viewState, oldViewState}) => {
          this._handleLayerVisibilityOnZoom(viewState);
        }
      });
      this._hasViewStateChangeHandler = true;
    } else {
      // If handler already exists, still need to update for new layer type
      this.deckgl.setProps({
        onViewStateChange: ({viewState, oldViewState}) => {
          this._handleLayerVisibilityOnZoom(viewState);
        }
      });
    }
  }

  // Helper method to handle layer visibility changes based on zoom
  _handleLayerVisibilityOnZoom(viewState) {
    // Handle image layer
    if (this.pointImageMinZoom !== undefined) {
      const imageVisible = viewState.zoom >= this.pointImageMinZoom;
      
      // If we need to show images and haven't created the layer yet
      if (imageVisible && !this.imagesLoaded) {
        // First initialization of image layer - create empty layer
        this._createImageLayer();
        this.imagesLoaded = true;
        
        // Load images just for the visible viewport
        this._loadImagesForViewport(viewState);
      }
      
      // If layer exists and we've already crossed the visibility threshold
      if (this.pointImageLayer && this.imagesLoaded) {
        // Update layer visibility if needed
        if (imageVisible !== this.pointImageLayer.props.visible) {
          // Update image layer visibility
          const updatedImageLayer = this.pointImageLayer.clone({
            visible: imageVisible
          });
          
          // Update layers array
          const idx = this.layers.indexOf(this.pointImageLayer);
          this.layers = [...this.layers.slice(0, idx), updatedImageLayer, ...this.layers.slice(idx + 1)];
          this.pointImageLayer = updatedImageLayer;
          
          // Update point layer for border effect - keep visible but adjust line width
          if (this.pointLayer) {
            const updatedPointLayer = this.pointLayer.clone({
              visible: true, // Keep visible for border effect
              // Remove the grey border based on user preference
              lineWidthMinPixels: (imageVisible && !this.pointImageShowOutline) ? 0 : this.pointLayer.props.lineWidthMinPixels,
              lineWidthMaxPixels: (imageVisible && !this.pointImageShowOutline) ? 0 : this.pointLayer.props.lineWidthMaxPixels,
              lineWidthScale: (imageVisible && !this.pointImageShowOutline) ? 0 : this.pointLayer.props.lineWidthScale,
              // Keep other properties unchanged
            });
            const pointIdx = this.layers.indexOf(this.pointLayer);
            this.layers = [...this.layers.slice(0, pointIdx), updatedPointLayer, ...this.layers.slice(pointIdx + 1)];
            this.pointLayer = updatedPointLayer;
          }
          
          this.deckgl.setProps({ layers: this.layers });
        }
        
        // If the viewport has changed significantly and images are visible,
        // check if we need to load more images for newly visible points
        if (imageVisible && 
            (!this.lastViewportCheck || 
             Math.abs(viewState.longitude - this.lastViewportCheck.longitude) > 0.01 ||
             Math.abs(viewState.latitude - this.lastViewportCheck.latitude) > 0.01 ||
             Math.abs(viewState.zoom - this.lastViewportCheck.zoom) > 0.2)) {
          
          this._loadImagesForViewport(viewState);
          this.lastViewportCheck = {...viewState};
        }
      }
    }
    
    // Handle text layer visibility (existing functionality)
        if (this.pointTextLayer) {
      const textVisible = viewState.zoom >= this.pointTextMinZoom;
            
      if (textVisible !== this.pointTextLayer.props.visible) {
              const updatedLayer = this.pointTextLayer.clone({
          visible: textVisible
              });
              
              // Update layers array
              const idx = this.layers.indexOf(this.pointTextLayer);
              this.layers = [...this.layers.slice(0, idx), updatedLayer, ...this.layers.slice(idx + 1)];
              this.deckgl.setProps({ layers: this.layers });
              this.pointTextLayer = updatedLayer;
            }
          }
        }
  
  // Method to load images for the current viewport
  _loadImagesForViewport(viewState) {
    if (!this.pointLayer || !this.pointImageLayer) return;
    
    // Get visible points
    const visiblePoints = getVisiblePointsInViewport(
      this.pointLayer.props.data,
      viewState,
      this.container.clientWidth,
      this.container.clientHeight
    );
    
    // Keep track of which points have already had images loaded
    if (!this.loadedImageIndices) {
      this.loadedImageIndices = new Set();
    }
    
    // Filter visible points by selected status if there's a selection active
    let pointsToConsider = visiblePoints;
    const selectedIndices = this.dataSelectionManager.getSelectedIndices();
    if (selectedIndices.size > 0) {
      // Only load images for selected points that are in the viewport
      pointsToConsider = visiblePoints.filter(idx => this.selected[idx] > 0);
    }
    
    // Find new points that need images
    const newPointsToLoad = pointsToConsider.filter(idx => !this.loadedImageIndices.has(idx));
    
    // If there are new points to load, update the image data
    if (newPointsToLoad.length > 0) {
      console.log(`Loading images for ${newPointsToLoad.length} new visible points`);
      
      // Mark these indices as loaded
      newPointsToLoad.forEach(idx => this.loadedImageIndices.add(idx));
      
      // Update the image layer with the new visible indices
      this._updateImageLayerData();
    }
  }
  
  // Helper to actually create the image layer (initial empty layer)
  _createImageLayer() {
    const { pointProps, sizeUnits, sizeScale, sizeMinPixels, sizeMaxPixels } = this.pointImageProps;
    const pointImageField = this.pointImageField;
    const defaultImageUrl = this.pointImageUrl;
    
    // Initialize empty data structure for image URLs
    this.pointImages = [];
    this.loadedImageIndices = new Set();
    
    // Border sizing - make images slightly smaller than points to create border effect
    const borderSizeFactor = this.pointImageBorderSizeFactor || 0.85; // Use configured factor or default
    
    // Check if we have variable size points (marker_size_array)
    const hasVariableSizes = pointProps.data.attributes.getRadius !== undefined;
    
    this.pointImageLayer = new deck.IconLayer({
      id: 'pointImageLayer',
      data: [], // Start with empty data array
      pickable: true,
      // Use the same position accessor as the point layer
      getPosition: d => {
        const idx = d.index * 2;
        return [
          pointProps.data.attributes.getPosition.value[idx],
          pointProps.data.attributes.getPosition.value[idx + 1]
        ];
      },
      // Icon settings for circular images
      getIcon: d => {
        return {
          url: d.imageUrl,
          width: 128,
          height: 128,
          mask: false  // Setting mask to false so the image shows properly
        };
      },
      // Size settings - apply border effect by making images slightly smaller
      // Handle both fixed size and dynamic size (marker_size_array) cases
      getSize: hasVariableSizes ? 
               (d => {
                 // Get the radius directly from the point layer's radius array
                 const radius = pointProps.data.attributes.getRadius.value[d.index];
                 return radius * 2 * borderSizeFactor;
               }) : 
               (pointProps.getRadius === undefined ? 2 * borderSizeFactor : 
                 (typeof pointProps.getRadius === 'function' ? 
                   d => pointProps.getRadius(d.index) * 2 * borderSizeFactor : 
                   pointProps.getRadius * 2 * borderSizeFactor)),
      sizeUnits: sizeUnits,
      sizeScale: sizeScale,
      sizeMinPixels: sizeMinPixels * borderSizeFactor,
      sizeMaxPixels: sizeMaxPixels * borderSizeFactor,
      // Other properties
      getColor: [255, 255, 255],
      visible: false, // Start hidden, visibility will be updated in _handleLayerVisibilityOnZoom
      updateTriggers: {
        getSize: pointProps.updateTriggers?.getRadius || 0,
        getIcon: 0 // We'll increment this if the image URLs change
      },
      loadOptions: {
        image: {
          crossOrigin: 'anonymous'
        }
      }
    });
    
    this.layers.push(this.pointImageLayer);
    this.layers.sort((a, b) => getLayerIndex(a) - getLayerIndex(b));
    this.deckgl.setProps({ layers: [...this.layers] });
    
    console.log("Created initial image layer");
  }
  
  // Method to update image layer data with loaded images
  _updateImageLayerData() {
    if (!this.pointImageLayer || !this.loadedImageIndices) return;
    
    const pointImageField = this.pointImageField;
    const defaultImageUrl = this.pointImageUrl;
    
    // Build data array for loaded points
    const imageData = Array.from(this.loadedImageIndices).map(index => {
      // Get the image URL for this point
      let imageUrl = defaultImageUrl;
      if (pointImageField && this.metaData && this.metaData[pointImageField]) {
        const nodeImage = this.metaData[pointImageField][index];
        if (nodeImage) {
          imageUrl = nodeImage;
        }
      }
      
      return {
        index,
        imageUrl
      };
    });
    
    // Update the layer with new data
    const updatedImageLayer = this.pointImageLayer.clone({
      data: imageData,
      updateTriggers: {
        ...this.pointImageLayer.props.updateTriggers,
        getIcon: (this.pointImageLayer.props.updateTriggers.getIcon || 0) + 1
      }
    });
    
    // Update layers array
    const idx = this.layers.indexOf(this.pointImageLayer);
    this.layers = [...this.layers.slice(0, idx), updatedImageLayer, ...this.layers.slice(idx + 1)];
    this.pointImageLayer = updatedImageLayer;
    this.deckgl.setProps({ layers: this.layers });
  }

  addMetaData(metaData, {
    tooltipFunction = ({index}) => this.metaData.hover_text[index],
    onClickFunction = null,
    searchField = null,

  }) {
    this.metaData = metaData;
    this.tooltipFunction = tooltipFunction;
    this.onClickFunction = onClickFunction;
    this.searchField = searchField;    

    // If hover_text is present, add a tooltip
    if (this.metaData.hasOwnProperty('hover_text')) {
      this.deckgl.setProps({
        getTooltip: this.tooltipFunction,
      });
    }

    if (this.onClickFunction) {
      this.deckgl.setProps({
        onClick: this.onClickFunction,
      });
    }

    //  if search is enabled, add search data array
    if (this.searchField) {
      this.searchArray = this.metaData[this.searchField].map(d => d.toLowerCase());
    }
  }

  connectHistogram(histogramItem) {
    this.histogramItem = histogramItem;
    this.histogramItemId = histogramItem.state.chart.chartContainerId;
  }

  addBackgroundImage(image, bounds) {
    this.imageLayer = new deck.BitmapLayer({
      id: 'imageLayer',
      bounds: bounds,
      image: image,
      parameters: {
        depthTest: false
      }
    });

    this.layers.push(this.imageLayer);
    this.layers.sort((a, b) => getLayerIndex(a) - getLayerIndex(b));
    this.deckgl.setProps({ layers: [...this.layers] });
  }

  async addSelectionHandler(callback, selectionKind = "lasso-selection", timeoutMs = 60000) {
    const startTime = Date.now();

    if (selectionKind === "lasso-selection") {
      // Wait for the lasso selector to be available
      while (!this.lassoSelector) {
        if (Date.now() - startTime > timeoutMs) {
          throw new Error('Timeout: lassoSelector did not become available within the specified timeout period');
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      this.lassoSelector.registerSelectionHandler(callback);
    } else {
      if (!this.selectionCallbacks) {
        this.selectionCallbacks = {};
      }
      if (this.selectionCallbacks[selectionKind]) {
        this.selectionCallbacks[selectionKind].push(callback);
      }
      this.selectionCallbacks[selectionKind] = [callback];
    }
  }

  highlightPoints(itemId) {
    const selectedIndices = this.dataSelectionManager.getSelectedIndices();
    const semiSelectedIndices = this.dataSelectionManager.getBasicSelectedIndices();
    const hasSelectedIndices = selectedIndices.size !== 0;
    const hasSemiSelectedIndices = semiSelectedIndices.size !== 0;
    const hasLassoSelection = this.dataSelectionManager.hasSpecialSelection();

    // Update selected array
    if (hasLassoSelection) {
      if (hasSelectedIndices) {
        if (hasSemiSelectedIndices) {
          this.selected.fill(-1.0);
          for (let i of semiSelectedIndices) {
            this.selected[i] = 0.0;
          }
        } else {
          this.selected.fill(0.0);
        }
        for (let i of selectedIndices) {
          this.selected[i] = 1.0;
        }
      } else {
        this.selected.fill(1.0);
      }
    } else {
      if (hasSelectedIndices) {
        this.selected.fill(-1.0);
        for (let i of selectedIndices) {
          this.selected[i] = 1.0;
        }
      } else {
        this.selected.fill(1.0);
      }
    }
    // Increment update trigger
    this.updateTriggerCounter++;

    const sizeAdjust = 1/(1 + (Math.sqrt(selectedIndices.size) / Math.log2(this.selected.length)));

    // Update regular point layer for borders/background
    const updatedPointLayer = this.pointLayer.clone({
      data: {
        ...this.pointLayer.props.data,
        attributes: {
          ...this.pointLayer.props.data.attributes,
          getFilterValue: { value: this.selected, size: 1 }
        }
      },
      radiusMinPixels: hasSelectedIndices ? 2 * (this.pointRadiusMinPixels + sizeAdjust) : this.pointRadiusMinPixels,
      // Remove the grey border if images are visible
      lineWidthMinPixels: (this.imagesLoaded && !this.pointImageShowOutline) ? 0 : this.pointLayer.props.lineWidthMinPixels,
      lineWidthMaxPixels: (this.imagesLoaded && !this.pointImageShowOutline) ? 0 : this.pointLayer.props.lineWidthMaxPixels,
      lineWidthScale: (this.imagesLoaded && !this.pointImageShowOutline) ? 0 : this.pointLayer.props.lineWidthScale,
      updateTriggers: {
        getFilterValue: this.updateTriggerCounter,
        radiusMinPixels: this.updateTriggerCounter,
      }
    });

    const idx = this.layers.indexOf(this.pointLayer);
    this.layers = [...this.layers.slice(0, idx), updatedPointLayer, ...this.layers.slice(idx + 1)];
    this.pointLayer = updatedPointLayer;

    // Update image layer if it exists
    if (this.pointImageLayer && this.imagesLoaded) {
      if (hasSelectedIndices) {
        // If selection active, filter image data to only show selected points
        const visibleImageIndices = Array.from(selectedIndices).filter(index => this.loadedImageIndices.has(index));
        
        // Create a filtered data array
        const imageData = visibleImageIndices.map(index => {
          // Get the image URL for this point
          let imageUrl = this.pointImageUrl;
          if (this.pointImageField && this.metaData && this.metaData[this.pointImageField]) {
            const nodeImage = this.metaData[this.pointImageField][index];
            if (nodeImage) {
              imageUrl = nodeImage;
            }
          }
          
          return {
            index,
            imageUrl
          };
        });
        
        // Update the layer with filtered data
        const updatedImageLayer = this.pointImageLayer.clone({
          data: imageData,
          updateTriggers: {
            ...this.pointImageLayer.props.updateTriggers,
            getIcon: this.updateTriggerCounter
          }
        });
        
        // Update layers array
        const imageIdx = this.layers.indexOf(this.pointImageLayer);
        this.layers = [...this.layers.slice(0, imageIdx), updatedImageLayer, ...this.layers.slice(imageIdx + 1)];
        this.pointImageLayer = updatedImageLayer;
      } else {
        // If no selection, restore all image points that were previously loaded
        this._updateImageLayerData(); // This will recreate the full set of loaded images
      }
    }
    
    // Update text layer if it exists
    if (this.pointTextLayer && this.metaData) {
      if (hasSelectedIndices) {
        // Filter text data to only show labels for selected points
        const visibleTextIndices = Array.from(selectedIndices);
        
        // Create filtered text data
        const textData = visibleTextIndices.map(index => {
          const x = this.pointLayer.props.data.attributes.getPosition.value[index * 2];
          const y = this.pointLayer.props.data.attributes.getPosition.value[index * 2 + 1];
          
          return {
            position: [x, y],
            text: this.metaData[this.pointTextField][index] || '',
            index: index
          };
        });
        
        // Update the layer with filtered data
        const updatedTextLayer = this.pointTextLayer.clone({
          data: textData,
          updateTriggers: {
            ...this.pointTextLayer.props.updateTriggers,
            getText: this.updateTriggerCounter
          }
        });
        
        // Update layers array
        const textIdx = this.layers.indexOf(this.pointTextLayer);
        this.layers = [...this.layers.slice(0, textIdx), updatedTextLayer, ...this.layers.slice(textIdx + 1)];
        this.pointTextLayer = updatedTextLayer;
      } else {
        // If nothing is selected, restore all text labels
        // We need to recreate the full data array
        const textData = Array.from({length: this.selected.length}, (_, i) => {
          const x = this.pointLayer.props.data.attributes.getPosition.value[i * 2];
          const y = this.pointLayer.props.data.attributes.getPosition.value[i * 2 + 1];
          
          return {
            position: [x, y],
            text: this.metaData[this.pointTextField][i] || '',
            index: i
          };
        });
        
        // Update the layer with all data
        const updatedTextLayer = this.pointTextLayer.clone({
          data: textData,
          updateTriggers: {
            ...this.pointTextLayer.props.updateTriggers,
            getText: this.updateTriggerCounter
          }
        });
        
        // Update layers array
        const textIdx = this.layers.indexOf(this.pointTextLayer);
        this.layers = [...this.layers.slice(0, textIdx), updatedTextLayer, ...this.layers.slice(textIdx + 1)];
        this.pointTextLayer = updatedTextLayer;
      }
    }

    this.deckgl.setProps({
      layers: this.layers
    });

    // Update histogram, if any
    if (this.histogramItem && itemId !== this.histogramItemId) {
      if (hasSelectedIndices) {
        this.histogramItem.drawChartWithSelection(selectedIndices);
      } else {
        this.histogramItem.removeChartWithSelection(selectedIndices);
      }
    }
  }

  addSelection(selectedIndices, selectionKind) {
    this.dataSelectionManager.addOrUpdateSelectedIndicesOfItem(selectedIndices, selectionKind);
    this.highlightPoints(selectionKind);

    if (this.selectionCallbacks && this.selectionCallbacks[selectionKind]) {
      const currentSelectedIndices = Array.from(this.dataSelectionManager.getSelectedIndices());
      for (let callback of this.selectionCallbacks[selectionKind]) {
        callback(currentSelectedIndices);
      }
    }
  }

  removeSelection(selectionKind) {
    this.dataSelectionManager.removeSelectedIndicesOfItem(selectionKind);
    this.highlightPoints(selectionKind);

    if (this.selectionCallbacks && this.selectionCallbacks[selectionKind]) {
      const currentSelectedIndices = Array.from(this.dataSelectionManager.getSelectedIndices());
      for (let callback of this.selectionCallbacks[selectionKind]) {
        callback(currentSelectedIndices);
      }
    }
  }

  getSelectedIndices() {
    return this.dataSelectionManager.getSelectedIndices();
  }

  searchText(searchTerm) {
    const searchTermLower = searchTerm.toLowerCase();
    const selectedIndices = this.searchArray.reduce((indices, d, i) => {
      if (d.indexOf(searchTermLower) >= 0) {
        indices.push(i);
      }
      return indices;
    }, []);
    if (searchTerm === "") {
      this.dataSelectionManager.removeSelectedIndicesOfItem(this.searchItemId);
    } else {
      this.dataSelectionManager.addOrUpdateSelectedIndicesOfItem(selectedIndices, this.searchItemId);
    }
    if (this.selectionCallbacks && this.selectionCallbacks[this.searchItemId]) {
      const currentSelectedIndices = Array.from(this.dataSelectionManager.getSelectedIndices());
      for (let callback of this.selectionCallbacks[this.searchItemId]) {
        callback(currentSelectedIndices);
      }
    }
    this.highlightPoints(this.searchItemId);
  }

  recolorPoints(colorData, fieldName) {
    if (!this.hasOwnProperty(`${fieldName}Colors`)) {
      const numPoints = colorData[`${fieldName}_r`].length;
      const colors = new Uint8Array(numPoints * 4);
      for (let i = 0; i < numPoints; i++) {
        colors[i * 4] = colorData[`${fieldName}_r`][i];
        colors[i * 4 + 1] = colorData[`${fieldName}_g`][i];
        colors[i * 4 + 2] = colorData[`${fieldName}_b`][i];
        colors[i * 4 + 3] = colorData[`${fieldName}_a`][i];
      }
      this[`${fieldName}Colors`] = colors;
    }

    const updatedPointLayer = this.pointLayer.clone({
      data: {
        ...this.pointLayer.props.data,
        attributes: {
          ...this.pointLayer.props.data.attributes,
          getFillColor: { value: this[`${fieldName}Colors`], size: 4 }
        }
      }
    });
    
    // Increment update trigger
    this.updateTriggerCounter++;

    const idx = this.layers.indexOf(this.pointLayer);
    this.layers = [...this.layers.slice(0, idx), updatedPointLayer, ...this.layers.slice(idx + 1)];
    this.deckgl.setProps({
      layers: this.layers
    });
    this.pointLayer = updatedPointLayer;
  }

  resetPointColors() {
    const updatedPointLayer = this.pointLayer.clone({
      data: {
        ...this.pointLayer.props.data,
        attributes: {
          ...this.pointLayer.props.data.attributes,
          getFillColor: { value: this.originalColors, size: 4 }
        }
      }
    });
    
    // Increment update trigger
    this.updateTriggerCounter++;

    const idx = this.layers.indexOf(this.pointLayer);
    this.layers = [...this.layers.slice(0, idx), updatedPointLayer, ...this.layers.slice(idx + 1)];
    this.deckgl.setProps({
      layers: this.layers
    });
    this.pointLayer = updatedPointLayer;
  }
}

// Add a new method to filter points in viewport (after the class definition)
function getVisiblePointsInViewport(pointsData, viewState, containerWidth, containerHeight, maxPoints = 1000) {
  // Create a viewport from the current view state
  const viewport = new deck.WebMercatorViewport({
    width: containerWidth,
    height: containerHeight,
    longitude: viewState.longitude,
    latitude: viewState.latitude,
    zoom: viewState.zoom,
    pitch: viewState.pitch || 0,
    bearing: viewState.bearing || 0
  });
  
  // Get position attributes from the point data
  const positionArray = pointsData.attributes.getPosition.value;
  const numPoints = positionArray.length / 2;
  
  // Points inside the viewport
  const visiblePoints = [];
  
  // Find visible points
  for (let i = 0; i < numPoints; i++) {
    const x = positionArray[i * 2];
    const y = positionArray[i * 2 + 1];
    
    // Check if the point is in the viewport
    const pixelCoords = viewport.project([x, y]);
    if (pixelCoords[0] >= -50 && pixelCoords[0] <= viewport.width + 50 &&
        pixelCoords[1] >= -50 && pixelCoords[1] <= viewport.height + 50) {
      visiblePoints.push(i);
    }
  }
  
  // If we have too many points, sample them
  if (visiblePoints.length > maxPoints) {
    // Simple sampling - take every nth point
    const n = Math.ceil(visiblePoints.length / maxPoints);
    return visiblePoints.filter((_, idx) => idx % n === 0);
  }
  
  return visiblePoints;
}