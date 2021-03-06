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

const style = [{
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

const MAP_STYLES = [{
        "elementType": "geometry",
        "stylers": [{
            "color": "#f5f5f5"
        }]
    },
    {
        "elementType": "labels.icon",
        "stylers": [{
            "visibility": "on"
        }]
    },
    {
        "elementType": "labels.text.fill",
        "stylers": [{
            "color": "#616161"
        }]
    },
    {
        "elementType": "labels.text.stroke",
        "stylers": [{
            "color": "#f5f5f5"
        }]
    },
    {
        "featureType": "administrative.country",
        "elementType": "geometry.stroke",
        "stylers": [{
                "color": "#423d36"
            },
            {
                "visibility": "on"
            }
        ]
    },
    {
        "featureType": "administrative.land_parcel",
        "stylers": [{
            "visibility": "on"
        }]
    },
    {
        "featureType": "administrative.land_parcel",
        "elementType": "labels.text.fill",
        "stylers": [{
            "color": "#bdbdbd"
        }]
    },
    {
        "featureType": "administrative.locality",
        "stylers": [{
            "visibility": "on"
        }]
    },
    {
        "featureType": "administrative.neighborhood",
        "stylers": [{
            "visibility": "on"
        }]
    },
    {
        "featureType": "administrative.province",
        "stylers": [{
            "visibility": "on"
        }]
    },
    {
        "featureType": "poi",
        "elementType": "geometry",
        "stylers": [{
            "color": "#eeeeee"
        }]
    },
    {
        "featureType": "poi",
        "elementType": "labels.text.fill",
        "stylers": [{
            "color": "#757575"
        }]
    },
    {
        "featureType": "poi.business",
        "stylers": [{
            "visibility": "off"
        }]
    },
    {
        "featureType": "poi.park",
        "elementType": "geometry",
        "stylers": [{
            "color": "#e5e5e5"
        }]
    },
    {
        "featureType": "poi.park",
        "elementType": "labels.text",
        "stylers": [{
            "visibility": "off"
        }]
    },
    {
        "featureType": "poi.park",
        "elementType": "labels.text.fill",
        "stylers": [{
            "color": "#9e9e9e"
        }]
    },
    {
        "featureType": "road",
        "elementType": "geometry",
        "stylers": [{
            "color": "#ffffff"
        }]
    },
    {
        "featureType": "road.arterial",
        "elementType": "labels.text.fill",
        "stylers": [{
            "color": "#757575"
        }]
    },
    {
        "featureType": "road.highway",
        "elementType": "geometry",
        "stylers": [{
            "color": "#dadada"
        }]
    },
    {
        "featureType": "road.highway",
        "elementType": "labels.text.fill",
        "stylers": [{
            "color": "#616161"
        }]
    },
    {
        "featureType": "road.local",
        "elementType": "labels.text.fill",
        "stylers": [{
            "color": "#9e9e9e"
        }]
    },
    {
        "featureType": "transit.line",
        "elementType": "geometry",
        "stylers": [{
            "color": "#e5e5e5"
        }]
    },
    {
        "featureType": "transit.station",
        "elementType": "geometry",
        "stylers": [{
            "color": "#eeeeee"
        }]
    },
    {
        "featureType": "water",
        "elementType": "geometry",
        "stylers": [{
            "color": "#c9c9c9"
        }]
    },
    {
        "featureType": "water",
        "elementType": "geometry.fill",
        "stylers": [{
            "color": "#9fdcff"
        }]
    },
    {
        "featureType": "water",
        "elementType": "labels.text.fill",
        "stylers": [{
            "color": "#9e9e9e"
        }]
    }
];

const toMiles = 1.609;

const REGULAR_MARKER_TARGET_ZOOM = 18;

const GEOLOCATION_ZOOM = 15;
const IP_LOCATION_ZOOM = 13;

export class StoreLocator extends Component {
    static defaultProps = {
        clusters: [],
        spreadSheetId: null,
        zoom: 2,
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
        language: 'en',
        emptyStoreListText: 'No stores near you'
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
        this.loadedClusters = false;
        this.initGeoLocation = null;
        this.initIpLocation = null;
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
                    this.map.setCenter(store.location);
                    this.map.setZoom(this.map.getZoom() + 2);
                });
            } else {
                let indoorMapLink = store.indoor_map ?
                    `<a target="_blank" href=${store.indoor_map}>${this.props.indoorMapText}</a>` :
                    ''

                const locationStr = `${store.lat},${store.lng}`;

                const infoWindow = new google.maps.InfoWindow({
                            content: `<div class="storeLocator-infoWindow">
            <div class="storeLocator-infoWindow-title">${store.name}</div>
            <div class="storeLocator-infoWindow-address">${store.address}, ${store.city}</div>
            <div class="storeLocator-infoWindow-directions">
              <a target="_blank" href="https://www.google.com/maps?daddr=@${locationStr}">${this.props.directionsText}</a>
            </div>
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
          this.map.setCenter(store.location);
        }

        if (zoom < REGULAR_MARKER_TARGET_ZOOM) {
          this.map.setCenter(store.location);
          this.map.setZoom(REGULAR_MARKER_TARGET_ZOOM);
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

  async calculateDistance(searchLocation) {
    if (!searchLocation) return;

    let result = await this.loadDistanceData(searchLocation);

    this.refreshMap(false, result);

    this.setState({ stores: result });
  }

  async getDistance(p1, p2) {
    const origin = new google.maps.LatLng(p1);
    const destination = new google.maps.LatLng(p2);
    const directDistance = this.getDirectDistance(origin, destination);

    return Promise.resolve(directDistance)
  }

  getDirectDistance(origin, destination) {
    const distance = this.computeDistanceBetween(origin, destination);
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
    this.map = new window.google.maps.Map(this.mapFrame, {
      center,
      zoom,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: MAP_STYLES
    });

    this.setupAutocomplete();
    this.loadLocation();
    this.loadMap();
  };

  async loadLocation() {
    const location = await getUserLocation({ maximumAge: 300000, timeout: 5000 });

    if (location !== undefined) {
      this.setLocationOnMap(location, GEOLOCATION_ZOOM)
    } else {
      this.loadIpLocation();
    }
  }

  async loadIpLocation() {
    try {
      let ipResponse = await fetch('http://ip-api.com/json')
      let json = await ipResponse.json()
      if (json.status == "success") {
        this.setLocationOnMap({ lat: json.lat, lng: json.lon }, IP_LOCATION_ZOOM)
      }
    } catch (error) {
      console.log(error);
    }
  }

  setLocationOnMap(location, zoom = GEOLOCATION_ZOOM) {
    this.setState({ searchLocation: location });
    this.setHomeMarker(location);
    this.map.setZoom(zoom)
    this.map.setCenter(location)
  }

  loadMap() {
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
    console.log(`zoom: ${zoom}`)
    if (this.isClustered(zoom) && this.isClustered(this.state.zoom) && !init) {
      if (!this.loadedClusters) {
        this.refreshMap(true, this.state.clusters)
        this.loadedClusters = true;
        this.setState({ stores: [undefined], loading: false })
      } else {
        this.setState({ loading: false })
      }
      return;
    }
    if (!this.state.loading) {
      this.setState({ loading: true });
    }

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

    nextState = {};
    if (this.isClustered(zoom)) {
      this.refreshMap(true, this.state.clusters)
      this.loadedClusters = true;
      nextState = { stores: [] }
    } else {
      this.loadedClusters = false;
      await this.fetchAndRefreshStoresInBounds(center);
      await this.calculateDistance(this.state.searchLocation);
    }
    if (this.state.loading) {
      nextState = { ...nextState, ...{ loading: false } }
    }
    this.setState(nextState);
  }

  async fetchAndRefreshStoresInBounds(center) {
    let data = await this.loadStores(center);
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
    for (var i = 0; i < elements.length; i++) {
      this.addStoreMarker(clustered, elements[i]);
    }
    let maxZoom = this.props.clusterThresholdZoom;
    let size = this.props.clusterSize;

    this.markerClusterer = new MarkerClusterer(this.map, this.markers, {
      maxZoom: maxZoom,
      gridSize: size,
      styles: style,
      averageCenter: true,
      enableRetinaIcons: true,
      zoomOnClick: false,
      clusterClass: 'custom-clustericon',
      calculator: clustered ? this.zoomedOutMarkerClustererCalculator : MarkerClusterer.CALCULATOR
    });

    google.maps.event.addListener(this.markerClusterer, 'click', (c) => {
      this.map.panTo(c.getCenter());
      this.map.setZoom(this.map.getZoom() + 2);
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
        this.map.setZoom(IP_LOCATION_ZOOM);
      }

      const location = place.geometry.location.toJSON();
      this.setState({ searchLocation: location });
      this.setHomeMarker(location);
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
      { day: this.props.weekDays[0], time: store.ot_monday },
      { day: this.props.weekDays[1], time: store.ot_tuesday },
      { day: this.props.weekDays[2], time: store.ot_wednesday },
      { day: this.props.weekDays[3], time: store.ot_thursday },
      { day: this.props.weekDays[4], time: store.ot_friday },
      { day: this.props.weekDays[5], time: store.ot_saturday },
      { day: this.props.weekDays[6], time: store.ot_sunda },
    ];
  }

  renderStoreListItem(store, activeStoreId, onInfoIconClick) {
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
  }

  renderEmptyStoreList() {
    return (<li>
      <div className={classNames.emptyStoreList}>
        <p>{this.props.emptyStoreListText}</p>
      </div>
    </li>)
  }

  renderLoadingStores(loading) {
    let classes = `${classNames.loadingStores}${loading ? ' loading' : ''}`
    return (<div className={classes}>
      <p>{this.props.loadingStoresText}</p>
    </div>)
  }

  //noinspection JSCheckFunctionSignatures
  render({ searchHint, fullWidthMap, onInfoIconClick }, { activeStoreId, stores, loading }) {
    return (
      <div className={cx(classNames.container, { [classNames.fullWidthMap]: fullWidthMap })}>
        {this.renderLoadingStores(loading)}
        <div className={classNames.searchBox}>
          <div className={classNames.searchInput}>
            <input type="text" ref={input => (this.input = input)} placeholder={this.props.locationText} />
            <SearchIcon className={classNames.searchIcon} />
          </div>
          {searchHint && <div className={classNames.searchHint}>{searchHint}</div>}
          <ul className={classNames.storesList}>
            {stores !== undefined && stores.length > 0 ?
              stores.map(store => this.renderStoreListItem(store, activeStoreId, onInfoIconClick)) :
              this.renderEmptyStoreList()}
          </ul>
        </div>
        <div className={classNames.map} ref={mapFrame => (this.mapFrame = mapFrame)} />
      </div>
    );
  }
}