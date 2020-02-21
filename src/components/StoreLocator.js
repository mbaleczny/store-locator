import promiseMap from 'p-map';
import cx from 'classnames';
import { getUserLocation, loadScript } from 'lib/utils';
import { Component } from 'preact';
import SearchIcon from './SearchIcon';
import classNames from './StoreLocator.css';
import MarkerClusterer from '@google/markerclustererplus';
import Papa from 'papaparse';
import createHtmlMapMarker from './createHtmlMapMarker';

const units = {
  METRIC: 0,
  IMPERIAL: 1
};

const style = [
  {
    width: 30,
    height: 30,
    className: 'custom-clustericon-1'
  },
  {
    width: 40,
    height: 40,
    className: 'custom-clustericon-2'
  },
  {
    width: 50,
    height: 50,
    className: 'custom-clustericon-3'
  }
];

const MAP_STYLES = [
  {
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#f5f5f5"
      }
    ]
  },
  {
    "elementType": "labels.icon",
    "stylers": [
      {
        "visibility": "on"
      }
    ]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#616161"
      }
    ]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [
      {
        "color": "#f5f5f5"
      }
    ]
  },
  {
    "featureType": "administrative.country",
    "elementType": "geometry.stroke",
    "stylers": [
      {
        "color": "#423d36"
      },
      {
        "visibility": "on"
      }
    ]
  },
  {
    "featureType": "administrative.land_parcel",
    "stylers": [
      {
        "visibility": "on"
      }
    ]
  },
  {
    "featureType": "administrative.land_parcel",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#bdbdbd"
      }
    ]
  },
  {
    "featureType": "administrative.locality",
    "stylers": [
      {
        "visibility": "on"
      }
    ]
  },
  {
    "featureType": "administrative.neighborhood",
    "stylers": [
      {
        "visibility": "on"
      }
    ]
  },
  {
    "featureType": "administrative.province",
    "stylers": [
      {
        "visibility": "on"
      }
    ]
  },
  {
    "featureType": "poi",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#eeeeee"
      }
    ]
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "featureType": "poi.business",
    "stylers": [
      {
        "visibility": "off"
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#e5e5e5"
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "labels.text",
    "stylers": [
      {
        "visibility": "off"
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#9e9e9e"
      }
    ]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#ffffff"
      }
    ]
  },
  {
    "featureType": "road.arterial",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#dadada"
      }
    ]
  },
  {
    "featureType": "road.highway",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#616161"
      }
    ]
  },
  {
    "featureType": "road.local",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#9e9e9e"
      }
    ]
  },
  {
    "featureType": "transit.line",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#e5e5e5"
      }
    ]
  },
  {
    "featureType": "transit.station",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#eeeeee"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#c9c9c9"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "geometry.fill",
    "stylers": [
      {
        "color": "#9fdcff"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#9e9e9e"
      }
    ]
  }
];

const toMiles = 1.609;

const REGULAR_MARKER_TARGET_ZOOM = 18;

export class StoreLocator extends Component {
  static defaultProps = {
    clusters: [],
    spreadSheetId: null,
    zoom: 4,
    clusteringMaxZoom: 9,
    clusterThresholdZoom: 13,
    clusterClickZoom: 13,
    clusterSize: 60,
    center: undefined,
    travelMode: 'DRIVING',
    homeLocationHint: 'Current location',
    unitSystem: 'METRIC',
    weekDays: ["Monday", "Tuesday", "Wednesday", "Thurday", "Friday", "Saturday", "Sunday"],
    farAwayMarkerOpacity: 0.6,
    fullWidthMap: false,
    loading: false,
    language: 'en'
  };

  constructor(props) {
    super(props);
    this.state = {
      searchLocation: null,
      activeStoreId: null,
      stores: [],
      clusters: props.clusters ? this.parseMapPoints(props.clusters) : [],
      zoom: props.zoom,
      center: props.center,
      loading: props.loading,
    };
    this.markers = [];
    this.markerClusterer = null;
    this.language = props.language;
  }

  componentDidMount() {
    this.loadGoogleMaps()
      .then(this.setupMap);
  }

  async loadGoogleMaps() {
    if (window.google && window.google.maps) return Promise.resolve();
    return loadScript(
      `https://maps.googleapis.com/maps/api/js?key=${this.props.apiKey}&language=${this.props.language}&libraries=places`
    );
  }

  getMarkerIcon(icon) {
    if (!icon) return null;
    const { markerIconSize } = this.props;
    if (typeof icon === 'string' && markerIconSize) {
      const iconSize = markerIconSize;
      return {
        url: icon,
        scaledSize: new google.maps.Size(iconSize[0], iconSize[1])
      };
    }
    return icon;
  }

  addStoreMarker = (clustered, store) => {
    const marker = clustered ? this.createClusteredMarker(store) : this.createRegularMarker(store);

    if (clustered) {
      google.maps.event.addListener(marker, 'click', () => {
        this.map.panTo(store.location);
        this.map.setZoom(this.props.clusterClickZoom);
      });
    } else {
      let indoorMapLink = store.indoor_map ?
        `<a target="_blank" href=${store.indoor_map}>${this.props.indoorMapText}</a>` :
        ''

      const infoWindow = new google.maps.InfoWindow({
        content: `<div class="storeLocator-infoWindow">
            <div class="storeLocator-infoWindow-title">${store.name}</div>
            <div class="storeLocator-infoWindow-address">${store.address}, ${store.city}</div>
            ${store.indoor_map ? `<div class="storeLocator-infoWindow-indoorMapLink">${indoorMapLink}</div>` : ''}
          </div>`
      });

      marker.addListener('click', () => {
        if (this.infoWindow) {
          this.infoWindow.close();
        }
        let zoom = this.map.getZoom();
        let center = this.map.getCenter().toJSON();

        if (!this.equalPoints(center, store.location)) {
          this.map.panTo(store.location);
        }

        if (zoom < REGULAR_MARKER_TARGET_ZOOM) {
          this.map.setZoom(REGULAR_MARKER_TARGET_ZOOM);
          if (!this.equalPoints(center, store.location)) {
            this.map.panTo(store.location);
          }
          // this.calculateDistance(this.state.searchLocation);
        } else {
          infoWindow.open(this.map, marker);
          this.infoWindow = infoWindow;
        }
        this.setState({ activeStoreId: store.id });
      });
    }

    this.markers.push(marker);

    return marker;
  };

  equalPoints(p1, p2) {
    let lat1 = parseFloat(p1.lat).toFixed(2);
    let lat2 = parseFloat(p2.lat).toFixed(2);
    let lng1 = parseFloat(p1.lng).toFixed(2);
    let lng2 = parseFloat(p2.lng).toFixed(2);
    // console.log(`${lat1}, ${lng1} | ${lat2}, ${lng2}`)
    return lat1 == lat2 && lng1 == lng2;
  }

  async loadDistanceData(searchLocation) {
    // const stores = await this.loadStores(searchLocation);
    const stores = this.state.stores;
    const data = await promiseMap(stores, async store => {
      const result = await this.getDistance(searchLocation, store.location);
      Object.assign(store, result);
      return store;
    });
    return data.sort((a, b) => a.distance - b.distance);
  }

  // shouldLoadData(location) {
  //   return this.loadProps.center == null || this.loadProps.zoom == null || this.getLastLoadDistance(location) > 10;
  // }

  // /**
  //  * Calculates distance diff between location and last location loaded data 
  //  * 
  //  * @param {{lat, lng}} location 
  //  */
  // getLastLoadDistance(location) {
  //   const origin = new google.maps.LatLng(this.state.center);
  //   const dest = new google.maps.LatLng(location);
  //   return this.getDirectDistance(origin, dest);
  // }

  // saveLoadData() {
  //   this.loadProps.center = this.map.getCenter().toJSON();
  //   this.loadProps.zoom = this.map.getZoom();
  // }

  async calculateDistance(searchLocation) {
    if (!searchLocation) return;

    this.setState({ loading: true })

    // var result;
    // if (this.shouldLoadData(searchLocation)) {
    // result = await this.loadDistanceData(searchLocation);
    // this.saveLoadData();
    // } else {
    // result = this.state.stores;
    // }

    let result = await this.loadDistanceData(searchLocation);

    this.refreshMap(false, result);

    this.setState({ stores: result, loading: false });
  }

  async getDistance(p1, p2) {
    const origin = new google.maps.LatLng(p1);
    const destination = new google.maps.LatLng(p2);
    const directDistance = this.getDirectDistance(origin, destination);

    return Promise.resolve(directDistance)
    // return new Promise(resolve => {
    //   this.distanceService.getDistanceMatrix(
    //     {
    //       origins: [origin],
    //       destinations: [destination],
    //       travelMode: this.props.travelMode,
    //       unitSystem: units[this.props.unitSystem],
    //       durationInTraffic: true,
    //       avoidHighways: false,
    //       avoidTolls: false
    //     },
    //     (response, status) => {
    //       if (status !== 'OK') return resolve(directDistance);
    //       const route = response.rows[0].elements[0];
    //       if (route.status !== 'OK') return resolve(directDistance);
    //       resolve({
    //         distance: route.distance.value,
    //         distanceText: route.distance.text,
    //         durationText: route.duration.text
    //       });
    //     }
    //   );
    // });
  }

  getDirectDistance(origin, destination) {
    // const distance = google.maps.geometry.spherical.computeDistanceBetween(origin, destination) / 1000;
    const distance = this.computeDistanceBetween(origin, destination);
    // console.log('distance', distance.toString());
    if (units[this.props.unitSystem] === 1) {
      return {
        distance: distance / toMiles,
        distanceText: `${(distance / toMiles).toFixed(2)} mi`
      };
    }
    return {
      distance,
      distanceText: `${distance.toFixed(2)} km`
    };
  }

  computeDistanceBetween(origin, dest) {
    this.equalPoints(origin.toJSON(), dest.toJSON());
    if (this.equalPoints(origin.toJSON(), dest.toJSON())) {
      return 0
    }
    else {
      var radlat1 = Math.PI * origin.lat() / 180;
      var radlat2 = Math.PI * dest.lat() / 180;
      var theta = origin.lng() - dest.lng();
      var radtheta = Math.PI * theta / 180;
      var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
      if (dist > 1) {
        dist = 1;
      }
      dist = Math.acos(dist);
      dist = dist * 180 / Math.PI;
      dist = dist * 60 * 1.1515;

      return dist;
    }
  }

  setHomeMarker(location) {
    if (this.homeMarker) {
      this.homeMarker.setMap(null);
    }
    const infoWindow = new google.maps.InfoWindow({
      content: this.props.homeLocationHint
    });
    this.homeMarker = createHtmlMapMarker({
      latlng: new google.maps.LatLng(location.lat, location.lng),
      map: this.map,
      html: '<div class="storeLocator-homeMarker"></div>',
    });
    this.homeMarker.addListener('click', () => {
      if (this.infoWindow) {
        this.infoWindow.close();
      }
      infoWindow.open(this.map, this.homeMarker);
      this.infoWindow = infoWindow;
    });
  }

  setupMap = async () => {
    const { center, zoom } = this.props;
    // console.log('setupMap - center', center)
    // console.log('setupMap - zoom', zoom)
    this.map = new window.google.maps.Map(this.mapFrame, {
      center,
      zoom,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: MAP_STYLES
    });

    // this.distanceService = new google.maps.DistanceMatrixService();

    this.setupAutocomplete();

    const location = await getUserLocation();
    console.log('location', location);

    if (location !== undefined) {
      this.setState({ searchLocation: location });
      this.setHomeMarker(location);
      this.map.setZoom(15)
      this.map.setCenter(location)
    } else {
      this.setHomeMarker(center);
    }

    this.load();
  };

  load() {
    google.maps.event.addListenerOnce(
      this.map,
      "idle",
      () => {
        this.onMoveOrZoom(this.map.getCenter(), this.map.getZoom(), true);
        google.maps.event.addListener(
          this.map,
          "idle",
          () => this.onMoveOrZoom(this.map.getCenter(), this.map.getZoom(), false)
        );
      }
    );
  }

  async onMoveOrZoom(center, zoom, init) {
    // console.log('zoom', zoom)
    // console.log('center', center)

    if (this.isClustered(zoom) && this.isClustered(this.state.zoom) && !init) {
      // console.log('NO LOAD')
      return;
    }
    // console.log('LOAD')

    var nextState = null;

    if (this.state.zoom != zoom) {
      nextState = { zoom: zoom };

      if (this.state.center != center) {
        nextState = { ...nextState, ...{ center: center } }
      }
    } else if (this.state.center != center) {
      nextState = { center: center };
    }

    if (nextState != null) this.setState({ center: center })

    if (this.isClustered(zoom)) {
      this.refreshMap(this.isClustered(zoom), this.state.clusters)
      // } else if (this.shouldLoadData(this.state.searchLocation)) {
    } else {
      await this.fetchAndRefreshStoresInBounds(center);
      this.calculateDistance(this.state.searchLocation);
    }
  }

  async fetchAndRefreshStoresInBounds(center) {
    let data = await this.loadStores(center);
    // await this.calculateDistance(center);
    console.log('data', data)
    this.refreshMap(false, data)
    return Promise.resolve();
  }

  loadStores = async () => {
    let bounds = this.map.getBounds();
    let stores = await this.fetchStoresInBounds(bounds.getNorthEast(), bounds.getSouthWest());
    const data = await promiseMap(stores, this.parseMapPoint);
    this.setState({ stores: data });
    return data;
  }

  parseMapPoint = (store) => {
    store["location"] = { lat: parseFloat(store.lat), lng: parseFloat(store.lng) };
    return store;
  };

  parseMapPoints = (points) => points.map(this.parseMapPoint);

  storesInBoundsSpreadSheetUrl = (encodedQuery) => `https://docs.google.com/spreadsheets/d/${this.props.spreadSheetId}/gviz/tq?sheet=stores&tq=${encodedQuery}&tqx=out:csv&headers=1`

  async fetchStoresInBounds(northEast, southWest) {
    // console.log('fetchStoresInBounds')
    // console.log('NE', northEast)
    // console.log('SW', southWest)
    let encodedQuery = encodeURIComponent(`select * where N > ${southWest.lat()} and N < ${northEast.lat()} and O > ${southWest.lng()} and O < ${northEast.lng()}`);
    let storeResponse = await fetch(this.storesInBoundsSpreadSheetUrl(encodedQuery));
    let storesData = await storeResponse.text();
    let stores = Papa.parse(storesData, { header: true, dynamicTyping: true }).data
    return stores;
  }

  isClustered = (zoom) => zoom < this.props.clusteringMaxZoom;

  refreshMap(clustered, elements) {
    if (this.markerClusterer) this.markerClusterer.clearMarkers();
    this.clearMarkers();

    // console.log('refreshMap', `clustered: ${clustered}`)
    // console.log('elements', elements.length)

    for (var i = 0; i < elements.length; i++) {
      this.addStoreMarker(clustered, elements[i]);
    }

    // console.log('markers', this.markers)

    // this zoom will be set once you tap on markerclusterer
    let maxZoom = this.props.clusterThresholdZoom;
    let size = this.props.clusterSize;

    this.markerClusterer = new MarkerClusterer(this.map, this.markers, {
      maxZoom: maxZoom,
      gridSize: size,
      styles: style,
      clusterClass: 'custom-clustericon',
      calculator: clustered ? this.zoomedOutMarkerClustererCalculator : MarkerClusterer.CALCULATOR
    });
  }

  createRegularMarker = (element) => createHtmlMapMarker({
    latlng: new google.maps.LatLng(element.location.lat, element.location.lng),
    map: this.map,
    html: `<div class="storeLocator-${element.type === "iqos_store" ? 'iqosStoreMarker' : 'regularStoreMarker'}"></div>`,
  });

  createClusteredMarker = (element) => createHtmlMapMarker({
    latlng: new google.maps.LatLng(element.location.lat, element.location.lng),
    count: parseInt(element.reccurance),
    map: this.map,
    html: `<div class="storeLocator-clusterMarker">${element.reccurance.toString()}</div>`,
  });

  // based on MarkerClusterer.CALCULATOR
  zoomedOutMarkerClustererCalculator = (markers, numStyles) => {
    var index = 0;
    var count = markers.length;
    var dv = count;

    // no idea what it does
    while (dv !== 0) {
      dv = parseInt(dv / 10, 10);
      index++;
    }

    index = Math.min(index, numStyles);

    let textCount = markers.reduce((acc, next) => acc + next.count, 0)

    return {
      text: textCount,
      index: index
    };
  }

  setupAutocomplete() {
    const autocomplete = new google.maps.places.Autocomplete(this.input);
    autocomplete.bindTo('bounds', this.map);
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (!place.geometry) return;

      // If the place has a geometry, then present it on a map.
      if (place.geometry.viewport) {
        this.map.fitBounds(place.geometry.viewport);
      } else {
        this.map.setCenter(place.geometry.location);
        this.map.setZoom(11);
      }

      const location = place.geometry.location.toJSON();
      // console.log('test location', location)
      this.setState({ searchLocation: location });
      this.setHomeMarker(location);
      // if (this.shouldLoadData(location)) {
      // this.calculateDistance(location);
      // }
    });
  }

  clearMarkers() {
    this.markers.forEach(m => {
      m.setMap(null);
    });
    this.markers = [];
  }

  onStoreClick({ location, id }) {
    if (!this.equalPoints(location, this.map.getCenter())) {
      this.map.setCenter(location);
    }
    if (this.map.getZoom() < REGULAR_MARKER_TARGET_ZOOM) {
      this.map.setZoom(REGULAR_MARKER_TARGET_ZOOM);
    }
    this.setState({ activeStoreId: id });
  }

  getOpenings(store) {
    return [
      {day: this.props.weekDays[0], time: store.ot_monday},
      {day: this.props.weekDays[1], time: store.ot_tuesday},
      {day: this.props.weekDays[2], time: store.ot_wednesday},
      {day: this.props.weekDays[3], time: store.ot_thursday},
      {day: this.props.weekDays[4], time: store.ot_friday},
      {day: this.props.weekDays[5], time: store.ot_saturday},
      {day: this.props.weekDays[6], time: store.ot_sunda},
    ];
  }

  //noinspection JSCheckFunctionSignatures
  render({ searchHint, travelMode, fullWidthMap, onInfoIconClick }, { activeStoreId, stores }) {
    return (
      <div className={cx(classNames.container, { [classNames.fullWidthMap]: fullWidthMap })}>
        <div className={classNames.searchBox}>
          <div className={classNames.searchInput}>
            <input type="text" ref={input => (this.input = input)} />
            <SearchIcon className={classNames.searchIcon} />
          </div>
          {searchHint && <div className={classNames.searchHint}>{searchHint}</div>}
          <ul className={classNames.storesList}>
            {stores.map(store => {
              if (store === undefined) return
              const locationStr = `${store.lat},${store.lng}`;
              return (
                <li
                  key={store.id}
                  onClick={() => this.onStoreClick(store)}
                  className={cx({
                    [classNames.activeStore]: store.id === activeStoreId,
                    [classNames.iqosStore]: store.type === "iqos_store"
                  })}
                >
                  <div className="storeLocator-infoIcon" onClick={e => onInfoIconClick(e, store)}></div>
                  <h4>{store.name}</h4>
                  <address>{store.address}, {store.city}</address>
                  <div className={classNames.storeActions} onClick={e => e.stopPropagation()}>
                    <a target="_blank" href={`https://www.google.com/maps?daddr=@${locationStr}`}>
                      <span>{this.props.directionsText}</span>
                      {store.distanceText && (
                        <div className={classNames.storeDistance}>
                          {store.distanceText}
                        </div>
                      )}
                    </a>
                  </div>
                  {store.indoor_map && (
                    <div className="storeLocator-indoorMap">
                      <a target="_blank" href={store.indoor_map}>
                        <span>{this.props.indoorMapText}</span>
                      </a>
                    </div>
                  )}
                  <div className="storeLocator-openingTimes">
                    <ul>
                      {this.getOpenings(store).map((d) => (
                        <li>
                          <span>{d.day}:</span>
                          {' '}
                          <span>{d.time || "-"}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        <div className={classNames.map} ref={mapFrame => (this.mapFrame = mapFrame)} />
      </div>
    );
  }
}
