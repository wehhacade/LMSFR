import L from "leaflet";

/** Sharp street basemap — clearer labels and roads than default OSM. */
export function createStreetTileLayer(): L.TileLayer {
  return L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
      detectRetina: true,
    },
  );
}

/** Satellite imagery (Esri) — useful for Mogadishu neighbourhood context. */
export function createSatelliteTileLayer(): L.TileLayer {
  return L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Tiles &copy; Esri",
      maxZoom: 20,
      maxNativeZoom: 19,
      detectRetina: true,
    },
  );
}

/** Street labels overlay on top of satellite. */
export function createSatelliteLabelsLayer(): L.TileLayer {
  return L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Labels &copy; Esri",
      maxZoom: 20,
      maxNativeZoom: 19,
      detectRetina: true,
      opacity: 0.92,
      pane: "overlayPane",
    },
  );
}

export function addBaseLayerControl(
  map: L.Map,
  labels?: { street: string; satellite: string },
): { street: L.TileLayer; satelliteGroup: L.LayerGroup } {
  const street = createStreetTileLayer();
  const satellite = createSatelliteTileLayer();
  const labelLayer = createSatelliteLabelsLayer();
  const satelliteGroup = L.layerGroup([satellite, labelLayer]);

  street.addTo(map);
  L.control
    .layers(
      {
        [labels?.street ?? "Streets"]: street,
        [labels?.satellite ?? "Satellite"]: satelliteGroup,
      },
      {},
      { position: "topright", collapsed: false },
    )
    .addTo(map);

  return { street, satelliteGroup };
}
