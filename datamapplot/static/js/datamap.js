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
    
    // Add properties for image loading optimization
    this.imageLoadingDebounceTimer = null;
    this.pendingImageUpdates = new Map(); // For batching image updates
    this.isImageUpdateInProgress = false;
    this.debounceDelay = 150; // milliseconds to wait after viewport stops changing
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
    
    // Store important settings we'll need 
    this.pointImageMinZoom = pointImageMinZoom;
    this.pointImageUrl = pointImageUrl;
    this.pointImageField = pointImageField;
    this.pointImageBorderSizeFactor = pointImageBorderSizeFactor;
    this.pointImageShowOutline = pointImageShowOutline;
    
    // Track which images have been loaded
    this.loadedImageIndices = new Set();
    
    // Create an array that mirrors the point data structure to use for the image layer
    const numPoints = this.pointLayer.props.data.length;
    const imageLayerData = Array(numPoints).fill(null).map((_, i) => ({
      index: i,
      imageUrl: null, // Will be populated when needed
      isLoaded: false
    }));
    
    // Border sizing - make images slightly smaller than points to create border effect
    const borderSizeFactor = this.pointImageBorderSizeFactor;
    
    // Check if we have variable size points (marker_size_array)
    const hasVariableSizes = pointProps.data.attributes.getRadius !== undefined;
    
    // Create the image layer
    this.pointImageLayer = new deck.IconLayer({
      id: 'pointImageLayer',
      data: imageLayerData,
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
        // Return a placeholder if the image hasn't been loaded yet
        if (!d.imageUrl) {
          return {
            url: this.pointImageUrl, // Default URL
            width: 128,
            height: 128,
            mask: false
          };
        }
        
        return {
          url: d.imageUrl,
          width: 128,
          height: 128,
          mask: false
        };
      },
      // Size settings - apply border effect by making images slightly smaller
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
      sizeUnits: pointProps.radiusUnits === 'common' ? 'common' : 'pixels',
      sizeScale: pointProps.radiusScale || 1,
      sizeMinPixels: (pointProps.radiusMinPixels || 1) * 2 * borderSizeFactor,
      sizeMaxPixels: (pointProps.radiusMaxPixels || 100) * 2 * borderSizeFactor,
      // Other properties
      getColor: [255, 255, 255],
      visible: false, // Start hidden, visibility will be updated in _handleLayerVisibilityOnZoom
      updateTriggers: {
        getSize: pointProps.updateTriggers?.getRadius || 0,
        getIcon: 0 
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

  // Helper method to handle layer visibility changes based on zoom
  _handleLayerVisibilityOnZoom(viewState) {
    // Handle image layer
    if (this.pointImageMinZoom !== undefined && this.pointImageLayer) {
      const imageVisible = viewState.zoom >= this.pointImageMinZoom;
      
      // If visibility state changed, update it
      if (imageVisible !== this.pointImageLayer.props.visible) {
        // Update image layer visibility - using clone instead of setProps
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
            lineWidthMinPixels: (imageVisible && !this.pointImageShowOutline) ? 0 : this.pointLineWidthMinPixels,
            lineWidthMaxPixels: (imageVisible && !this.pointImageShowOutline) ? 0 : this.pointLineWidthMaxPixels,
            lineWidthScale: (imageVisible && !this.pointImageShowOutline) ? 0 : this.pointLineWidth,
          });
          const pointIdx = this.layers.indexOf(this.pointLayer);
          this.layers = [...this.layers.slice(0, pointIdx), updatedPointLayer, ...this.layers.slice(pointIdx + 1)];
          this.pointLayer = updatedPointLayer;
        }
        
        this.deckgl.setProps({ layers: this.layers });
      }
      
      // If images are visible, debounce load images for visible points
      if (imageVisible) {
        // Clear any existing timer
        if (this.imageLoadingDebounceTimer) {
          clearTimeout(this.imageLoadingDebounceTimer);
        }
        
        // Set a new timer to check for new points only after movement has stopped
        this.imageLoadingDebounceTimer = setTimeout(() => {
          // Only check for new points if view has changed significantly
          if (!this.lastViewportCheck || 
             Math.abs(viewState.longitude - this.lastViewportCheck.longitude) > 0.01 ||
             Math.abs(viewState.latitude - this.lastViewportCheck.latitude) > 0.01 ||
             Math.abs(viewState.zoom - this.lastViewportCheck.zoom) > 0.2) {
            
            this._loadImagesForViewport(viewState);
            this.lastViewportCheck = {...viewState};
          }
        }, this.debounceDelay);
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
        this.pointTextLayer = updatedLayer;
        this.deckgl.setProps({ layers: this.layers });
      }
    }
  }
  
  // Optimized method to load images for the current viewport
  _loadImagesForViewport(viewState) {
    if (!this.pointLayer || !this.pointImageLayer || this.isImageUpdateInProgress) return;
    
    // Get visible points
    const visiblePoints = getVisiblePointsInViewport(
      this.pointLayer.props.data,
      viewState,
      this.container.clientWidth,
      this.container.clientHeight
    );
    
    // Filter visible points by selected status if there's a selection active
    let pointsToConsider = visiblePoints;
    const selectedIndices = this.dataSelectionManager.getSelectedIndices();
    if (selectedIndices.size > 0) {
      // Only load images for selected points that are in the viewport
      pointsToConsider = visiblePoints.filter(idx => this.selected[idx] > 0);
    }
    
    // Find new points that need images
    const newPointsToLoad = pointsToConsider.filter(idx => !this.loadedImageIndices.has(idx));
    
    // If there are new points to load, queue them for update
    if (newPointsToLoad.length > 0) {
      console.log(`Queueing images for ${newPointsToLoad.length} new visible points`);
      
      // Mark these indices as loaded
      newPointsToLoad.forEach(idx => {
        this.loadedImageIndices.add(idx);
        
        // Get the image URL for this point
        let imageUrl = this.pointImageUrl; // Default
        
        if (this.pointImageField && this.metaData && this.metaData[this.pointImageField]) {
          const nodeImage = this.metaData[this.pointImageField][idx];
          if (nodeImage) {
            imageUrl = nodeImage;
          }
        }
        
        // Add to pending updates map
        this.pendingImageUpdates.set(idx, {
          index: idx,
          imageUrl: imageUrl,
          isLoaded: true
        });
      });
      
      // Apply updates in batch (if not already in progress)
      this._applyPendingImageUpdates();
    }
  }
  
  // Apply batched image updates with clone instead of setProps
  _applyPendingImageUpdates() {
    // If already processing updates or no pending updates, exit
    if (this.isImageUpdateInProgress || this.pendingImageUpdates.size === 0) return;
    
    this.isImageUpdateInProgress = true;
    
    // Get the current data array
    const currentData = this.pointImageLayer.props.data;
    // Create a shallow copy of the array
    const updatedData = [...currentData];
    
    // Apply all pending updates
    for (const [idx, updatedPoint] of this.pendingImageUpdates.entries()) {
      updatedData[idx] = {
        ...updatedData[idx],
        ...updatedPoint
      };
    }
    
    // Clear pending updates
    this.pendingImageUpdates.clear();
    
    // Update the layer with the new data using clone
    const updatedImageLayer = this.pointImageLayer.clone({
      data: updatedData,
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
    
    // Reset flag after a short delay to allow rendering to complete
    setTimeout(() => {
      this.isImageUpdateInProgress = false;
      
      // If more updates came in while we were processing, apply those too
      if (this.pendingImageUpdates.size > 0) {
        this._applyPendingImageUpdates();
      }
    }, 10);
  }
  
  // Optimized highlightPoints method to avoid full layer cloning
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

    // Update point layer using clone
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
      lineWidthMinPixels: (this.pointImageLayer && this.pointImageLayer.props.visible && !this.pointImageShowOutline) ? 0 : this.pointLineWidthMinPixels,
      lineWidthMaxPixels: (this.pointImageLayer && this.pointImageLayer.props.visible && !this.pointImageShowOutline) ? 0 : this.pointLineWidthMaxPixels, 
      lineWidthScale: (this.pointImageLayer && this.pointImageLayer.props.visible && !this.pointImageShowOutline) ? 0 : this.pointLineWidth,
      updateTriggers: {
        getFilterValue: this.updateTriggerCounter,
        radiusMinPixels: this.updateTriggerCounter,
      }
    });

    const idx = this.layers.indexOf(this.pointLayer);
    this.layers = [...this.layers.slice(0, idx), updatedPointLayer, ...this.layers.slice(idx + 1)];
    this.pointLayer = updatedPointLayer;

    // Update image layer if it exists
    if (this.pointImageLayer) {
      // If selection active, update image visibility based on selected status
      if (hasSelectedIndices) {
        // Apply image updates in batches for better performance
        const newPendingUpdates = new Map();
        
        // Process each data point
        for (let i = 0; i < this.pointImageLayer.props.data.length; i++) {
          const currentPoint = this.pointImageLayer.props.data[i];
          const isSelected = this.selected[i] > 0;
          const currentlyHasImage = currentPoint.imageUrl !== null;
          
          // Only queue updates for points that need changing
          if (isSelected !== currentlyHasImage) {
            if (isSelected) {
              // Point is selected but doesn't have an image - load it
              let imageUrl = this.pointImageUrl; // Default
              
              if (this.pointImageField && this.metaData && this.metaData[this.pointImageField]) {
                const nodeImage = this.metaData[this.pointImageField][i];
                if (nodeImage) {
                  imageUrl = nodeImage;
                }
              }
              
              newPendingUpdates.set(i, {
                index: i,
                imageUrl: imageUrl,
                isLoaded: true
              });
            } else {
              // Point is not selected but has an image - remove it
              newPendingUpdates.set(i, {
                index: i,
                imageUrl: null,
                isLoaded: false
              });
            }
          }
        }
        
        // If we have updates to apply
        if (newPendingUpdates.size > 0) {
          // Add them to the pending updates map
          for (const [idx, update] of newPendingUpdates.entries()) {
            this.pendingImageUpdates.set(idx, update);
          }
          
          // Apply all pending updates
          this._applyPendingImageUpdates();
        }
      } 
      // If no selection, make sure images are consistent with loaded state
      else if (this.pointImageLayer.props.visible) {
        // Reload images for visible points
        this._loadImagesForViewport(this.deckgl.viewState);
      }
    }

    // Update text layer if it exists
    if (this.pointTextLayer) {
      if (hasSelectedIndices) {
        // Update to show only selected points - avoid recreating the entire array
        const currentData = this.pointTextLayer.props.data;
        const updatedData = [...currentData];
        
        // Only update visibility for points that need to change
        let needsUpdate = false;
        for (let i = 0; i < updatedData.length; i++) {
          const isSelected = this.selected[i] > 0;
          if (updatedData[i].visible !== isSelected) {
            updatedData[i] = {
              ...updatedData[i],
              visible: isSelected
            };
            needsUpdate = true;
          }
        }
        
        // Only update the layer if needed
        if (needsUpdate) {
          const updatedTextLayer = this.pointTextLayer.clone({
            data: updatedData,
            updateTriggers: {
              getPosition: this.updateTriggerCounter,
              getText: this.updateTriggerCounter
            }
          });
          
          const idx = this.layers.indexOf(this.pointTextLayer);
          this.layers = [...this.layers.slice(0, idx), updatedTextLayer, ...this.layers.slice(idx + 1)];
          this.pointTextLayer = updatedTextLayer;
        }
      } else {
        // Show all text - avoid recreating the entire array if all texts are already visible
        const currentData = this.pointTextLayer.props.data;
        let allVisible = true;
        
        // Check if any points are currently hidden
        for (let i = 0; i < currentData.length; i++) {
          if (!currentData[i].visible) {
            allVisible = false;
            break;
          }
        }
        
        // Only update if needed
        if (!allVisible) {
          const updatedData = [...currentData];
          
          for (let i = 0; i < updatedData.length; i++) {
            if (!updatedData[i].visible) {
              updatedData[i] = {
                ...updatedData[i],
                visible: true
              };
            }
          }
          
          const updatedTextLayer = this.pointTextLayer.clone({
            data: updatedData,
            updateTriggers: {
              getPosition: this.updateTriggerCounter,
              getText: this.updateTriggerCounter
            }
          });
          
          const idx = this.layers.indexOf(this.pointTextLayer);
          this.layers = [...this.layers.slice(0, idx), updatedTextLayer, ...this.layers.slice(idx + 1)];
          this.pointTextLayer = updatedTextLayer;
        }
      }
    }

    // Update deck.gl with the new layers array
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