// client/src/components/common/WorkLocationSelector.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Navigation, Building2, Plus, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';
import api from '../../services/api';

const WorkLocationSelector = ({ token, onSelect, initialLocation, initialRadius = 100 }) => {
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [mode, setMode] = useState('select'); // 'select', 'gps', 'new'
    const [selectedLocation, setSelectedLocation] = useState(initialLocation || null);
    const [newLocationName, setNewLocationName] = useState('');
    const [capturedCoords, setCapturedCoords] = useState(null);
    const [capturing, setCapturing] = useState(false);
    const [radius, setRadius] = useState(initialRadius);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    // Cargar sitios preconfigurados
    const fetchWorkLocations = useCallback(async () => {
        try {
            const response = await api.get('/work-locations', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setLocations(response.data.locations || []);
        } catch (error) {
            console.error('Error cargando sitios:', error);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchWorkLocations();
    }, [fetchWorkLocations]);

    const captureGPS = () => {
        setCapturing(true);
        setError(null);
        
        if (!navigator.geolocation) {
            setError('GPS no disponible en este dispositivo');
            setCapturing(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setCapturedCoords({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp
                });
                setCapturing(false);
                setSuccess(true);
                setTimeout(() => setSuccess(false), 3000);
            },
            (err) => {
                setError('Error al capturar ubicación: ' + err.message);
                setCapturing(false);
            },
            { enableHighAccuracy: true, timeout: 15000 }
        );
    };

    const handleSelectLocation = (location) => {
        setSelectedLocation(location);
        onSelect({
            type: 'saved',
            id: location.id,
            name: location.name,
            latitude: parseFloat(location.latitude),
            longitude: parseFloat(location.longitude),
            radius: radius,
            source: 'saved'
        });
    };

    const handleUseCurrentGPS = () => {
        if (capturedCoords) {
            onSelect({
                type: 'gps',
                name: 'Ubicación capturada en el momento',
                latitude: capturedCoords.latitude,
                longitude: capturedCoords.longitude,
                radius: radius,
                accuracy: capturedCoords.accuracy,
                source: 'gps'
            });
            setSelectedLocation({
                name: 'Ubicación GPS',
                latitude: capturedCoords.latitude,
                longitude: capturedCoords.longitude
            });
            setMode('select');
        }
    };

    const handleCreateNew = async () => {
        if (!newLocationName.trim()) {
            setError('Por favor ingresa un nombre para el sitio');
            return;
        }
        if (!capturedCoords) {
            setError('Por favor captura la ubicación GPS');
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/work-locations', {
                name: newLocationName,
                latitude: capturedCoords.latitude,
                longitude: capturedCoords.longitude,
                default_radius: radius
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                await fetchWorkLocations();
                handleSelectLocation(response.data.location);
                setMode('select');
                setNewLocationName('');
                setCapturedCoords(null);
                setSuccess(true);
                setTimeout(() => setSuccess(false), 3000);
            }
        } catch (error) {
            setError(error.response?.data?.error || 'Error al crear el sitio');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-cyan-600" />
                Ubicación del Trabajo
                {selectedLocation && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full ml-2">
                        {selectedLocation.name}
                    </span>
                )}
            </h3>

            {/* Radio de tolerancia */}
            <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-1">
                    Radio de tolerancia: <span className="font-semibold text-cyan-600">{radius} metros</span>
                </label>
                <input
                    type="range"
                    min="10"
                    max="500"
                    step="10"
                    value={radius}
                    onChange={(e) => {
                        const newRadius = parseInt(e.target.value);
                        setRadius(newRadius);
                        if (selectedLocation) {
                            onSelect({
                                ...selectedLocation,
                                radius: newRadius
                            });
                        }
                    }}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-cyan-600"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>10m (precisión alta)</span>
                    <span>100m (estándar)</span>
                    <span>500m (zona amplia)</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                    ℹ️ La precisión del GPS se suma automáticamente a este radio
                </p>
            </div>

            {/* Selector de modo */}
            <div className="flex gap-2 mb-4">
                <button
                    onClick={() => setMode('select')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                        mode === 'select' 
                            ? 'bg-cyan-600 text-white' 
                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                >
                    <Building2 className="w-4 h-4 inline mr-1" />
                    Sitios guardados
                </button>
                <button
                    onClick={() => setMode('gps')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                        mode === 'gps' 
                            ? 'bg-cyan-600 text-white' 
                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                >
                    <Navigation className="w-4 h-4 inline mr-1" />
                    GPS ahora
                </button>
                <button
                    onClick={() => setMode('new')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                        mode === 'new' 
                            ? 'bg-cyan-600 text-white' 
                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                >
                    <Plus className="w-4 h-4 inline mr-1" />
                    Nuevo sitio
                </button>
            </div>

            {/* Modo: Seleccionar de lista */}
            {mode === 'select' && (
                <div>
                    {loading ? (
                        <div className="text-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-cyan-600 mx-auto" />
                            <p className="text-sm text-gray-500 mt-2">Cargando sitios...</p>
                        </div>
                    ) : locations.length === 0 ? (
                        <div className="text-center py-8 bg-white rounded-lg border">
                            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                            <p className="text-gray-500">No hay sitios configurados</p>
                            <button
                                onClick={() => setMode('new')}
                                className="mt-3 text-cyan-600 hover:underline text-sm"
                            >
                                + Crear primer sitio de trabajo
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {locations.map(loc => (
                                <button
                                    key={loc.id}
                                    onClick={() => handleSelectLocation(loc)}
                                    className={`w-full text-left p-3 rounded-lg border transition ${
                                        selectedLocation?.id === loc.id
                                            ? 'border-cyan-500 bg-cyan-50 ring-1 ring-cyan-500'
                                            : 'border-gray-200 hover:border-cyan-200 hover:bg-cyan-50'
                                    }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-medium text-gray-800">{loc.name}</p>
                                            <p className="text-xs text-gray-500 mt-1 font-mono">
                                                📍 {parseFloat(loc.latitude).toFixed(6)}, {parseFloat(loc.longitude).toFixed(6)}
                                            </p>
                                        </div>
                                        {selectedLocation?.id === loc.id && (
                                            <CheckCircle className="w-5 h-5 text-green-500" />
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Modo: GPS actual */}
            {mode === 'gps' && (
                <div>
                    <button
                        onClick={captureGPS}
                        disabled={capturing}
                        className="w-full bg-cyan-600 text-white py-3 rounded-lg hover:bg-cyan-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {capturing ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Navigation className="w-5 h-5" />
                        )}
                        {capturing ? 'Capturando...' : 'Capturar ubicación actual'}
                    </button>
                    
                    {capturedCoords && (
                        <div className="mt-3 p-3 bg-white rounded-lg border">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm font-mono text-gray-700">
                                        📍 {capturedCoords.latitude.toFixed(6)}, {capturedCoords.longitude.toFixed(6)}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Precisión: ±{Math.round(capturedCoords.accuracy)}m
                                    </p>
                                </div>
                                <CheckCircle className="w-5 h-5 text-green-500" />
                            </div>
                            <button
                                onClick={handleUseCurrentGPS}
                                className="mt-3 w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition"
                            >
                                Usar esta ubicación
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Modo: Crear nuevo sitio */}
            {mode === 'new' && (
                <div className="space-y-3">
                    <input
                        type="text"
                        placeholder="Nombre del sitio (ej: Torre Norte, Tanque T-102)"
                        value={newLocationName}
                        onChange={(e) => setNewLocationName(e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    />
                    <button
                        onClick={captureGPS}
                        disabled={capturing}
                        className="w-full bg-cyan-600 text-white py-2 rounded-lg hover:bg-cyan-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {capturing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Navigation className="w-4 h-4" />
                        )}
                        {capturing ? 'Capturando...' : 'Capturar ubicación GPS'}
                    </button>
                    
                    {capturedCoords && (
                        <div className="p-3 bg-white rounded-lg border">
                            <p className="text-xs font-mono text-gray-600">
                                📍 {capturedCoords.latitude.toFixed(6)}, {capturedCoords.longitude.toFixed(6)}
                            </p>
                            <button
                                onClick={handleCreateNew}
                                disabled={loading}
                                className="mt-2 w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                            >
                                {loading ? 'Guardando...' : 'Guardar nuevo sitio'}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Mensajes de error y éxito */}
            {error && (
                <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                </div>
            )}
            
            {success && (
                <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Operación completada con éxito
                </div>
            )}
        </div>
    );
};

export default WorkLocationSelector;