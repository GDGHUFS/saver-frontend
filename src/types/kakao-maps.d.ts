interface KakaoLatLng {}

interface KakaoLatLngBounds {
  extend(position: KakaoLatLng): void
}

interface KakaoMap {
  setBounds(
    bounds: KakaoLatLngBounds,
    paddingTop?: number,
    paddingRight?: number,
    paddingBottom?: number,
    paddingLeft?: number,
  ): void
}

interface KakaoCustomOverlay {
  setMap(map: KakaoMap | null): void
}

interface KakaoMapsNamespace {
  CustomOverlay: new (options: {
    clickable?: boolean
    content: Node | string
    map?: KakaoMap
    position: KakaoLatLng
    xAnchor?: number
    yAnchor?: number
    zIndex?: number
  }) => KakaoCustomOverlay
  LatLng: new (latitude: number, longitude: number) => KakaoLatLng
  LatLngBounds: new () => KakaoLatLngBounds
  Map: new (
    container: HTMLElement,
    options: {
      center: KakaoLatLng
      disableDoubleClick?: boolean
      disableDoubleClickZoom?: boolean
      draggable?: boolean
      keyboardShortcuts?: boolean
      level?: number
      scrollwheel?: boolean
      tileAnimation?: boolean
    },
  ) => KakaoMap
  event: {
    addListener(target: KakaoMap, type: 'tilesloaded', handler: () => void): void
    removeListener(target: KakaoMap, type: 'tilesloaded', handler: () => void): void
  }
  load(callback: () => void): void
}

interface KakaoNamespace {
  maps: KakaoMapsNamespace
}

interface Window {
  kakao?: KakaoNamespace
}
