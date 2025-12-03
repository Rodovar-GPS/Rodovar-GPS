import React, { useState, useCallback, useEffect, useRef } from 'react';
import { fetchTrackingInfo } from './services/geminiService';
import { TrackingData, TrackingStatus, Coordinates, UserAddress, StatusLabels } from './types';
import { TruckIcon, SearchIcon, MapPinIcon, WhatsAppIcon, SteeringWheelIcon } from './components/Icons';
import MapVisualization from './components/MapVisualization';
import AdminPanel from './components/AdminPanel';
import LoginPanel from './components/LoginPanel';
import DriverPanel from './components/DriverPanel';
import { getDistanceFromLatLonInKm, populateDemoData } from './services/storageService';

type AppView = 'tracking' | 'login' | 'admin' | 'driver';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>('tracking');
  const [adminUser, setAdminUser] = useState<string>(''); // Store logged in admin username
  
  // Tracking States
  const [trackingCode, setTrackingCode] = useState('');
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingDistance, setRemainingDistance] = useState<number | null>(null);
  
  // Live Tracking Polling Ref
  const pollingIntervalRef = useRef<number | null>(null);

  // Location States
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [userAddress, setUserAddress] = useState<UserAddress | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);

  // INIT DEMO DATA
  useEffect(() => {
      // Cria dados de exemplo (Usuário Jairo, Motoristas, Rotas) se não existirem
      populateDemoData();
  }, []);

  // Get User Location and Reverse Geocode
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          
          setUserLocation({ lat, lng });

          // Reverse Geocoding using OpenStreetMap Nominatim API
          try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
            );
            const data = await response.json();
            
            if (data && data.address) {
                setUserAddress({
                    road: data.address.road || 'Rua não identificada',
                    neighborhood: data.address.suburb || data.address.neighbourhood || '',
                    city: data.address.city || data.address.town || data.address.village || data.address.municipality || '',
                    state: data.address.state || '',
                    country: data.address.country || '',
                    formatted: data.display_name
                });
            }
          } catch (err) {
            console.error("Erro ao buscar endereço:", err);
          } finally {
            setLocationLoading(false);
          }
        },
        (err) => {
          console.warn("Permissão de localização negada ou erro no GPS:", err);
          setLocationLoading(false);
          setError("Ative o GPS para ver sua localização exata no mapa.");
        },
        { enableHighAccuracy: true }
      );
    } else {
        setLocationLoading(false);
    }
  }, []);

  // Polling Effect for Live Tracking
  useEffect(() => {
      // Clear interval if no data or not live
      if (!trackingData || !trackingData.isLive || trackingData.status === TrackingStatus.DELIVERED) {
          if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
          }
          return;
      }

      // Start polling if live
      if (!pollingIntervalRef.current) {
          pollingIntervalRef.current = window.setInterval(async () => {
               try {
                   // Silent refetch
                   const updated = await fetchTrackingInfo(trackingData.code);
                   setTrackingData(updated);
                   
                   // Update dist calc
                   if (updated.currentLocation.coordinates && updated.destinationCoordinates && 
                    (updated.destinationCoordinates.lat !== 0 || updated.destinationCoordinates.lng !== 0)) {
                        const dist = getDistanceFromLatLonInKm(
                            updated.currentLocation.coordinates.lat,
                            updated.currentLocation.coordinates.lng,
                            updated.destinationCoordinates.lat,
                            updated.destinationCoordinates.lng
                        );
                        setRemainingDistance(Math.round(dist));
                   }

               } catch (e) {
                   console.error("Erro no polling de rastreamento:", e);
               }
          }, 5000); // 5 seconds polling for smooth-ish updates
      }

      return () => {
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      };
  }, [trackingData?.isLive, trackingData?.code, trackingData?.status]);


  const handleTrack = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!trackingCode.trim()) return;

    setLoading(true);
    setError(null);
    setTrackingData(null);
    setRemainingDistance(null);

    try {
      const data = await fetchTrackingInfo(trackingCode);
      setTrackingData(data);
      
      // Calculate initial distance
      if (data.currentLocation.coordinates && data.destinationCoordinates && 
         (data.destinationCoordinates.lat !== 0 || data.destinationCoordinates.lng !== 0)) {
           const dist = getDistanceFromLatLonInKm(
               data.currentLocation.coordinates.lat,
               data.currentLocation.coordinates.lng,
               data.destinationCoordinates.lat,
               data.destinationCoordinates.lng
           );
           setRemainingDistance(Math.round(dist));
      }

    } catch (err: any) {
      setError(err.message || "Não existe cadastro com a numeração informada.");
    } finally {
      setLoading(false);
    }
  }, [trackingCode]);

  // Helper to get status color
  const getStatusColor = (status: TrackingStatus) => {
    switch (status) {
      case TrackingStatus.DELIVERED: return 'text-green-500 border-green-500';
      case TrackingStatus.DELAYED:
      case TrackingStatus.EXCEPTION: return 'text-red-500 border-red-500';
      case TrackingStatus.STOPPED: return 'text-orange-500 border-orange-500';
      case TrackingStatus.PENDING: return 'text-gray-400 border-gray-400';
      default: return 'text-rodovar-yellow border-rodovar-yellow';
    }
  };

  const getStatusBg = (status: TrackingStatus) => {
    switch (status) {
      case TrackingStatus.DELIVERED: return 'bg-green-500/20';
      case TrackingStatus.DELAYED:
      case TrackingStatus.EXCEPTION: return 'bg-red-500/20';
      case TrackingStatus.STOPPED: return 'bg-orange-500/20';
      case TrackingStatus.PENDING: return 'bg-gray-500/20';
      default: return 'bg-yellow-500/20';
    }
  };

  const handleLoginSuccess = (username: string) => {
      setAdminUser(username);
      setCurrentView('admin');
  };

  const handleLogout = () => {
      setAdminUser('');
      setCurrentView('tracking');
  };

  // --- RENDER DRIVER VIEW ---
  if (currentView === 'driver') {
      return (
        <div className="min-h-screen bg-rodovar-black flex flex-col font-sans text-gray-100">
             <header className="border-b border-gray-800 bg-black/50 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 h-16 md:h-20 flex items-center">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentView('tracking')}>
                        <div className="bg-rodovar-yellow p-1.5 md:p-2 rounded-lg text-black">
                            <TruckIcon className="w-6 h-6 md:w-8 md:h-8" />
                        </div>
                        <div>
                            <h1 className="text-xl md:text-2xl font-extrabold tracking-tighter text-white">
                                RODO<span className="text-rodovar-yellow">VAR</span>
                            </h1>
                            <p className="text-[8px] md:text-[10px] text-gray-400 uppercase tracking-widest">
                                Acesso do Motorista
                            </p>
                        </div>
                    </div>
                </div>
            </header>
            <DriverPanel onClose={() => setCurrentView('tracking')} />
        </div>
      );
  }

  // --- RENDER ADMIN VIEWS ---

  if (currentView === 'admin' || currentView === 'login') {
    return (
        <div className="min-h-screen bg-rodovar-black flex flex-col font-sans text-gray-100">
            <header className="border-b border-gray-800 bg-black/50 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 h-16 md:h-20 flex items-center">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentView('tracking')}>
                        <div className="bg-rodovar-yellow p-1.5 md:p-2 rounded-lg text-black">
                            <TruckIcon className="w-6 h-6 md:w-8 md:h-8" />
                        </div>
                        <div>
                            <h1 className="text-xl md:text-2xl font-extrabold tracking-tighter text-white">
                                RODO<span className="text-rodovar-yellow">VAR</span>
                            </h1>
                            <p className="text-[8px] md:text-[10px] text-gray-400 uppercase tracking-widest">
                                {currentView === 'login' ? 'Login Administrativo' : `Área Administrativa (${adminUser})`}
                            </p>
                        </div>
                    </div>
                </div>
            </header>
            
            {currentView === 'login' ? (
                <LoginPanel 
                    onLoginSuccess={handleLoginSuccess} 
                    onCancel={() => setCurrentView('tracking')}
                />
            ) : (
                <AdminPanel 
                    currentUser={adminUser}
                    onClose={handleLogout} 
                />
            )}
        </div>
    );
  }

  // --- RENDER TRACKING VIEW ---

  return (
    <div className="min-h-screen bg-rodovar-black flex flex-col font-sans text-gray-100 selection:bg-rodovar-yellow selection:text-black">
      
      {/* Header */}
      <header className="border-b border-gray-800 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 md:h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3 cursor-pointer" onClick={() => setTrackingCode('')}>
            <div className="bg-rodovar-yellow p-1.5 md:p-2 rounded-lg text-black shadow-[0_0_15px_rgba(255,215,0,0.3)]">
                <TruckIcon className="w-6 h-6 md:w-8 md:h-8" />
            </div>
            <div>
                <h1 className="text-xl md:text-2xl font-extrabold tracking-tighter text-white">
                    RODO<span className="text-rodovar-yellow">VAR</span>
                </h1>
                <p className="text-[8px] md:text-sm text-gray-400 uppercase tracking-widest hidden md:block">Logística Inteligente</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
             <button 
                onClick={() => setCurrentView('driver')}
                className="flex items-center gap-2 text-xs md:text-sm font-bold text-black bg-rodovar-yellow hover:bg-yellow-400 transition-colors px-3 py-1.5 md:px-4 md:py-2 rounded-full shadow-[0_0_10px_rgba(255,215,0,0.3)] animate-[pulse_3s_infinite]"
            >
                <SteeringWheelIcon className="w-4 h-4 md:w-5 md:h-5" />
                <span className="hidden md:inline">SOU MOTORISTA</span>
                <span className="md:hidden">MOTORISTA</span>
            </button>

            <a 
                href="https://wa.me/5571999202476" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hidden md:flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-rodovar-yellow transition-colors bg-gray-900/50 px-4 py-2 rounded-full border border-gray-800 hover:border-rodovar-yellow"
            >
                <WhatsAppIcon className="w-5 h-5" />
                <span>Suporte</span>
            </a>
          </div>
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center relative pb-20 md:pb-12">
        
        {/* Address / User Location Section */}
        {userLocation && (
            <div className="w-full max-w-7xl px-4 mt-4 md:mt-6 animate-[fadeIn_0.8s_ease-out]">
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-3 md:p-4 flex flex-col md:flex-row items-center md:justify-between gap-3 md:gap-4 shadow-lg">
                    <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
                        <div className="bg-blue-900/30 p-2 md:p-3 rounded-full text-blue-400 border border-blue-500/30 relative flex-shrink-0">
                            <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20"></div>
                            <MapPinIcon className="w-5 h-5 md:w-6 md:h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-[10px] md:text-xs font-bold text-blue-400 uppercase tracking-widest mb-1">Sua Localização Atual</h3>
                            {locationLoading ? (
                                <div className="h-4 w-32 md:w-48 bg-gray-800 rounded animate-pulse"></div>
                            ) : userAddress ? (
                                <div>
                                    <p className="text-white font-bold text-sm md:text-lg leading-tight truncate">{userAddress.road}</p>
                                    <p className="text-gray-400 text-xs md:text-sm truncate">
                                        {userAddress.neighborhood ? `${userAddress.neighborhood}, ` : ''} 
                                        {userAddress.city} - {userAddress.state}
                                    </p>
                                </div>
                            ) : (
                                <p className="text-gray-400 text-sm">Coordenadas: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}</p>
                            )}
                        </div>
                    </div>
                    <div className="hidden md:block h-10 w-px bg-gray-800"></div>
                    <div className="text-right hidden md:block">
                        <p className="text-[10px] text-gray-500 uppercase">Precisão do GPS</p>
                        <p className="text-green-500 text-sm font-mono font-bold">ALTA PRECISÃO ●</p>
                    </div>
                </div>
            </div>
        )}

        {/* Search Section */}
        <div className="w-full max-w-3xl px-4 py-8 md:py-10 flex flex-col items-center gap-4 md:gap-6 z-10">
            <div className="text-center space-y-2">
                <h2 className="text-2xl md:text-5xl font-bold text-white">
                    Rastreamento <span className="text-transparent bg-clip-text bg-gradient-to-r from-rodovar-yellow to-yellow-200">Satélite</span>
                </h2>
            </div>

            <form onSubmit={handleTrack} className="w-full relative group">
                <div className="absolute inset-0 bg-rodovar-yellow/10 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative flex items-center">
                    <input 
                        type="text" 
                        value={trackingCode}
                        onChange={(e) => setTrackingCode(e.target.value.toUpperCase())}
                        placeholder="CÓDIGO (Ex: RODO-58291) ou CELULAR"
                        className="w-full bg-[#1E1E1E] border-2 border-gray-700 text-white px-4 py-3 md:px-6 md:py-4 rounded-full focus:outline-none focus:border-rodovar-yellow focus:ring-1 focus:ring-rodovar-yellow transition-all text-base md:text-lg tracking-wider shadow-2xl placeholder-gray-600 uppercase"
                    />
                    <button 
                        type="submit"
                        disabled={loading}
                        className="absolute right-1.5 md:right-2 bg-rodovar-yellow hover:bg-yellow-400 text-black p-2 md:p-3 rounded-full transition-transform transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    >
                        {loading ? (
                            <div className="w-5 h-5 md:w-6 md:h-6 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <SearchIcon className="w-5 h-5 md:w-6 md:h-6" />
                        )}
                    </button>
                </div>
            </form>
             {error && (
                <div className="w-full bg-red-900/20 border border-red-500/50 text-white px-4 py-4 rounded-lg text-center font-bold animate-pulse flex items-center justify-center gap-2 text-sm md:text-base">
                    <span className="text-lg">⚠️</span> {error}
                </div>
            )}
        </div>

        {/* Results Section */}
        <div className="w-full max-w-7xl px-4 flex flex-col lg:flex-row gap-6 mb-8">
            
            {/* Info Card */}
            {trackingData && (
                <div className="flex-1 order-2 lg:order-1 animate-[slideInLeft_0.5s_ease-out]">
                    <div className="bg-[#1E1E1E] rounded-2xl border border-gray-700 p-5 md:p-8 shadow-2xl relative overflow-hidden h-full">
                        <div className="flex justify-between items-start mb-6 md:mb-8">
                            <div>
                                <h3 className="text-gray-400 text-[10px] uppercase tracking-wider mb-1">Código Identificador</h3>
                                <p className="text-2xl md:text-4xl font-mono font-bold text-white tracking-tighter">{trackingData.code}</p>
                            </div>
                            <div className={`px-3 py-1 md:px-4 md:py-1.5 rounded-full border ${getStatusColor(trackingData.status)} ${getStatusBg(trackingData.status)}`}>
                                <span className="text-xs md:text-sm font-bold tracking-wide uppercase">{StatusLabels[trackingData.status]}</span>
                            </div>
                        </div>

                        <div className="space-y-6 md:space-y-8">
                            <div className="relative pl-4 md:pl-6 border-l-2 border-gray-700 space-y-6 md:space-y-8">
                                {/* Current Location */}
                                <div className="relative">
                                    <div className="absolute -left-[23px] md:-left-[31px] top-0 bg-rodovar-yellow rounded-full p-1 border-4 border-[#1E1E1E]">
                                        <div className="w-2 h-2 md:w-3 md:h-3 bg-black rounded-full"></div>
                                    </div>
                                    <div className="flex items-center gap-2 mb-1">
                                         <h4 className="text-gray-400 text-xs uppercase tracking-wider">Localização Atual</h4>
                                         {trackingData.isLive && (
                                             <span className="text-[9px] bg-red-600 text-white px-2 rounded-full animate-pulse font-bold tracking-wider">AO VIVO</span>
                                         )}
                                    </div>
                                    
                                    {trackingData.currentLocation.address && (
                                        <p className="text-xs md:text-sm text-gray-300 mb-1 font-medium border-l-2 border-rodovar-yellow pl-2 mt-1">
                                            {trackingData.currentLocation.address}
                                        </p>
                                    )}

                                    <p className="text-xl md:text-2xl font-bold text-white mt-1">{trackingData.currentLocation.city}, {trackingData.currentLocation.state}</p>
                                    
                                    {/* DRIVER INFO ADDED HERE */}
                                    {trackingData.driverName && (
                                        <div className="flex items-center gap-2 mt-2 bg-gray-800/50 w-fit px-3 py-1 rounded-full border border-gray-700">
                                            <SteeringWheelIcon className="w-4 h-4 text-rodovar-yellow" />
                                            <span className="text-xs text-gray-300">Motorista: <span className="text-white font-bold">{trackingData.driverName}</span></span>
                                        </div>
                                    )}

                                    <p className="text-xs md:text-sm text-rodovar-yellow mt-2 font-medium">"{trackingData.message}"</p>
                                </div>

                                {/* Origin/Dest */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                     <div className="relative">
                                        <div className="absolute -left-[22px] md:-left-[30px] top-1 w-3 h-3 md:w-4 md:h-4 bg-gray-700 rounded-full border-4 border-[#1E1E1E]"></div>
                                        <h4 className="text-gray-500 text-xs uppercase mb-1">De (Origem)</h4>
                                        <p className="font-semibold text-gray-300">{trackingData.origin}</p>
                                    </div>
                                     <div className="relative">
                                        <div className="absolute -left-[22px] md:-left-[30px] top-1 w-3 h-3 md:w-4 md:h-4 bg-gray-700 rounded-full border-4 border-[#1E1E1E]"></div>
                                        <h4 className="text-gray-500 text-xs uppercase mb-1">Para (Destino)</h4>
                                        {trackingData.destinationAddress && (
                                            <p className="text-[10px] md:text-xs text-gray-400 mb-1 font-medium">{trackingData.destinationAddress}</p>
                                        )}
                                        <p className="font-semibold text-gray-300">{trackingData.destination}</p>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Additional Notes Display */}
                            {trackingData.notes && (
                                <div className="bg-gray-800/40 p-4 rounded border border-gray-700/50">
                                    <h4 className="text-rodovar-yellow text-[10px] uppercase font-bold mb-2 flex items-center gap-2">
                                        <span className="w-1 h-1 bg-rodovar-yellow rounded-full"></span>
                                        Notas Adicionais
                                    </h4>
                                    <p className="text-xs md:text-sm text-gray-300 whitespace-pre-line">{trackingData.notes}</p>
                                </div>
                            )}

                            <div className="bg-black/30 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4 border border-gray-800">
                                <div>
                                    <h4 className="text-gray-500 text-[10px] uppercase mb-1">Última Atualização</h4>
                                    <p className="font-mono text-xs md:text-sm text-gray-300">{trackingData.lastUpdate}</p>
                                </div>
                                <div className="border-l border-gray-800 pl-4 md:pl-0 md:border-l-0">
                                    <h4 className="text-gray-500 text-[10px] uppercase mb-1">Entrega Estimada</h4>
                                    <p className="font-mono text-xs md:text-sm text-rodovar-yellow">{trackingData.estimatedDelivery}</p>
                                </div>
                                {/* NEW DISTANCE INFO */}
                                <div className="border-l border-gray-800 pl-4 md:pl-0 md:border-l-0">
                                     <h4 className="text-gray-500 text-[10px] uppercase mb-1">Distância Restante</h4>
                                     <p className="font-mono text-sm md:text-base text-rodovar-yellow font-bold">
                                         {remainingDistance !== null ? `${remainingDistance} km` : '--'}
                                     </p>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div>
                                <div className="flex justify-between text-[10px] text-gray-500 mb-2 uppercase font-bold tracking-wider">
                                    <span>Progresso da Viagem</span>
                                    <span>{trackingData.progress}%</span>
                                </div>
                                <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-rodovar-yellow shadow-[0_0_10px_#FFD700] transition-all duration-1000 ease-out"
                                        style={{ width: `${trackingData.progress}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Map Card */}
            <div className={`flex-1 order-1 lg:order-2 transition-all duration-700 ease-in-out ${loading || trackingData ? 'h-[40vh] md:h-[500px] opacity-100' : 'h-[30vh] md:h-[300px] opacity-80 hover:opacity-100'}`}>
                 <MapVisualization 
                    loading={loading} 
                    coordinates={trackingData?.currentLocation.coordinates}
                    destinationCoordinates={trackingData?.destinationCoordinates} 
                    userLocation={userLocation}
                    className="h-full w-full"
                 />
                 {!trackingData && userLocation && (
                     <p className="text-center text-gray-500 text-xs mt-2">Seu GPS está ativo. Rastreie uma carga para ver a rota.</p>
                 )}
                 {trackingData?.isLive && (
                     <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white text-xs px-4 py-1.5 rounded-full shadow-lg z-[400] font-bold tracking-widest flex items-center gap-2 animate-pulse">
                         <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                         ACOMPANHAMENTO AO VIVO
                     </div>
                 )}
            </div>
        </div>

      </main>

      {/* Floating WhatsApp Button (Mobile) */}
      <a 
        href="https://wa.me/5571999202476"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 bg-[#25D366] text-white p-4 rounded-full shadow-[0_0_20px_rgba(37,211,102,0.4)] hover:bg-[#1ebc57] transition-all z-50 md:hidden hover:scale-110 active:scale-95"
        aria-label="Fale conosco no WhatsApp"
      >
        <WhatsAppIcon className="w-6 h-6" />
      </a>

      <footer className="bg-black border-t border-gray-900 py-6 md:py-8 mt-auto relative">
        <div className="max-w-7xl mx-auto px-4 text-center">
            <p className="text-gray-600 text-xs md:text-sm">© {new Date().getFullYear()} RODOVAR Transportadora e Logística.</p>
            <p className="text-gray-800 text-[10px] mt-1 uppercase tracking-widest">Tecnologia RODOVAR-SAT</p>
            
            <div className="flex justify-center gap-4 mt-4 md:absolute md:bottom-4 md:right-4 md:flex-col md:items-end md:mt-0">
                 <button 
                    onClick={() => setCurrentView('driver')}
                    className="text-[10px] text-gray-600 hover:text-rodovar-yellow uppercase tracking-widest"
                >
                    Sou Motorista
                </button>
                <span className="text-gray-800 md:hidden">|</span>
                <button 
                    onClick={() => setCurrentView('login')}
                    className="text-[10px] text-gray-800 hover:text-gray-500 uppercase tracking-widest"
                >
                    Área Restrita
                </button>
            </div>
        </div>
      </footer>
    </div>
  );
};

export default App;