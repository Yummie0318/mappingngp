declare module "@tmcw/togeojson" {
    export function kml(doc: Document): GeoJSON.FeatureCollection;
    export function gpx(doc: Document): GeoJSON.FeatureCollection;
  }
  