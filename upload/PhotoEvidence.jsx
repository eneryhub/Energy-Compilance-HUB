import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

const PhotoEvidence = ({ onPhotoCaptured, required = true, permitId, maxPhotos = 3 }) => {
    const [photos, setPhotos] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [showCamera, setShowCamera] = useState(false);
    const [stream, setStream] = useState(null);
    const fileInputRef = useRef(null);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    // Detener cámara al desmontar
    useEffect(() => {
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [stream]);

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } 
            });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
            setShowCamera(true);
            setError(null);
        } catch (err) {
            setError('No se pudo acceder a la cámara. Verifica los permisos.');
            console.error(err);
        }
    };

    const takePicture = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        if (video && canvas) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            const photoData = canvas.toDataURL('image/jpeg', 0.8);
            handlePhotoCapture(photoData);
            stopCamera();
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        setShowCamera(false);
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
            setError('Solo se permiten imágenes');
            return;
        }
        
        if (file.size > 5 * 1024 * 1024) {
            setError('La imagen no debe exceder 5MB');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            handlePhotoCapture(e.target.result, file);
        };
        reader.readAsDataURL(file);
    };

    const handlePhotoCapture = async (photoData, file = null) => {
        setUploading(true);
        setError(null);
        
        try {
            const photoObject = {
                id: Date.now(),
                data: photoData,
                filename: file?.name || `photo_${Date.now()}.jpg`,
                timestamp: new Date().toISOString(),
                permitId
            };
            
            setPhotos([...photos, photoObject]);
            
            if (onPhotoCaptured) {
                onPhotoCaptured(photoObject);
            }
            
        } catch (err) {
            setError('Error al procesar la foto: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    const removePhoto = (photoId) => {
        setPhotos(photos.filter(p => p.id !== photoId));
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <Camera className="w-5 h-5 text-purple-600" />
                    Evidencia Fotográfica
                    {required && <span className="text-red-500 text-sm">*Obligatorio</span>}
                </h3>
                <span className="text-sm text-gray-500">
                    {photos.length}/{maxPhotos} fotos
                </span>
            </div>
            
            {/* Galería de fotos */}
            <div className="grid grid-cols-3 gap-3">
                {photos.map(photo => (
                    <div key={photo.id} className="relative group">
                        <img
                            src={photo.data}
                            alt="Evidencia"
                            className="w-full h-28 object-cover rounded-lg border-2 border-gray-200"
                        />
                        <button
                            onClick={() => removePhoto(photo.id)}
                            className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                ))}
                
                {photos.length < maxPhotos && !showCamera && (
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={startCamera}
                            className="border-2 border-dashed border-gray-300 rounded-lg h-28 flex flex-col items-center justify-center hover:border-purple-400 transition-colors"
                        >
                            <Camera className="w-6 h-6 text-gray-400" />
                            <span className="text-xs text-gray-500 mt-1">Tomar foto</span>
                        </button>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-gray-300 rounded-lg py-2 flex items-center justify-center gap-2 hover:border-purple-400 transition-colors"
                        >
                            <Upload className="w-4 h-4 text-gray-400" />
                            <span className="text-xs text-gray-500">Subir</span>
                        </button>
                    </div>
                )}
            </div>
            
            {/* Cámara en vivo */}
            {showCamera && (
                <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl max-w-lg w-full overflow-hidden">
                        <div className="p-4 border-b border-gray-200">
                            <h3 className="font-bold">Tomar Foto de Evidencia</h3>
                        </div>
                        <div className="p-4">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                className="w-full rounded-lg"
                            />
                            <canvas ref={canvasRef} style={{ display: 'none' }} />
                        </div>
                        <div className="p-4 flex gap-2">
                            <button
                                onClick={takePicture}
                                className="flex-1 bg-purple-600 text-white py-3 rounded-lg font-medium"
                            >
                                Capturar
                            </button>
                            <button
                                onClick={stopCamera}
                                className="flex-1 border border-gray-300 py-3 rounded-lg font-medium"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                </div>
            )}
            
            {uploading && (
                <div className="flex items-center justify-center gap-2 text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Subiendo foto...</span>
                </div>
            )}
            
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
            />
            
            {required && photos.length === 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-yellow-800 text-sm">
                    ⚠️ Es obligatorio adjuntar al menos 1 foto como evidencia del trabajo
                </div>
            )}
            
            {photos.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-800 text-sm flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    {photos.length} foto(s) adjuntada(s) como evidencia
                </div>
            )}
        </div>
    );
};

export default PhotoEvidence;