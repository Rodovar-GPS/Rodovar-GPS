import React, { useState, useEffect, useRef } from 'react';
import { TrackingData, TrackingStatus, Coordinates, StatusLabels, Expense } from '../types';
import { getShipment, saveShipment, getCoordinatesForString, calculateProgress, getDistanceFromLatLonInKm } from '../services/storageService';
import MapVisualization from './MapVisualization';
import { TruckIcon, SteeringWheelIcon, WhatsAppIcon } from './Icons';

interface DriverPanelProps {
  onClose: () => void;
}

const DriverPanel: React.FC<DriverPanelProps> = ({ onClose }) => {
  // --- SHIPMENT STATES ---
  const [code, setCode] = useState('');
  const [shipment, setShipment] = useState<TrackingData | null>(null);
  const [error, setError] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [lastUpdateLog, setLastUpdateLog] = useState<string>('');
  const [showInvoice, setShowInvoice] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  const [remainingDistanceKm, setRemainingDistanceKm] = useState<number | null>(null);

  // --- LIVE TRACKING STATES ---
  const [isLiveTracking, setIsLiveTracking] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const trackingIntervalRef = useRef<number | null>(null);
  const wakeLockRef = useRef<any>(null);

  // --- FORM STATES ---
  const [driverNotes, setDriverNotes] = useState('');
  const [expenseCategory, setExpenseCategory] = useState<'Combustível' | 'Manutenção' | 'Alimentação' | 'Outros'>('Combustível');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseValue, setExpenseValue] = useState('');
  const [pendingExpenses, setPendingExpenses] = useState<Expense[]>([]);

  // Configuração do WhatsApp do Gestor
  const MANAGER_PHONE = "5571999202476"; 

  const getNowFormatted = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes} - ${day}/${month}`;
  };

  // Restore session
  useEffect(() => {
    const savedCode = localStorage.getItem('rodovar_active_driver_code');
    if (savedCode) {
        setCode(savedCode);
        handleShipmentLogin(null, savedCode);
    }
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      stopLiveTracking(true); // True to skip notification on unmount
    };
  }, []);

  // Restore Wake Lock on visibility
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isLiveTracking) {
         requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isLiveTracking]);

  // Prevent accidental close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        if (isLiveTracking) {
            e.preventDefault();
            e.returnValue = '';
        }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isLiveTracking]);

  const requestWakeLock = async () => {
      try {
          if ('wakeLock' in navigator) {
              wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
              setWakeLockActive(true);
          }
      } catch (err) {
          console.error('Falha ao solicitar Wake Lock:', err);
          setWakeLockActive(false);
      }
  };

  const releaseWakeLock = async () => {
      if (wakeLockRef.current) {
          try {
            await wakeLockRef.current.release();
          } catch(e) { console.error(e); }
          wakeLockRef.current = null;
          setWakeLockActive(false);
      }
  };

  const updateDistanceCalc = (current: Coordinates, dest?: Coordinates) => {
      if (current && dest && (dest.lat !== 0 || dest.lng !== 0)) {
          const dist = getDistanceFromLatLonInKm(current.lat, current.lng, dest.lat, dest.lng);
          setRemainingDistanceKm(dist);
      } else {
          setRemainingDistanceKm(null);
      }
  };

  const handleShipmentLogin = async (e: React.FormEvent | null, codeOverride?: string) => {
    if (e) e.preventDefault();
    const codeToUse = codeOverride || code;
    
    if (!codeToUse) return;

    setIsLocating(true);
    try {
        const found = await getShipment(codeToUse.toUpperCase());
        if (found) {
            setShipment(found);
            setDriverNotes(found.driverNotes || '');
            setError('');
            setPendingExpenses([]); 
            
            localStorage.setItem('rodovar_active_driver_code', found.code);

            updateDistanceCalc(found.currentLocation.coordinates, found.destinationCoordinates);
            
            const wasTracking = localStorage.getItem(`rodovar_tracking_state_${found.code}`);
            if (wasTracking === 'active' && found.status !== TrackingStatus.DELIVERED) {
                 startLiveTracking(found.code, true); // Silent start on restore
            }

        } else {
            setError('Código de carga inválido.');
            localStorage.removeItem('rodovar_active_driver_code');
        }
    } finally {
        setIsLocating(false);
    }
  };

  const handleLogout = () => {
      stopLiveTracking(true);
      localStorage.removeItem('rodovar_active_driver_code');
      setShipment(null);
      setRemainingDistanceKm(null);
      setCode('');
  };

  const handleAddExpense = () => {
      if (!expenseValue || parseFloat(expenseValue) <= 0) {
          alert("Informe um valor válido.");
          return;
      }
      if (!expenseDesc) {
          alert("Informe uma descrição.");
          return;
      }

      const newExpense: Expense = {
          id: Date.now().toString(),
          category: expenseCategory,
          description: expenseDesc,
          value: parseFloat(expenseValue),
          date: new Date().toISOString()
      };

      setPendingExpenses([...pendingExpenses, newExpense]);
      setExpenseDesc('');
      setExpenseValue('');
  };

  const handleRemovePendingExpense = (id: string) => {
      setPendingExpenses(pendingExpenses.filter(e => e.id !== id));
  };

  const performUpdate = async (forceCompletion = false, silent = false) => {
      if (!navigator.geolocation) {
          throw new Error("GPS Desativado. Ative a localização.");
      }
      
      const currentCode = shipment?.code;
      if (!currentCode) throw new Error("Carga não carregada.");

      return new Promise<void>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
              async (position) => {
                  try {
                      if (!silent) console.log("GPS Obtido:", position.coords);
                      const { latitude, longitude } = position.coords;
                      const currentCoords: Coordinates = { lat: latitude, lng: longitude };

                      const freshShipment = await getShipment(currentCode);
                      if (!freshShipment) throw new Error("Carga não encontrada.");

                      let city = freshShipment.currentLocation.city;
                      let state = freshShipment.currentLocation.state;
                      let address = freshShipment.currentLocation.address || '';

                      try {
                          const response = await fetch(
                              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
                          );
                          const data = await response.json();
                          
                          if (data && data.address) {
                              city = data.address.city || data.address.town || data.address.village || data.address.municipality || city;
                              state = data.address.state || state;
                              if (state.length > 2) state = state.substring(0, 2).toUpperCase();
                              address = data.address.road 
                                  ? `${data.address.road}${data.address.house_number ? `, ${data.address.house_number}` : ''}` 
                                  : (data.display_name ? data.display_name.split(',')[0] : address);
                          }
                      } catch (geoErr) { /* ignore */ }

                      let destCoords = freshShipment.destinationCoordinates;
                      if ((!destCoords || (destCoords.lat === 0 && destCoords.lng === 0)) && freshShipment.destination) {
                           destCoords = await getCoordinatesForString(freshShipment.destination, freshShipment.destinationAddress);
                      }

                      updateDistanceCalc(currentCoords, destCoords);

                      let progress = freshShipment.progress || 0;
                      if (destCoords && freshShipment.origin) {
                           const originCoords = await getCoordinatesForString(freshShipment.origin);
                           progress = calculateProgress(originCoords, destCoords, currentCoords);
                      }
                      
                      if (forceCompletion) progress = 100;

                      const updatedExpenses = [...(freshShipment.expenses || []), ...pendingExpenses];
                      const responsibleName = freshShipment.driverName || 'Motorista';

                      const updatedShipment: TrackingData = {
                          ...freshShipment,
                          status: forceCompletion ? TrackingStatus.DELIVERED : TrackingStatus.IN_TRANSIT,
                          isLive: forceCompletion ? false : (isLiveTracking || silent),
                          currentLocation: { city, state, address, coordinates: currentCoords },
                          destinationCoordinates: destCoords,
                          lastUpdate: getNowFormatted(),
                          lastUpdatedBy: responsibleName,
                          progress: progress,
                          message: forceCompletion ? 'Entrega Realizada' : (silent ? `Rastreamento GPS (Auto)` : `Atualização manual por ${responsibleName}`),
                          driverNotes: driverNotes,
                          expenses: updatedExpenses, 
                          maintenanceCost: 0, fuelCost: 0
                      };

                      await saveShipment(updatedShipment);
                      setShipment(updatedShipment);
                      setPendingExpenses([]); 
                      setLastUpdateLog(forceCompletion ? `CONCLUÍDA` : `Atualizado em ${city} (${getNowFormatted()})`);
                      resolve();

                  } catch (err: any) {
                      setLastUpdateLog(`Erro: ${err.message}`);
                      reject(err);
                  }
              },
              (geoError) => {
                  setLastUpdateLog("ERRO GPS: Verifique se a localização está ativa.");
                  reject(new Error("Erro de GPS. Verifique a permissão."));
              },
              { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
          );
      });
  };

  const isCloseEnoughToFinish = remainingDistanceKm !== null && remainingDistanceKm <= 1.0;
  const isTripCompleted = shipment?.status === TrackingStatus.DELIVERED;

  const handleUpdateTrip = async () => {
      if (isCloseEnoughToFinish && !isTripCompleted) {
          if (confirm("Você está no destino. Deseja CONCLUIR A VIAGEM e avisar no WhatsApp?")) {
              stopLiveTracking(true); // Stop tracking log
              setIsLocating(true);
              try {
                  await performUpdate(true, false); 
                  sendWhatsAppUpdate('finish'); // Auto send whatsapp
                  alert("Viagem Concluída com Sucesso!");
              } catch (err: any) {
                  alert(`Erro: ${err.message}`);
              } finally {
                  setIsLocating(false);
              }
              return;
          }
      }

      setIsLocating(true);
      try {
          await performUpdate(false, false);
          if (!isLiveTracking) alert("Dados Atualizados!");
      } catch (err: any) {
          alert(`Erro: ${err.message}`);
      } finally {
          setIsLocating(false);
      }
  };

  // --- WHATSAPP INTEGRATION ---
  const sendWhatsAppUpdate = (type: 'start' | 'stop' | 'update' | 'problem' | 'finish') => {
      if (!shipment) return;
      const appUrl = window.location.origin;
      let text = '';
      
      switch(type) {
          case 'start':
              text = `🚛 *INÍCIO DE VIAGEM*\n\nCarga: *${shipment.code}*\nMotorista: ${shipment.driverName || 'Eu'}\nStatus: Em Trânsito\n\n📡 *Acompanhe minha localização ao vivo aqui:*\n${appUrl}`;
              break;
          case 'stop':
              text = `⏸️ *RASTREAMENTO PAUSADO*\n\nCarga: *${shipment.code}*\nO motorista pausou o envio de dados temporariamente.`;
              break;
          case 'update':
              text = `📍 *ATUALIZAÇÃO DE LOCALIZAÇÃO*\n\nCarga: *${shipment.code}*\nEstou em: ${shipment.currentLocation.city} - ${shipment.currentLocation.state}\n\nLink: ${appUrl}`;
              break;
          case 'finish':
               text = `✅ *VIAGEM FINALIZADA*\n\nCarga: *${shipment.code}*\nEntrega realizada com sucesso no destino!\n\nConfira os dados finais no sistema.`;
               break;
          case 'problem':
              text = `⚠️ *ALERTA DE PROBLEMA*\n\nCarga: *${shipment.code}*\nPreciso de suporte imediato!`;
              break;
      }
      
      const url = `https://wa.me/${MANAGER_PHONE}?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
  };

  // --- LIVE TRACKING LOGIC ---
  const toggleLiveTracking = () => {
      if (isLiveTracking) {
          if (confirm("Parar o envio automático e avisar o gestor?")) {
            stopLiveTracking(false); // false sends notification
          }
      } else {
          startLiveTracking(shipment?.code || '');
      }
  };

  const startLiveTracking = (currentCode: string, silentRestore = false) => {
      if (isTripCompleted) {
          alert("Viagem concluída.");
          return;
      }

      // Se for início manual (botão), abre o WhatsApp
      if (!silentRestore) {
        if (confirm("Iniciar rastreamento e enviar link para o gestor no WhatsApp?")) {
            sendWhatsAppUpdate('start');
        }
      }

      setIsLiveTracking(true);
      requestWakeLock();
      localStorage.setItem(`rodovar_tracking_state_${currentCode}`, 'active');
      
      // Update immediately
      performUpdate(false, true).catch(console.error);

      // Interval 20 Seconds
      if (trackingIntervalRef.current) clearInterval(trackingIntervalRef.current);
      trackingIntervalRef.current = window.setInterval(async () => {
          try {
              await performUpdate(false, true);
          } catch (e) {
              console.error("Erro Auto Track:", e);
          }
      }, 20000); // 20 Segundos
  };

  const stopLiveTracking = (silent = false) => {
      if (trackingIntervalRef.current) {
          clearInterval(trackingIntervalRef.current);
          trackingIntervalRef.current = null;
      }
      
      if (!silent && isLiveTracking) {
         sendWhatsAppUpdate('stop');
      }

      setIsLiveTracking(false);
      releaseWakeLock();
      if (shipment) {
        localStorage.removeItem(`rodovar_tracking_state_${shipment.code}`);
        const updated = {...shipment, isLive: false};
        setShipment(updated);
        saveShipment(updated).catch(console.error);
      }
  };

  const handleDownloadPDF = () => {
    const element = document.getElementById('printable-invoice');
    if (!element) return;
    setIsGeneratingPdf(true);
    const opt = {
        margin: 5, filename: `Comprovante_${shipment?.code}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    (window as any).html2pdf().set(opt).from(element).save().then(() => setIsGeneratingPdf(false));
  };

  // --- LOGIN VIEW ---
  if (!shipment) {
    return (
        <div className="w-full max-w-md mx-auto p-4 md:p-6 animate-[fadeIn_0.3s] flex flex-col items-center min-h-screen justify-center">
            <div className="w-full bg-[#1E1E1E] border border-gray-700 rounded-xl p-6 md:p-8 shadow-2xl text-center relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white">✕</button>
                <div className="inline-block p-4 rounded-full bg-rodovar-yellow mb-6 shadow-[0_0_20px_rgba(255,215,0,0.2)]">
                    <SteeringWheelIcon className="w-8 h-8 text-black" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Acesso do Motorista</h2>
                <p className="text-gray-400 text-sm mb-6">Digite o código da carga para iniciar.</p>
                <form onSubmit={(e) => handleShipmentLogin(e)} className="space-y-4">
                    <input 
                        type="text" 
                        value={code}
                        onChange={e => setCode(e.target.value.toUpperCase())}
                        placeholder="EX: RODO-12345"
                        className="w-full bg-black/50 border border-gray-600 rounded-lg p-4 text-center text-xl text-white font-mono font-bold focus:border-rodovar-yellow outline-none uppercase tracking-widest"
                    />
                    {error && <p className="text-red-500 text-xs font-bold bg-red-900/10 p-2 rounded">{error}</p>}
                    <button type="submit" disabled={isLocating} className="w-full bg-rodovar-yellow text-black font-bold py-3 rounded-lg hover:bg-yellow-400 shadow-[0_0_15px_rgba(255,215,0,0.2)] disabled:opacity-50 transition-all active:scale-95">
                        {isLocating ? 'CONECTANDO SATÉLITE...' : 'INICIAR OPERAÇÃO'}
                    </button>
                </form>
            </div>
        </div>
    );
  }

  // --- DASHBOARD VIEW ---
  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-4 md:py-6 flex flex-col pb-24 md:pb-20 animate-[fadeIn_0.5s]">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 bg-[#1E1E1E] p-4 rounded-xl border border-gray-800 gap-4">
            <div className="flex items-center gap-3">
                 <div className={`p-2 rounded-full transition-colors ${isLiveTracking ? 'bg-red-600 animate-pulse shadow-[0_0_15px_red]' : 'bg-gray-800'}`}>
                    <SteeringWheelIcon className={`w-5 h-5 ${isLiveTracking ? 'text-white' : 'text-rodovar-yellow'}`} />
                 </div>
                 <div>
                    <h2 className="text-white font-bold text-sm">Painel do Motorista</h2>
                    <p className="text-xs text-gray-500 flex items-center gap-2">
                        Carga: <span className="text-rodovar-yellow font-mono text-base">{shipment.code}</span>
                        {isLiveTracking && <span className="text-[10px] bg-red-900/40 text-red-400 border border-red-800 px-2 rounded-full animate-pulse font-bold">TRANSMITINDO (20s)</span>}
                    </p>
                 </div>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
                <button onClick={() => setShowInvoice(true)} className="flex-1 md:flex-none text-xs font-bold bg-white text-black px-3 py-2 rounded hover:bg-gray-200">📄 Nota Fiscal</button>
                <button onClick={handleLogout} className="flex-1 md:flex-none text-xs text-gray-500 hover:text-white border border-gray-700 px-3 py-2 rounded uppercase">Sair</button>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 flex flex-col gap-6 order-2 lg:order-1">
                
                {/* AUTO TRACKING CONTROLLER */}
                <div className="bg-[#1E1E1E] p-4 md:p-6 rounded-xl border border-gray-700 text-center shadow-xl relative overflow-hidden">
                    {isLiveTracking && <div className="absolute inset-0 bg-red-900/10 animate-pulse pointer-events-none"></div>}

                    <div className="flex flex-col gap-3">
                        {!isTripCompleted && !isCloseEnoughToFinish && (
                            <button 
                                onClick={toggleLiveTracking}
                                className={`w-full py-4 rounded-lg font-bold text-sm uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2
                                ${isLiveTracking 
                                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]' 
                                    : 'bg-green-600 hover:bg-green-500 text-white'}`}
                            >
                                {isLiveTracking ? (
                                    <>
                                        <div className="w-3 h-3 bg-white rounded-full animate-ping"></div>
                                        PARAR ENVIO (20s)
                                    </>
                                ) : (
                                    <>
                                        <WhatsAppIcon className="w-4 h-4" />
                                        INICIAR COM WHATSAPP
                                    </>
                                )}
                            </button>
                        )}

                        <button 
                            onClick={handleUpdateTrip}
                            disabled={isLocating || isTripCompleted}
                            className={`w-full font-bold py-4 rounded-lg shadow-lg transition-transform active:scale-95 flex flex-col items-center justify-center gap-1
                            ${isLocating || isTripCompleted ? 'opacity-70 cursor-not-allowed bg-gray-600' : 
                            isCloseEnoughToFinish ? 'bg-rodovar-yellow hover:bg-yellow-400 text-black animate-pulse' : 
                            'bg-gray-700 hover:bg-gray-600 text-white border border-gray-600'}`}
                        >
                            {isLocating ? 'ENVIANDO DADOS...' : isTripCompleted ? 'VIAGEM CONCLUÍDA' : isCloseEnoughToFinish ? 'CONCLUIR ENTREGA' : 'ATUALIZAR PONTO MANUAL'}
                        </button>
                    </div>

                    <p className={`text-[10px] mt-4 border-t border-gray-800 pt-2 ${isLiveTracking && !wakeLockActive ? 'text-red-400 font-bold animate-pulse' : 'text-gray-500'}`}>
                        {isLiveTracking 
                            ? '⚠ MANTENHA A TELA LIGADA. Enviando localização a cada 20 segundos.'
                            : 'O sistema enviará um link de rastreamento no WhatsApp ao iniciar.'}
                    </p>
                </div>

                {/* WHATSAPP INTEGRATION PANEL */}
                <div className="bg-[#1E1E1E] p-4 rounded-xl border border-gray-700">
                    <h3 className="text-green-500 text-sm font-bold uppercase border-b border-gray-800 pb-2 mb-3 flex items-center gap-2">
                        <WhatsAppIcon className="w-4 h-4" /> Alertas Rápidos
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => sendWhatsAppUpdate('update')} className="bg-gray-800 hover:bg-gray-700 text-white text-xs py-3 px-1 rounded border border-gray-600 transition-colors flex items-center justify-center gap-1">
                            📍 Enviar Local
                        </button>
                        <button onClick={() => sendWhatsAppUpdate('problem')} className="bg-red-900/20 hover:bg-red-900/40 text-red-400 text-xs py-3 px-1 rounded border border-red-900/50 transition-colors flex items-center justify-center gap-1">
                            ⚠️ Problema
                        </button>
                    </div>
                </div>

                {/* EXPENSES */}
                <div className="bg-[#1E1E1E] p-4 rounded-xl border border-gray-700 space-y-3">
                    <h3 className="text-rodovar-yellow text-sm font-bold uppercase border-b border-gray-800 pb-2">Despesas</h3>
                    <div className="grid grid-cols-1 gap-2">
                        <select value={expenseCategory} onChange={e => setExpenseCategory(e.target.value as any)} disabled={isTripCompleted} className="w-full bg-black/40 border border-gray-600 rounded p-2 text-white text-xs">
                            <option value="Combustível">Combustível</option>
                            <option value="Manutenção">Manutenção</option>
                            <option value="Alimentação">Alimentação</option>
                            <option value="Outros">Outros</option>
                        </select>
                        <div className="flex gap-2">
                            <input type="number" value={expenseValue} onChange={e => setExpenseValue(e.target.value)} placeholder="R$ 0.00" disabled={isTripCompleted} className="w-full bg-black/40 border border-gray-600 rounded p-2 text-white text-xs" />
                            <button onClick={handleAddExpense} disabled={isTripCompleted} className="bg-rodovar-yellow text-black font-bold px-4 rounded text-lg">+</button>
                        </div>
                    </div>
                    {pendingExpenses.length > 0 && (
                        <div className="bg-black/30 rounded border border-gray-700 p-2 text-[10px]">
                            <p className="text-blue-400 font-bold mb-1">Pendentes:</p>
                            {pendingExpenses.map(item => (
                                <div key={item.id} className="flex justify-between border-b border-gray-800 py-1">
                                    <span className="text-gray-300">{item.category}: R$ {item.value}</span>
                                    <button onClick={() => handleRemovePendingExpense(item.id)} className="text-red-500">x</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* MAP & INFO */}
            <div className="lg:col-span-2 flex flex-col gap-6 order-1 lg:order-2">
                 <div className="bg-[#1E1E1E] rounded-xl border border-gray-700 overflow-hidden relative h-[45vh] lg:h-[550px]">
                     <MapVisualization 
                        coordinates={shipment.currentLocation.coordinates}
                        destinationCoordinates={shipment.destinationCoordinates}
                        className="w-full h-full absolute inset-0"
                     />
                     {isLiveTracking && (
                         <div className="absolute top-4 right-4 bg-red-600 text-white text-[10px] px-3 py-1 rounded-full shadow-lg flex items-center gap-2 animate-pulse z-[1000] font-bold tracking-wider border border-white/20">
                             <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                             TRANSMISSÃO AO VIVO ATIVA
                         </div>
                     )}
                </div>
                <div className="bg-[#1E1E1E] p-4 rounded-xl border border-gray-700 grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                         <p className="text-[10px] text-gray-500 uppercase mb-1">Última Localização</p>
                         <p className="text-white font-bold text-xs md:text-sm">{shipment.currentLocation.city} - {shipment.currentLocation.state}</p>
                    </div>
                    <div className="border-l border-gray-800 pl-4">
                         <p className="text-[10px] text-gray-500 uppercase mb-1">Destino</p>
                         <p className="text-rodovar-yellow font-bold text-xs md:text-sm">
                            {remainingDistanceKm !== null ? `${remainingDistanceKm.toFixed(1)} km restantes` : shipment.destination}
                         </p>
                    </div>
                    <div className="col-span-2 md:col-span-1 border-t md:border-t-0 md:border-l border-gray-800 pt-2 md:pt-0 pl-0 md:pl-4">
                        <p className="text-[10px] text-gray-500 uppercase mb-1">Log do Sistema</p>
                        <p className={`text-[10px] font-mono ${lastUpdateLog.includes('Erro') ? 'text-red-400' : 'text-green-400'}`}>{lastUpdateLog || "Aguardando..."}</p>
                    </div>
                </div>
            </div>
        </div>

        {/* INVOICE MODAL */}
        {showInvoice && (
            <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white text-black w-full max-w-3xl p-6 rounded shadow-2xl relative h-auto max-h-[90vh] overflow-y-auto">
                    <button onClick={() => setShowInvoice(false)} className="absolute top-4 right-4 font-bold text-gray-500">X</button>
                    <div id="printable-invoice" className="space-y-4 text-black">
                        <h1 className="text-2xl font-black border-b border-black pb-2">RODOVAR LOGÍSTICA</h1>
                        <p className="font-bold">Carga: {shipment.code}</p>
                        <p>Motorista: {shipment.driverName}</p>
                        <p>Origem: {shipment.origin} | Destino: {shipment.destination}</p>
                        <table className="w-full text-sm border-t border-black mt-4">
                            <thead><tr className="bg-gray-100"><th className="text-left p-2">Item</th><th className="text-right p-2">Valor</th></tr></thead>
                            <tbody>
                                {shipment.expenses?.map((e, i) => <tr key={i}><td className="p-2 border-b">{e.description}</td><td className="p-2 border-b text-right">R$ {e.value.toFixed(2)}</td></tr>)}
                            </tbody>
                        </table>
                    </div>
                    <button onClick={handleDownloadPDF} disabled={isGeneratingPdf} className="mt-6 bg-black text-white px-6 py-3 rounded font-bold w-full">{isGeneratingPdf ? 'Gerando...' : 'Baixar PDF'}</button>
                </div>
            </div>
        )}
    </div>
  );
};

export default DriverPanel;