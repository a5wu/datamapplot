LAYER_ORDER = [
  "imageLayer",
  "dataPointLayer",
  "pointTextLayer",
  "boundaryLayer",
  "labelLayer",
];

// There is an effective 100 layer limit of label layers or boundary layers...
function getLayerIndex(object) {
  if (object.id.startsWith("labelLayer")) {
    return (
      LAYER_ORDER.indexOf("labelLayer") +
      parseInt(object.id.split("-")[1] / 100)
    );
  } else {
    return LAYER_ORDER.indexOf(object.id);
  }
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
          reject(
            new Error(`Font ${fontName} did not load within ${maxWait}ms`)
          );
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

function calculateZoomLevel(
  bounds,
  viewportWidth,
  viewportHeight,
  padding = 0.5
) {
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
    this.labelData = null;
    this.metaData = null;
    this.layers = [];
    const { viewportWidth, viewportHeight } = getInitialViewportSize();
    const { zoomLevel, dataCenter } = calculateZoomLevel(
      bounds,
      viewportWidth,
      viewportHeight
    );
    this.deckgl = new deck.DeckGL({
      container: container,
      initialViewState: {
        latitude: dataCenter[1],
        longitude: dataCenter[0],
        zoom: zoomLevel,
      },
      controller: { scrollZoom: { speed: 0.01, smooth: true } },
      onViewStateChange: ({ viewState }) => {
        // Check if we have a point text layer and update its visibility based on zoom
        if (this.pointTextLayer) {
          const shouldShowText = viewState.zoom >= this.pointTextMinZoom;
          if (shouldShowText !== this.pointTextLayer.props.visible) {
            // Update the point text layer's visibility
            const updatedTextLayer = this.pointTextLayer.clone({
              visible: shouldShowText,
            });

            // Replace the old layer with the updated one
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
    this.updateTriggerCounter = 0;
    this.dataSelectionManager = new DataSelectionManager(lassoSelectionItemId);
  }

  addPoints(
    pointData,
    {
      pointSize,
      pointOutlineColor = [250, 250, 250, 128],
      pointLineWidth = 0.001,
      pointHoverColor = [170, 0, 0, 187],
      pointLineWidthMaxPixels = 3,
      pointLineWidthMinPixels = 0.001,
      pointRadiusMaxPixels = 16,
      pointRadiusMinPixels = 0.2,
      pointTextField = null,
      pointTextMinZoom = 10,
      pointTextSize = 12,
      pointTextOffset = [0, 10],
      pointTextColor = null,
      pointTextOutlineWidth = 2,
      pointTextOutlineColor = [255, 255, 255, 200],
    }
  ) {
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
    this.pointTextMinZoom = pointTextMinZoom;

    let scatterAttributes = {
      getPosition: { value: positions, size: 2 },
      getFillColor: { value: colors, size: 4 },
      getFilterValue: { value: this.selected, size: 1 },
    };
    if (variableSize) {
      scatterAttributes.getRadius = { value: sizes, size: 1 };
    }

    this.pointLayer = new deck.ScatterplotLayer({
      id: "dataPointLayer",
      data: {
        length: numPoints,
        attributes: scatterAttributes,
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
        getFilterValue: this.updateTriggerCounter, // We'll increment this to trigger updates
      },
      instanceCount: numPoints,
      parameters: {
        depthTest: false,
      },
    });

    this.layers.push(this.pointLayer);

    // Only create text layer if pointTextField is specified and exists in the data
    if (pointTextField && pointData[pointTextField]) {
      const textLabels = pointData[pointTextField];

      const getTextColor =
        pointTextColor ||
        ((d) => [
          colors[d.index * 4],
          colors[d.index * 4 + 1],
          colors[d.index * 4 + 2],
          255,
        ]);

      this.pointTextLayer = new deck.TextLayer({
        id: "pointTextLayer",
        data: Array.from({ length: numPoints }, (_, i) => ({
          position: [positions[i * 2], positions[i * 2 + 1]],
          text: textLabels[i],
          index: i,
        })),
        getText: (d) => d.text,
        getPosition: (d) => d.position,
        getColor: getTextColor,
        getSize: pointTextSize,
        sizeScale: 1,
        getTextAnchor: "middle",
        getAlignmentBaseline: "top",
        getPixelOffset: pointTextOffset,
        fontFamily: "Arial, sans-serif",
        wordBreak: "break-word",
        outlineWidth: pointTextOutlineWidth,
        outlineColor: pointTextOutlineColor,
        visible: false, // Start with text hidden, will be shown based on zoom
        pickable: false,
        billboard: true,
        // Add collision detection
        collisionEnabled: true,
        collisionFilter: (objectInfo) => objectInfo.index % 5 === 0, // Basic thinning for dense areas
        extensions: [new deck.CollisionFilterExtension()],
        parameters: {
          depthTest: false,
        },
      });

      this.layers.push(this.pointTextLayer);
    }

    this.layers.sort((a, b) => getLayerIndex(a) - getLayerIndex(b));
    this.deckgl.setProps({ layers: [...this.layers] });
  }

  addLabels(
    labelData,
    {
      labelTextColor = (d) => [d.r, d.g, d.b, d.a],
      textMinPixelSize = 18,
      textMaxPixelSize = 36,
      textOutlineWidth = 8,
      textOutlineColor = [238, 238, 238, 221],
      textBackgroundColor = [255, 255, 255, 64],
      fontFamily = "Roboto",
      minFontWeight = 100,
      maxFontWeight = 900,
      lineSpacing = 0.95,
      textCollisionSizeScale = 3.0,
      pickable = true,
    }
  ) {
    const numLabels = labelData.length;
    this.labelTextColor = labelTextColor;
    this.textMinPixelSize = textMinPixelSize;
    this.textMaxPixelSize = textMaxPixelSize;
    this.textOutlineWidth = textOutlineWidth;
    this.textOutlineColor = textOutlineColor;
    this.textBackgroundColor = textBackgroundColor;
    this.fontFamily = fontFamily;
    this.minFontWeight = minFontWeight;
    this.maxFontWeight = maxFontWeight;
    this.lineSpacing = lineSpacing;
    this.textCollisionSizeScale = textCollisionSizeScale;
    this.numLabelLayers = Math.max(...labelData.map((d) => d.layer));

    const maxSize = Math.max(...labelData.map((d) => d.size));

    waitForFont(this.fontFamily);

    const collisionFilter = new deck.CollisionFilterExtension();
    const weightRange = maxFontWeight - minFontWeight;

    this.labelLayers = [];
    for (let i = 0; i <= this.numLabelLayers; i++) {
      const weight = minFontWeight + (weightRange / this.numLabelLayers) * i;
      const layerData = labelData
        .filter((d) => d.layer >= i)
        .map((d) => ({
          x: d.x,
          y: d.y,
          label: d.label,
          size: d.size,
          r: d.r,
          g: d.g,
          b: d.b,
          a: d.layer == i ? 255 : 0,
          visible: d.layer === i,
        }));
      this.labelLayers.push(
        new deck.TextLayer({
          id: `labelLayer-${i}`,
          data: layerData,
          pickable: false,
          getPosition: (d) => [d.x, d.y],
          getText: (d) => d.label,
          getColor: this.labelTextColor,
          getSize: (d) => d.size,
          sizeScale: 1,
          sizeMinPixels: this.textMinPixelSize,
          sizeMaxPixels: this.textMaxPixelSize,
          outlineWidth: this.textOutlineWidth,
          outlineColor: this.textOutlineColor,
          getBackgroundColor: (d) =>
            d.visible ? this.textBackgroundColor : [0, 0, 0, 0],
          getBackgroundPadding: [15, 15, 15, 15],
          background: true,
          characterSet: "auto",
          fontFamily: this.fontFamily,
          fontWeight: weight,
          lineHeight: this.lineSpacing,
          fontSettings: { sdf: true },
          getTextAnchor: "middle",
          getAlignmentBaseline: "center",
          lineHeight: 0.95,
          // elevation: 100,
          // CollideExtension options
          collisionEnabled: true,
          getCollisionPriority: (d) => d.size + i,
          alphaCutoff: -1,
          collisionGroup: `LabelGroup${i}`,
          collisionTestProps: {
            sizeScale:
              this.textCollisionSizeScale * (2 + this.numLabelLayers - i),
            sizeMaxPixels: 2 * this.textMaxPixelSize + 5,
            sizeMinPixels: 2 * this.textMinPixelSize + 5,
            getBackgroundPadding: [30, 30, 30, 30],
          },
          extensions: [collisionFilter],
          instanceCount: numLabels,
          parameters: {
            depthTest: false,
          },
        })
      );
    }

    this.layers.push(...this.labelLayers);
    console.log(this.layers);
    this.layers.sort((a, b) => getLayerIndex(a) - getLayerIndex(b));
    this.deckgl.setProps({ layers: [...this.layers] });
  }

  addBoundaries(boundaryData, { clusterBoundaryLineWidth = 0.5 }) {
    const numBoundaries = boundaryData.length;
    this.clusterBoundaryLineWidth = clusterBoundaryLineWidth;

    this.boundaryLayer = new deck.PolygonLayer({
      id: "boundaryLayer",
      data: boundaryData,
      stroked: true,
      filled: false,
      getLineColor: (d) => [d.r, d.g, d.b, d.a],
      getPolygon: (d) => d.polygon,
      lineWidthUnits: "common",
      getLineWidth: (d) => d.size * d.size,
      lineWidthScale: this.clusterBoundaryLineWidth * 5e-5,
      lineJointRounded: true,
      lineWidthMaxPixels: 4,
      lineWidthMinPixels: 0.0,
      instanceCount: numBoundaries,
      parameters: {
        depthTest: false,
      },
    });

    this.layers.push(this.boundaryLayer);
    this.layers.sort((a, b) => getLayerIndex(a) - getLayerIndex(b));
    this.deckgl.setProps({ layers: [...this.layers] });
  }

  addMetaData(
    metaData,
    {
      tooltipFunction = ({ index }) => this.metaData.hover_text[index],
      onClickFunction = null,
      searchField = null,
    }
  ) {
    this.metaData = metaData;
    this.tooltipFunction = tooltipFunction;
    this.onClickFunction = onClickFunction;
    this.searchField = searchField;

    // If hover_text is present, add a tooltip
    if (this.metaData.hasOwnProperty("hover_text")) {
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
      this.searchArray = this.metaData[this.searchField].map((d) =>
        d.toLowerCase()
      );
    }
  }

  connectHistogram(histogramItem) {
    this.histogramItem = histogramItem;
    this.histogramItemId = histogramItem.state.chart.chartContainerId;
  }

  addBackgroundImage(image, bounds) {
    this.imageLayer = new deck.BitmapLayer({
      id: "imageLayer",
      bounds: bounds,
      image: image,
      parameters: {
        depthTest: false,
      },
    });

    this.layers.push(this.imageLayer);
    this.layers.sort((a, b) => getLayerIndex(a) - getLayerIndex(b));
    this.deckgl.setProps({ layers: [...this.layers] });
  }

  async addSelectionHandler(
    callback,
    selectionKind = "lasso-selection",
    timeoutMs = 60000
  ) {
    const startTime = Date.now();

    if (selectionKind === "lasso-selection") {
      // Wait for the lasso selector to be available
      while (!this.lassoSelector) {
        if (Date.now() - startTime > timeoutMs) {
          throw new Error(
            "Timeout: lassoSelector did not become available within the specified timeout period"
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
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
    const semiSelectedIndices =
      this.dataSelectionManager.getBasicSelectedIndices();
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

    const sizeAdjust =
      1 /
      (1 + Math.sqrt(selectedIndices.size) / Math.log2(this.selected.length));

    const updatedPointLayer = this.pointLayer.clone({
      data: {
        ...this.pointLayer.props.data,
        attributes: {
          ...this.pointLayer.props.data.attributes,
          getFilterValue: { value: this.selected, size: 1 },
        },
      },
      radiusMinPixels: hasSelectedIndices
        ? 2 * (this.pointRadiusMinPixels + sizeAdjust)
        : this.pointRadiusMinPixels,
      updateTriggers: {
        getFilterValue: this.updateTriggerCounter,
        radiusMinPixels: this.updateTriggerCounter,
      },
    });

    const idx = this.layers.indexOf(this.pointLayer);
    this.layers = [
      ...this.layers.slice(0, idx),
      updatedPointLayer,
      ...this.layers.slice(idx + 1),
    ];
    this.deckgl.setProps({
      layers: this.layers,
    });
    this.pointLayer = updatedPointLayer;

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
    this.dataSelectionManager.addOrUpdateSelectedIndicesOfItem(
      selectedIndices,
      selectionKind
    );
    this.highlightPoints(selectionKind);

    if (this.selectionCallbacks && this.selectionCallbacks[selectionKind]) {
      const currentSelectedIndices = Array.from(
        this.dataSelectionManager.getSelectedIndices()
      );
      for (let callback of this.selectionCallbacks[selectionKind]) {
        callback(currentSelectedIndices);
      }
    }
  }

  removeSelection(selectionKind) {
    this.dataSelectionManager.removeSelectedIndicesOfItem(selectionKind);
    this.highlightPoints(selectionKind);

    if (this.selectionCallbacks && this.selectionCallbacks[selectionKind]) {
      const currentSelectedIndices = Array.from(
        this.dataSelectionManager.getSelectedIndices()
      );
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
      this.dataSelectionManager.addOrUpdateSelectedIndicesOfItem(
        selectedIndices,
        this.searchItemId
      );
    }
    if (this.selectionCallbacks && this.selectionCallbacks[this.searchItemId]) {
      const currentSelectedIndices = Array.from(
        this.dataSelectionManager.getSelectedIndices()
      );
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
          getFillColor: { value: this[`${fieldName}Colors`], size: 4 },
        },
      },
      transitions: {
        getFillColor: {
          duration: 1500,
          easing: d3.easeCubicInOut,
        },
      },
    });

    // Increment update trigger
    this.updateTriggerCounter++;

    const idx = this.layers.indexOf(this.pointLayer);
    this.layers = [
      ...this.layers.slice(0, idx),
      updatedPointLayer,
      ...this.layers.slice(idx + 1),
    ];
    this.deckgl.setProps({
      layers: this.layers,
    });
    this.pointLayer = updatedPointLayer;
  }

  resetPointColors() {
    const updatedPointLayer = this.pointLayer.clone({
      data: {
        ...this.pointLayer.props.data,
        attributes: {
          ...this.pointLayer.props.data.attributes,
          getFillColor: { value: this.originalColors, size: 4 },
        },
      },
      transitions: {
        getFillColor: {
          duration: 1500,
          easing: d3.easeCubicInOut,
        },
      },
    });

    // Increment update trigger
    this.updateTriggerCounter++;

    const idx = this.layers.indexOf(this.pointLayer);
    this.layers = [
      ...this.layers.slice(0, idx),
      updatedPointLayer,
      ...this.layers.slice(idx + 1),
    ];
    this.deckgl.setProps({
      layers: this.layers,
    });
    this.pointLayer = updatedPointLayer;
  }
}
