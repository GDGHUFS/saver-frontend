import { ref, type Ref } from 'vue'

export interface CurrentCoordinates {
  latitude: number
  longitude: number
}

export type CurrentLocationStatus =
  | 'checking'
  | 'denied'
  | 'error'
  | 'idle'
  | 'requesting'
  | 'success'
  | 'unavailable'

export interface CurrentLocationState {
  coordinates: Ref<CurrentCoordinates | null>
  errorMessage: Ref<string>
  requestCurrentLocation: () => Promise<CurrentCoordinates | null>
  status: Ref<CurrentLocationStatus>
  useGrantedLocation: () => Promise<CurrentCoordinates | null>
}

function geolocationErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return '위치 권한이 허용되지 않았습니다. 브라우저 설정에서 권한을 변경할 수 있습니다.'
    case error.POSITION_UNAVAILABLE:
      return '현재 위치를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.'
    case error.TIMEOUT:
      return '현재 위치를 확인하는 데 시간이 오래 걸리고 있습니다. 다시 시도해 주세요.'
    default:
      return '현재 위치를 가져오지 못했습니다.'
  }
}

export function useCurrentLocation(): CurrentLocationState {
  const coordinates = ref<CurrentCoordinates | null>(null)
  const errorMessage = ref('')
  const status = ref<CurrentLocationStatus>('idle')

  function getCurrentPosition(): Promise<CurrentCoordinates | null> {
    if (typeof navigator === 'undefined' || navigator.geolocation === undefined) {
      status.value = 'unavailable'
      errorMessage.value = '이 브라우저에서는 현재 위치 기능을 사용할 수 없습니다.'
      return Promise.resolve(null)
    }

    status.value = 'requesting'
    errorMessage.value = ''
    return new Promise((resolve) => {
      try {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const current = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            }
            coordinates.value = current
            status.value = 'success'
            resolve(current)
          },
          (error) => {
            coordinates.value = null
            status.value = error.code === error.PERMISSION_DENIED ? 'denied' : 'error'
            errorMessage.value = geolocationErrorMessage(error)
            resolve(null)
          },
          {
            enableHighAccuracy: false,
            maximumAge: 5 * 60 * 1_000,
            timeout: 10_000,
          },
        )
      } catch {
        coordinates.value = null
        status.value = 'error'
        errorMessage.value = '현재 위치 기능을 시작하지 못했습니다.'
        resolve(null)
      }
    })
  }

  async function useGrantedLocation(): Promise<CurrentCoordinates | null> {
    if (typeof navigator === 'undefined' || navigator.geolocation === undefined) {
      status.value = 'unavailable'
      return null
    }
    if (navigator.permissions === undefined) {
      status.value = 'idle'
      return null
    }

    status.value = 'checking'
    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' })
      if (permission.state === 'granted') {
        return getCurrentPosition()
      }
      status.value = permission.state === 'denied' ? 'denied' : 'idle'
      return null
    } catch {
      status.value = 'idle'
      return null
    }
  }

  return {
    coordinates,
    errorMessage,
    requestCurrentLocation: getCurrentPosition,
    status,
    useGrantedLocation,
  }
}
