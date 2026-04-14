/**
 * Logistics Map Component
 * Visualizes deliveries, vehicles, and warehouses on an interactive map.
 */

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { HiOutlineTruck, HiOutlineHome, HiOutlineMapPin } from 'react-icons/hi2';
import { renderToString } from 'react-dom/server';

// Fix for default Leaflet icons in Vite/Webpack
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

interface Location {
    lat: number;
    lng: number;
    label?: string;
    type?: 'vehicle' | 'warehouse' | 'delivery';
    status?: string;
    details?: any;
}

interface LogisticsMapProps {
    locations: Location[];
    center?: [number, number];
    zoom?: number;
    showRoutes?: boolean;
    className?: string;
    interactive?: boolean;
}

// Custom Icons using Heroicons
const createCustomIcon = (type: 'vehicle' | 'warehouse' | 'delivery', color: string) => {
    const iconHtml = renderToString(
        <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '50%', 
            padding: '6px', 
            border: `2px solid ${color}`,
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            {type === 'vehicle' && <HiOutlineTruck style={{ color, width: '18px', height: '18px' }} />}
            {type === 'warehouse' && <HiOutlineHome style={{ color, width: '18px', height: '18px' }} />}
            {type === 'delivery' && <HiOutlineMapPin style={{ color, width: '18px', height: '18px' }} />}
        </div>
    );

    return L.divIcon({
        html: iconHtml,
        className: 'custom-map-icon',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
    });
};

const iconColors = {
    vehicle: '#3b82f6', // blue
    warehouse: '#10b981', // green
    delivery: '#f59e0b', // amber
    delivery_completed: '#10b981',
    delivery_pending: '#6b7280'
};

// Component to handle map centering/fitting
function MapUpdater({ locations, center }: { locations: Location[], center?: [number, number] }) {
    const map = useMap();
    
    useEffect(() => {
        if (center) {
            map.setView(center, map.getZoom());
        } else if (locations.length > 0) {
            const bounds = L.latLngBounds(locations.map(loc => [loc.lat, loc.lng]));
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [locations, center, map]);

    return null;
}

export default function LogisticsMap({ 
    locations, 
    center = [-25.9692, 32.5732], // Maputo default
    zoom = 13, 
    showRoutes = false,
    className = "h-[450px] w-full rounded-xl overflow-hidden shadow-inner",
    interactive = true
}: LogisticsMapProps) {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) return <div className={className} style={{ background: '#f3f4f6' }} />;

    return (
        <div className={className}>
            <MapContainer 
                center={center} 
                zoom={zoom} 
                scrollWheelZoom={interactive}
                style={{ height: '100%', width: '100%' }}
                zoomControl={interactive}
                dragging={interactive}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {locations.map((loc, idx) => {
                    const color = loc.type === 'delivery' && loc.status === 'delivered' 
                        ? iconColors.delivery_completed 
                        : iconColors[loc.type || 'delivery'];
                    
                    return (
                        <Marker 
                            key={`${loc.lat}-${loc.lng}-${idx}`} 
                            position={[loc.lat, loc.lng]}
                            icon={createCustomIcon(loc.type || 'delivery', color)}
                        >
                            <Popup>
                                <div className="p-1">
                                    <h4 className="font-bold text-sm border-b mb-1 pb-1">{loc.label || 'Localização'}</h4>
                                    {loc.status && (
                                        <p className="text-xs mb-1">
                                            <span className="text-gray-500 font-medium">Status: </span>
                                            <span className="capitalize">{loc.status.replace('_', ' ')}</span>
                                        </p>
                                    )}
                                    {loc.details && (
                                        <div className="text-xs text-gray-600">
                                            {Object.entries(loc.details).map(([k, v]) => (
                                                <p key={k}><span className="font-medium text-gray-500">{k}:</span> {String(v)}</p>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}

                {showRoutes && locations.length > 1 && (
                    <Polyline 
                        positions={locations.map(loc => [loc.lat, loc.lng])} 
                        color="#3b82f6" 
                        weight={3} 
                        opacity={0.6}
                        dashArray="10, 10"
                    />
                )}

                <MapUpdater locations={locations} center={center} />
            </MapContainer>
        </div>
    );
}
