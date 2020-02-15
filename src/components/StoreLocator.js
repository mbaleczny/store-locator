import promiseMap from 'p-map';
import cx from 'classnames';
import {getUserLocation, loadScript} from 'lib/utils';
import {Component} from 'preact';
import DirectionIcon from './DirectionIcon';
import SearchIcon from './SearchIcon';
import classNames from './StoreLocator.css';
import WebIcon from './WebIcon';
import MarkerClusterer from '@google/markerclustererplus';

const travelModes = {
  DRIVING: 'car',
  WALKING: 'walk'
};

const units = {
  METRIC: 0,
  IMPERIAL: 1
};

const styles = [
  [
    MarkerClusterer.withDefaultStyle({
      width: 35,
      height: 35,
      url: "../images/people35.png",
      textColor: "#ff00ff",
      textSize: 10
    }),
    MarkerClusterer.withDefaultStyle({
      width: 45,
      height: 45,
      url: "../images/people45.png",
      textColor: "#ff0000",
      textSize: 11,
    }),
    MarkerClusterer.withDefaultStyle({
      width: 55,
      height: 55,
      url: "../images/people55.png",
      textColor: "#ffffff",
      textSize: 12,
    }),
  ],
  [
    MarkerClusterer.withDefaultStyle({
      url: '../images/conv30.png',
      width: 30,
      height: 27,
      anchorText: [-3, 0],
      anchorIcon: [27, 28],
      textColor: '#ff00ff',
      textSize: 10,
    }),
    MarkerClusterer.withDefaultStyle({
      url: '../images/conv40.png',
      width: 40,
      height: 36,
      anchorText: [-4, 0],
      anchorIcon: [36, 37],
      textColor: '#ff0000',
      textSize: 11,
    }),
    MarkerClusterer.withDefaultStyle({
      url: '../images/conv50.png',
      width: 50,
      height: 45,
      anchorText: [-5, 0],
      anchorIcon: [45, 46],
      textColor: '#0000ff',
      textSize: 12,
    }),
  ],
  [
    MarkerClusterer.withDefaultStyle({
      url: '../images/heart30.png',
      width: 30,
      height: 26,
      anchorIcon: [26, 15],
      textColor: '#ff00ff',
      textSize: 10,
    }),
    MarkerClusterer.withDefaultStyle({
      url: '../images/heart40.png',
      width: 40,
      height: 35,
      anchorIcon: [35, 20],
      textColor: '#ff0000',
      textSize: 11,
    }),
    MarkerClusterer.withDefaultStyle({
      url: '../images/heart50.png',
      width: 50,
      height: 44,
      anchorIcon: [44, 25],
      textSize: 12,
    }),
  ],
  [
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
  ],
];

const toMiles = 1.609;

export class StoreLocator extends Component {
  static defaultProps = {
    stores: [],
    zoom: 6,
    limit: 10,
    center: {lat: 39.6433995, lng: -6.4396778},
    travelMode: 'DRIVING',
    homeLocationHint: 'Current location',
    homeMarkerIcon: 'http://maps.google.com/mapfiles/kml/pushpin/grn-pushpin.png',
    storeMarkerIcon: 'http://maps.google.com/mapfiles/kml/pushpin/red-pushpin.png',
    unitSystem: 'METRIC',
    farAwayMarkerOpacity: 0.6,
    fullWidthMap: false
  };

  constructor(props) {
    super(props);
    this.state = {
      searchLocation: null,
      activeStoreId: null,
      stores: this.addStoreIds(props.stores)
    };
    this.markers = [];
    this.markerClusterer = null;
  }

  addStoreIds(stores = []) {
    return stores.map((store, i) => {
      store.id = store.id || i;
      return store;
    });
  }

  async loadGoogleMaps() {
    if (window.google && window.google.maps) return Promise.resolve();
    return loadScript(
      `https://maps.googleapis.com/maps/api/js?v=3&key=${this.props.apiKey}&libraries=geometry,places`
    );
  }

  loadStores = async searchLocation => {
    console.log('loadStores', searchLocation)
    if (!this.props.loadStores) return this.state.stores;
    let stores = await this.props.loadStores(searchLocation);
    stores = this.addStoreIds(stores);
    this.setState({stores});
    return stores;
  };

  getMarkerIcon(icon) {
    if (!icon) return null;
    const {markerIconSize} = this.props;
    if (typeof icon === 'string' && markerIconSize) {
      const iconSize = markerIconSize;
      return {
        url: icon,
        scaledSize: new google.maps.Size(iconSize[0], iconSize[1])
      };
    }
    return icon;
  }

  addStoreMarker = store => {
    const infoWindow = new google.maps.InfoWindow({
      content: `<div class="${classNames.infoWindow}">
          <h4>${store.name}</h4>
          ${store.address}
        </div>`
    });
    const marker = new google.maps.Marker({
      position: store.location,
      title: store.name,
      map: this.map,
      icon: this.getMarkerIcon(this.props.storeMarkerIcon)
    });
    marker.addListener('click', () => {
      if (this.infoWindow) {
        this.infoWindow.close();
      }
      infoWindow.open(this.map, marker);
      this.infoWindow = infoWindow;
      this.setState({activeStoreId: store.id});
    });
    this.markers.push(marker);
    return marker;
  };

  async getDistance(p1, p2) {
    const origin = new google.maps.LatLng(p1);
    const destination = new google.maps.LatLng(p2);
    const directDistance = this.getDirectDistance(origin, destination);
    return new Promise(resolve => {
      this.distanceService.getDistanceMatrix(
        {
          origins: [origin],
          destinations: [destination],
          travelMode: this.props.travelMode,
          unitSystem: units[this.props.unitSystem],
          durationInTraffic: true,
          avoidHighways: false,
          avoidTolls: false
        },
        (response, status) => {
          if (status !== 'OK') return resolve(directDistance);
          const route = response.rows[0].elements[0];
          if (route.status !== 'OK') return resolve(directDistance);
          resolve({
            distance: route.distance.value,
            distanceText: route.distance.text,
            durationText: route.duration.text
          });
        }
      );
    });
  }

  getDirectDistance(origin, destination) {
    const distance =
      google.maps.geometry.spherical.computeDistanceBetween(origin, destination) / 1000;
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

  setHomeMarker(location) {
    if (this.homeMarker) {
      this.homeMarker.setMap(null);
    }
    const infoWindow = new google.maps.InfoWindow({
      content: this.props.homeLocationHint
    });
    this.homeMarker = new google.maps.Marker({
      position: location,
      title: this.props.homeLocationHint,
      map: this.map,
      icon: this.getMarkerIcon(this.props.homeMarkerIcon)
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
    const {center, zoom} = this.props;
    this.map = new window.google.maps.Map(this.mapFrame, {
      center,
      zoom,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false
    });
    // this.distanceService = new google.maps.DistanceMatrixService();
    // const geocoder = new google.maps.Geocoder();
    this.setupAutocomplete();
    // this.state.stores.map(this.addStoreMarker);

    this.refreshMap();

    const location = await getUserLocation();
    this.setState({searchLocation: location});
    // this.calculateDistance(location);
    // this.map.setCenter(location);
    this.map.setZoom(11);
    // this.setHomeMarker(location);

    // geocoder.geocode({location: location}, (results, status) => {
    //   if (status === 'OK') {
    //     if (results[0]) {
    //       this.input.value = results[0].formatted_address;
    //     }
    //   }
    // });
  };

  refreshMap() {
    if (this.markerClusterer) {
      this.markerClusterer.clearMarkers();
    }

    let stores = this.state.stores;
    var markers = [];
    
    for (var i = 0; i < stores.length; ++i) {
      var marker = new google.maps.Marker({
        position: stores[i].location,
        title: stores[i].name,
        map: this.map,
        icon: this.getMarkerIcon(this.props.storeMarkerIcon)
      });
      markers.push(marker);
    }

    // var zoom = parseInt(document.getElementById("zoom").value, 10);
    // var size = parseInt(document.getElementById("size").value, 10);
    // var style = parseInt(document.getElementById("style").value, 10);
    // zoom = zoom == -1 ? null : zoom;
    // size = size == -1 ? null : size;
    // style = style == -1 ? null : style;
    let zoom = 16;
    let size = null;
    let style = 3;

    console.log('markers', markers)

    this.markerClusterer = new MarkerClusterer(this.map, markers, {
      maxZoom: zoom,
      gridSize: size,
      styles: styles[style],
      clusterClass: style === 3 ? 'custom-clustericon' : undefined
    });
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
        // this.map.setZoom(11);
      }
      const location = place.geometry.location.toJSON();
      this.setState({searchLocation: location});
      this.setHomeMarker(location);
      // this.calculateDistance(location);
    });
  }

  clearMarkers() {
    this.markers.forEach(m => {
      m.setMap(null);
    });
    this.markers = [];
  }

  async calculateDistance(searchLocation) {
    const {limit} = this.props;
    if (!searchLocation) return this.props.stores;
    const stores = await this.loadStores(searchLocation);
    const data = await promiseMap(stores, store => {
      return this.getDistance(searchLocation, store.location).then(result => {
        Object.assign(store, result);
        return store;
      });
    });
    let result = data.sort((a, b) => a.distance - b.distance);
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(searchLocation);
    this.clearMarkers();
    result = result.map((store, i) => {
      store.hidden = i + 1 > limit;
      const marker = this.addStoreMarker(store);
      if (store.hidden) {
        marker.setOpacity(this.props.farAwayMarkerOpacity);
      } else {
        bounds.extend(store.location);
      }
      return store;
    });
    this.map.fitBounds(bounds);
    this.map.setCenter(bounds.getCenter(), this.map.getZoom() - 1);
    this.setState({stores: result});
  }

  componentDidMount() {
    this.loadGoogleMaps()
      .then(this.loadStores)
      .then(this.setupMap);
  }

  onStoreClick({location, id}) {
    this.map.setCenter(location);
    // this.map.setZoom(16);
    this.setState({activeStoreId: id});
  }

  //noinspection JSCheckFunctionSignatures
  render({searchHint, travelMode, fullWidthMap}, {activeStoreId, stores}) {
    return (
      <div className={cx(classNames.container, {[classNames.fullWidthMap]: fullWidthMap})}>
        <div className={classNames.searchBox}>
          <div className={classNames.searchInput}>
            <input type="text" ref={input => (this.input = input)} />
            <SearchIcon className={classNames.searchIcon} />
          </div>
          {searchHint && <div className={classNames.searchHint}>{searchHint}</div>}
          <ul className={classNames.storesList}>
            {stores.map(store => {
              if(store === undefined) return
              const locationStr = `${store.lat},${store.lng}`;
              return (
                <li
                  key={store.id}
                  onClick={() => this.onStoreClick(store)}
                  className={cx({
                    [classNames.activeStore]: store.id === activeStoreId,
                    [classNames.hiddenStore]: store.hidden
                  })}
                >
                  <h4>{store.name}</h4>
                  {store.distanceText && (
                    <div className={classNames.storeDistance}>
                      {store.distanceText} away{' '}
                      {store.durationText &&
                        `(${store.durationText} by ${travelModes[travelMode]})`}
                    </div>
                  )}
                  <address>{store.address}</address>
                  <div className={classNames.storeActions} onClick={e => e.stopPropagation()}>
                    <a target="_blank" href={`https://www.google.com/maps?daddr=@${locationStr}`}>
                      <DirectionIcon />
                      directions
                    </a>{' '}
                    {store.website && (
                      <a target="_blank" href={store.website}>
                        <WebIcon />
                        website
                      </a>
                    )}
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
