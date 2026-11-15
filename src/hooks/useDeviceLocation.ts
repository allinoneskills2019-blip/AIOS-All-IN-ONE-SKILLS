import { useCallback, useMemo, useState } from 'react';
import {
  findNearestMumbaiZone,
  getZoneCoords,
  haversineDistanceKm,
  MUMBAI_CENTER,
  type LatLng,
} from '../lib/geo';

export type GeolocationStatus = 'idle' | 'locating' | 'active' | 'error';

export interface DeviceLocationState {
  status: GeolocationStatus;
  rawCoords: (LatLng & { accuracy?: number }) | null;
  activeOriginCoords: LatLng | null;
  activeOriginLabel: string | null;
  nearestZone: { zoneName: string; distanceKm: number; coords: LatLng } | null;
  isOutsideMumbai: boolean;
  distanceToMumbaiKm: number | null;
  usingMumbaiAnchor: boolean;
  isPermissionDenied: boolean;
  isManualZone: boolean;
  errorMessage: string | null;
  requestLocation: () => void;
  selectFallbackZone: (zoneName: string) => void;
  setUseMumbaiAnchor: (anchor: boolean) => void;
  clearLocation: () => void;
}

const OUTSIDE_MUMBAI_THRESHOLD_KM = 55;

export function useDeviceLocation(availableZoneNames: string[] = []): DeviceLocationState {
  const [status, setStatus] = useState<GeolocationStatus>('idle');
  const [rawCoords, setRawCoords] = useState<(LatLng & { accuracy?: number }) | null>(null);
  const [usingMumbaiAnchor, setUsingMumbaiAnchor] = useState(false);
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);
  const [manualZoneName, setManualZoneName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const nearestZone = useMemo(() => {
    if (manualZoneName) {
      const c = getZoneCoords(manualZoneName);
      if (c) return { zoneName: manualZoneName, distanceKm: 0, coords: c };
    }
    if (!rawCoords) return null;
    return findNearestMumbaiZone(rawCoords, availableZoneNames);
  }, [rawCoords, availableZoneNames, manualZoneName]);

  const distanceToMumbaiKm = useMemo(() => {
    if (!rawCoords) return null;
    return haversineDistanceKm(rawCoords, MUMBAI_CENTER);
  }, [rawCoords]);

  const isOutsideMumbai =
    !manualZoneName &&
    distanceToMumbaiKm !== null &&
    distanceToMumbaiKm > OUTSIDE_MUMBAI_THRESHOLD_KM;

  const activeOriginCoords = useMemo<LatLng | null>(() => {
    if (status !== 'active' || !rawCoords) return null;
    if ((usingMumbaiAnchor || manualZoneName) && nearestZone) {
      return nearestZone.coords;
    }
    return { lat: rawCoords.lat, lng: rawCoords.lng };
  }, [status, rawCoords, usingMumbaiAnchor, manualZoneName, nearestZone]);

  const activeOriginLabel = useMemo(() => {
    if (status !== 'active' || !nearestZone) return null;
    if (manualZoneName) {
      return `${manualZoneName} (Selected Mumbai zone)`;
    }
    if (usingMumbaiAnchor) {
      return `${nearestZone.zoneName} (Mumbai anchor)`;
    }
    return isOutsideMumbai
      ? `Device GPS (${nearestZone.zoneName} nearest)`
      : `Your Location (Near ${nearestZone.zoneName})`;
  }, [status, nearestZone, usingMumbaiAnchor, manualZoneName, isOutsideMumbai]);

  const selectFallbackZone = useCallback((zoneName: string) => {
    const coords = getZoneCoords(zoneName) || MUMBAI_CENTER;
    setManualZoneName(zoneName);
    setRawCoords({ lat: coords.lat, lng: coords.lng });
    setUsingMumbaiAnchor(true);
    setIsPermissionDenied(false);
    setStatus('active');
    setErrorMessage(null);
  }, []);

  const requestLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setStatus('error');
      setErrorMessage(
        'Geolocation is unavailable in this browser. Pick your Mumbai locality below as a fallback.'
      );
      return;
    }

    setStatus('locating');
    setErrorMessage(null);
    setIsPermissionDenied(false);
    setManualZoneName(null);

    const applySuccess = (pos: GeolocationPosition) => {
      setRawCoords({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      });
      setUsingMumbaiAnchor(false);
      setIsPermissionDenied(false);
      setStatus('active');
      setErrorMessage(null);
    };

    const applyFailure = (err: GeolocationPositionError) => {
      setStatus('error');
      if (err.code === err.PERMISSION_DENIED) {
        setIsPermissionDenied(true);
        setErrorMessage(
          'Location permission was denied. Enable browser location access or choose a Mumbai zone below to measure distances.'
        );
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        setErrorMessage(
          'Device GPS signal is unavailable indoors or in this webview. Choose your Mumbai zone below to filter nearby technicians.'
        );
      } else if (err.code === err.TIMEOUT) {
        setErrorMessage(
          'GPS fix timed out after high- and standard-accuracy attempts. Choose your Mumbai zone below for instant matching.'
        );
      } else {
        setErrorMessage('Could not determine device location. Choose your Mumbai zone below.');
      }
    };

    // Pass 1: High accuracy (6s). On TIMEOUT or POSITION_UNAVAILABLE, cascade automatically to network/coarse GPS.
    navigator.geolocation.getCurrentPosition(
      applySuccess,
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          applyFailure(err);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          applySuccess,
          applyFailure,
          {
            enableHighAccuracy: false,
            timeout: 12000,
            maximumAge: 300000,
          }
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 60000,
      }
    );
  }, []);

  const clearLocation = useCallback(() => {
    setStatus('idle');
    setRawCoords(null);
    setUsingMumbaiAnchor(false);
    setIsPermissionDenied(false);
    setManualZoneName(null);
    setErrorMessage(null);
  }, []);

  return {
    status,
    rawCoords,
    activeOriginCoords,
    activeOriginLabel,
    nearestZone,
    isOutsideMumbai,
    distanceToMumbaiKm,
    usingMumbaiAnchor,
    isPermissionDenied,
    isManualZone: Boolean(manualZoneName),
    errorMessage,
    requestLocation,
    selectFallbackZone,
    setUseMumbaiAnchor: setUsingMumbaiAnchor,
    clearLocation,
  };
}
