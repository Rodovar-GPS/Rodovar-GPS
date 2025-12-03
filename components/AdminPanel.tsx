import React, { useState, useEffect } from 'react';
import { TrackingData, TrackingStatus, StatusLabels, AdminUser, Expense, Driver } from '../types';
import { 
    saveShipment, getAllShipments, deleteShipment, 
    getCoordinatesForCity, getCoordinatesForString, calculateProgress,
    saveUser, getAllUsers, deleteUser,
    getAllDrivers, saveDriver, deleteDriver, generateUniqueCode
} from '../services/storageService';
import { TruckIcon, MapPinIcon, SearchIcon, SteeringWheelIcon, WhatsAppIcon } from './Icons';

interface AdminPanelProps {
  onClose: () => void;
  currentUser: string;
}

type Tab = 'shipments' | 'users' | 'drivers';

const AdminPanel: React.FC<AdminPanelProps> = ({ onClose, currentUser }) => {
  const [activeTab, setActiveTab] = useState<Tab>('shipments');

  // --- HELPER: DATES ---
  const getNowFormatted = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes} - ${day}/${month}/${year}`;
  };

  const getFutureDateInputFormat = (daysToAdd: number) => {
    const date = new Date();
    date.setDate(date.getDate() + daysToAdd);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${year}-${month}-${day}`;
  };

  const formatDateToBr = (isoDate: string) => {
      if (!isoDate) return '';
      const [year, month, day] = isoDate.split('-');
      return `${day}/${month}/${year}`;
  };

  const formatDateFromBr = (brDate: string) => {
      if (!brDate) return '';
      const parts = brDate.split('/');
      if (parts.length !== 3) return '';
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
  };

  // --- STATES FOR SHIPMENTS ---
  const [shipments, setShipments] = useState<Record<string, TrackingData>>({});
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false); 
  const [isEditing, setIsEditing] = useState(false); 
  
  // Search State
  const [searchTerm, setSearchTerm] = useState('');

  const [code, setCode] = useState('');
  const [status, setStatus] = useState<TrackingStatus>(TrackingStatus.IN_TRANSIT);
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [address, setAddress] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [message, setMessage] = useState('Carga em deslocamento para o destino.');
  const [notes, setNotes] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState(''); 
  
  const [driverNotes, setDriverNotes] = useState('');
  const [expensesList, setExpensesList] = useState<Expense[]>([]);
  
  const [estimatedDateInput, setEstimatedDateInput] = useState(getFutureDateInputFormat(3));
  
  const [updateTime, setUpdateTime] = useState(getNowFormatted());
  const [displayProgress, setDisplayProgress] = useState(0);

  // --- STATES FOR USERS & DRIVERS ---
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [userMsg, setUserMsg] = useState('');

  // States for New Driver Form
  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverPhone, setNewDriverPhone] = useState('');
  const [driverMsg, setDriverMsg] = useState('');

  useEffect(() => {
    loadShipments();
    loadUsers();
    loadDrivers();
  }, []);

  useEffect(() => {
    // Generate code only when not editing and form is fresh
    if (!isEditing && activeTab === 'shipments' && !code) {
        generateNewCode();
    }
  }, [shipments, isEditing, activeTab]);

  const generateNewCode = async () => {
      const nextCode = await generateUniqueCode();
      setCode(nextCode);
      setUpdateTime(getNowFormatted());
      setEstimatedDateInput(getFutureDateInputFormat(3));
  };

  const loadShipments = async () => {
    setLoading(true);
    const data = await getAllShipments();
    setShipments(data);
    setLoading(false);
  };

  const loadUsers = async () => {
    setUsers(await getAllUsers());
  };

  const loadDrivers = async () => {
    setDrivers(await getAllDrivers());
  };

  const resetForm = () => {
      setIsEditing(false);
      generateNewCode(); // Generate new random code
      setStatus(TrackingStatus.IN_TRANSIT);
      setCity('');
      setState('');
      setAddress('');
      setOrigin('');
      setDestination('');
      setDestinationAddress('');
      setMessage('Carga em deslocamento para o destino.');
      setNotes('');
      setDisplayProgress(0);
      setSelectedDriverId('');
      setDriverNotes('');
      setExpensesList([]);
      setEstimatedDateInput(getFutureDateInputFormat(3));
  };

  const handleGetDriverLocation = () => {
    if (!navigator.geolocation) {
        alert("Geolocalização não suportada.");
        return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;
            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
                );
                const data = await response.json();
                if (data && data.address) {
                    const foundCity = data.address.city || data.address.town || data.address.village || data.address.municipality || '';
                    const foundState = data.address.state || '';
                    const foundAddress = data.address.road 
                        ? `${data.address.road}${data.address.house_number ? `, ${data.address.house_number}` : ''}` 
                        : (data.display_name ? data.display_name.split(',')[0] : '');

                    setCity(foundCity);
                    setState(foundState);
                    setAddress(foundAddress);
                    setUpdateTime(getNowFormatted()); 
                } else {
                    alert("Endereço não encontrado.");
                }
            } catch (error) {
                console.error("Erro:", error);
                alert("Erro ao converter coordenadas.");
            } finally {
                setGpsLoading(false);
            }
        },
        (error) => {
            setGpsLoading(false);
            alert("Erro GPS: " + error.message);
        },
        { enableHighAccuracy: true }
    );
  };

  const handleSaveShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !city || !state || !origin || !destination) {
      alert("Preencha Código, Cidade, Estado, Origem e Destino.");
      return;
    }

    setLoading(true);

    try {
        const currentCoords = await getCoordinatesForCity(city, state);
        
        const originCoords = await getCoordinatesForString(origin);
        const destCoords = await getCoordinatesForString(destination, destinationAddress);
        
        const calculatedProgress = calculateProgress(originCoords, destCoords, currentCoords);
        setDisplayProgress(calculatedProgress);

        const assignedDriver = drivers.find(d => d.id === selectedDriverId);
        const finalDate = formatDateToBr(estimatedDateInput);

        const newData: TrackingData = {
            code: code.toUpperCase(),
            status,
            currentLocation: {
                city,
                state: state.toUpperCase(),
                address,
                coordinates: currentCoords
            },
            origin,
            destination,
            destinationAddress,
            destinationCoordinates: destCoords, 
            lastUpdate: updateTime,
            lastUpdatedBy: currentUser,
            estimatedDelivery: finalDate,
            message,
            notes,
            progress: calculatedProgress,
            isLive: isEditing ? shipments[code]?.isLive : false, // Maintain live status if editing
            
            driverId: selectedDriverId,
            driverName: assignedDriver ? assignedDriver.name : undefined,

            driverNotes,
            expenses: expensesList,
            maintenanceCost: 0,
            fuelCost: 0
        };

        await saveShipment(newData);
        await loadShipments(); // Reload to get sync
        alert(`Carga ${code} salva!`);
        
        if (!isEditing) {
            resetForm();
        }
    } catch (err) {
        console.error(err);
        alert("Erro ao salvar.");
    } finally {
        setLoading(false);
    }
  };

  const handleEditShipment = (data: TrackingData) => {
    setIsEditing(true);
    setCode(data.code);
    setStatus(data.status);
    setCity(data.currentLocation.city);
    setState(data.currentLocation.state);
    setAddress(data.currentLocation.address || '');
    setOrigin(data.origin);
    setDestination(data.destination);
    setDestinationAddress(data.destinationAddress || '');
    setMessage(data.message);
    setNotes(data.notes || '');
    setDisplayProgress(data.progress);
    
    setEstimatedDateInput(formatDateFromBr(data.estimatedDelivery));
    
    setUpdateTime(getNowFormatted());
    setSelectedDriverId(data.driverId || '');
    
    setDriverNotes(data.driverNotes || '');
    setExpensesList(data.expenses || []);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
      resetForm();
  };

  const handleDeleteShipment = async (codeToDelete: string) => {
    if (confirm(`Excluir a carga ${codeToDelete}?`)) {
      await deleteShipment(codeToDelete);
      await loadShipments();
      if (code === codeToDelete) resetForm();
    }
  };

  // --- HANDLERS FOR USERS ---
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newPassword) return;
    const success = await saveUser({ username: newUsername, password: newPassword });
    if (success) {
        setNewUsername('');
        setNewPassword('');
        setUserMsg('Usuário criado!');
        await loadUsers();
        setTimeout(() => setUserMsg(''), 3000);
    } else {
        setUserMsg('Usuário já existe.');
    }
  };

  const handleDeleteUser = async (username: string) => {
      if (confirm(`Remover ${username}?`)) {
          await deleteUser(username);
          await loadUsers();
      }
  };

  // --- HANDLERS FOR DRIVERS ---
  const handleSaveDriver = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newDriverName) return;
      
      const newDriver: Driver = {
          id: Date.now().toString(),
          name: newDriverName,
          phone: newDriverPhone,
          password: '' // Não usado mais
      };

      const success = await saveDriver(newDriver);
      if (success) {
          setNewDriverName('');
          setNewDriverPhone('');
          setDriverMsg('Motorista cadastrado!');
          await loadDrivers();
          setTimeout(() => setDriverMsg(''), 3000);
      } else {
          setDriverMsg('Erro: Nome já existe.');
      }
  };

  const handleDeleteDriver = async (id: string) => {
      if (confirm("Remover este motorista?")) {
          await deleteDriver(id);
          await loadDrivers();
      }
  };

  // --- SHARE VIA WHATSAPP HELPER ---
  const sendDriverLink = (driver: Driver) => {
      if (!driver.phone) {
          alert("Motorista sem telefone cadastrado.");
          return;
      }
      const appUrl = window.location.origin;
      const msg = `Olá ${driver.name}, acesse o sistema RODOVAR com o código da carga para iniciar o rastreamento.\n\nLink: ${appUrl}`;
      const url = `https://wa.me/55${driver.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
      window.open(url, '_blank');
  };

  const isAdmin = currentUser === 'admin';
  const totalExpenses = expensesList.reduce((acc, curr) => acc + curr.value, 0);

  const filteredShipments = (Object.values(shipments) as TrackingData[]).filter(s => {
      const search = searchTerm.toUpperCase();
      return s.code.includes(search) || 
             s.currentLocation.city.toUpperCase().includes(search) ||
             s.origin.toUpperCase().includes(search) ||
             s.destination.toUpperCase().includes(search) ||
             (s.driverName && s.driverName.toUpperCase().includes(search));
  });

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-4 md:py-8 animate-[fadeIn_0.5s]">
      
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 md:mb-8 gap-4">
        <div className="text-center md:text-left">
            <h2 className="text-2xl md:text-3xl font-bold text-white">Painel Administrativo</h2>
            <p className="text-gray-500 text-xs md:text-sm">Sistema de Gestão RODOVAR</p>
        </div>
        
        <div className="flex flex-wrap justify-center gap-2 bg-[#1E1E1E] p-1 rounded-lg border border-gray-700 w-full md:w-auto">
            <button 
                onClick={() => setActiveTab('shipments')}
                className={`flex-1 md:flex-none px-4 py-2 rounded-md text-xs md:text-sm font-bold transition-all ${activeTab === 'shipments' ? 'bg-rodovar-yellow text-black shadow' : 'text-gray-400 hover:text-white'}`}
            >
                CARGAS
            </button>
            <button 
                onClick={() => setActiveTab('drivers')}
                className={`flex-1 md:flex-none px-4 py-2 rounded-md text-xs md:text-sm font-bold transition-all ${activeTab === 'drivers' ? 'bg-rodovar-yellow text-black shadow' : 'text-gray-400 hover:text-white'}`}
            >
                MOTORISTAS
            </button>
            <button 
                onClick={() => setActiveTab('users')}
                className={`flex-1 md:flex-none px-4 py-2 rounded-md text-xs md:text-sm font-bold transition-all ${activeTab === 'users' ? 'bg-rodovar-yellow text-black shadow' : 'text-gray-400 hover:text-white'}`}
            >
                ADMINS
            </button>
        </div>

        <button onClick={onClose} className="w-full md:w-auto text-red-400 hover:text-red-300 text-xs md:text-sm font-bold border border-red-900/50 bg-red-900/10 px-4 py-2 rounded hover:bg-red-900/20 transition-colors">
          SAIR
        </button>
      </div>

      {/* --- ABA CARGAS --- */}
      {activeTab === 'shipments' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 md:gap-8">
            <div className="xl:col-span-6 bg-[#1E1E1E] rounded-xl border border-gray-700 shadow-xl overflow-hidden relative">
                <div className="bg-gray-900/50 border-b border-gray-700 p-4 flex justify-between items-center">
                    <h3 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                        <TruckIcon className="w-4 h-4 text-rodovar-yellow" />
                        {isEditing ? `Editando: ${code}` : 'Nova Carga'}
                    </h3>
                    {isEditing && (
                         <button onClick={handleCancelEdit} className="text-[10px] text-red-400 bg-red-900/20 px-2 py-1 rounded">Cancelar</button>
                    )}
                </div>
                
                <form onSubmit={handleSaveShipment} className="p-4 md:p-6 space-y-6">
                    
                    {/* SECTION 1: IDENTIFICATION & DRIVER */}
                    <div className="bg-black/20 p-4 rounded-lg border border-gray-800">
                        <h4 className="text-rodovar-yellow text-xs uppercase font-bold tracking-widest mb-3 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-rodovar-yellow rounded-full"></span> 1. Identificação
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-[10px] text-gray-500 uppercase mb-1">Código (Automático)</label>
                                <input value={code} readOnly className="w-full bg-[#0a0a0a] border border-gray-700 rounded p-2 text-rodovar-yellow font-mono font-bold text-sm opacity-80" />
                            </div>
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-[10px] text-gray-500 uppercase mb-1">Status Atual</label>
                                <select value={status} onChange={e => setStatus(e.target.value as TrackingStatus)} className="w-full bg-[#121212] border border-gray-700 rounded p-2 text-white text-sm focus:border-rodovar-yellow">
                                    {Object.entries(StatusLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                                </select>
                            </div>
                             <div className="col-span-2 md:col-span-1">
                                <label className="block text-[10px] text-gray-500 uppercase mb-1">Motorista</label>
                                <div className="relative">
                                    <SteeringWheelIcon className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-500" />
                                    <select 
                                        value={selectedDriverId} 
                                        onChange={e => setSelectedDriverId(e.target.value)} 
                                        className="w-full bg-[#121212] border border-gray-700 rounded p-2 pl-9 text-white text-sm focus:border-rodovar-yellow appearance-none"
                                    >
                                        <option value="">-- Selecione --</option>
                                        {drivers.map(d => (
                                            <option key={d.id} value={d.id}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2: ROUTE & DATES */}
                    <div className="bg-black/20 p-4 rounded-lg border border-gray-800">
                         <h4 className="text-rodovar-yellow text-xs uppercase font-bold tracking-widest mb-3 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-rodovar-yellow rounded-full"></span> 2. Rota e Prazos
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] text-gray-500 uppercase mb-1">Cidade Origem</label>
                                <input value={origin} onChange={e => setOrigin(e.target.value)} placeholder="Ex: São Paulo" className="w-full bg-[#121212] border border-gray-700 rounded p-2 text-white text-sm focus:border-rodovar-yellow" />
                            </div>
                            <div>
                                <label className="block text-[10px] text-gray-500 uppercase mb-1">Cidade Destino</label>
                                <input value={destination} onChange={e => setDestination(e.target.value)} placeholder="Ex: Salvador" className="w-full bg-[#121212] border border-gray-700 rounded p-2 text-white text-sm focus:border-rodovar-yellow" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                             <div>
                                <label className="block text-[10px] text-gray-500 uppercase mb-1">Endereço Completo Destino</label>
                                <input value={destinationAddress} onChange={e => setDestinationAddress(e.target.value)} placeholder="Rua, Número, Bairro (Para Mapa)" className="w-full bg-[#121212] border border-gray-700 rounded p-2 text-white text-sm focus:border-rodovar-yellow" />
                             </div>
                             <div>
                                <label className="block text-[10px] text-gray-500 uppercase mb-1">Previsão de Entrega</label>
                                <input 
                                    type="date"
                                    value={estimatedDateInput} 
                                    onChange={e => setEstimatedDateInput(e.target.value)} 
                                    className="w-full bg-[#121212] border border-rodovar-yellow/50 rounded p-2 text-white text-sm focus:border-rodovar-yellow" 
                                />
                             </div>
                        </div>
                    </div>

                    {/* SECTION 3: CURRENT LOCATION */}
                    <div className="bg-black/20 p-4 rounded-lg border border-gray-800 relative">
                         <div className="flex justify-between items-center mb-3">
                             <h4 className="text-rodovar-yellow text-xs uppercase font-bold tracking-widest flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-rodovar-yellow rounded-full"></span> 3. Localização Atual
                             </h4>
                             <button type="button" onClick={handleGetDriverLocation} disabled={gpsLoading} className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded flex items-center gap-1 transition-colors">
                                 {gpsLoading ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <MapPinIcon className="w-3 h-3" />}
                                 {gpsLoading ? 'BUSCANDO...' : 'USAR MEU GPS'}
                             </button>
                         </div>
                        <div className="grid grid-cols-1 gap-3">
                            <div>
                                <label className="block text-[10px] text-gray-500 uppercase mb-1">Cidade Atual</label>
                                <input value={city} onChange={e => setCity(e.target.value)} className="w-full bg-[#121212] border border-gray-700 rounded p-2 text-white text-sm focus:border-rodovar-yellow" />
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-[10px] text-gray-500 uppercase mb-1">UF</label>
                                    <input value={state} onChange={e => setState(e.target.value)} maxLength={2} className="w-full bg-[#121212] border border-gray-700 rounded p-2 text-white text-sm uppercase focus:border-rodovar-yellow" />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[10px] text-gray-500 uppercase mb-1">Ponto de Referência</label>
                                    <input value={address} onChange={e => setAddress(e.target.value)} className="w-full bg-[#121212] border border-gray-700 rounded p-2 text-white text-sm focus:border-rodovar-yellow" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 4: DETAILS */}
                    <div className="space-y-4">
                        <div>
                             <label className="block text-[10px] text-gray-500 uppercase mb-1">Mensagem de Status (Pública)</label>
                             <input value={message} onChange={e => setMessage(e.target.value)} placeholder="Ex: Carga em trânsito" className="w-full bg-[#121212] border border-gray-700 rounded p-2 text-white text-sm focus:border-rodovar-yellow" />
                        </div>
                        <div>
                             <label className="block text-[10px] text-gray-500 uppercase mb-1">Notas Internas (Admin/Motorista)</label>
                             <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-[#121212] border border-gray-700 rounded p-2 text-white text-sm h-16 resize-none focus:border-rodovar-yellow" />
                        </div>
                    </div>

                    {isEditing && (
                        <div className="bg-blue-900/10 p-3 rounded border border-blue-900/30">
                             <h4 className="text-blue-400 text-xs font-bold mb-2 uppercase">Resumo Financeiro da Viagem</h4>
                             <div className="flex justify-between items-center">
                                 <p className="text-xs text-gray-400">Total Despesas Declaradas:</p>
                                 <span className="text-white font-bold text-lg">R$ {totalExpenses.toFixed(2)}</span>
                             </div>
                             {driverNotes && <p className="text-xs text-gray-500 mt-2 italic border-t border-gray-800 pt-2">Obs. Motorista: "{driverNotes}"</p>}
                        </div>
                    )}

                    <button type="submit" disabled={loading} className={`w-full font-bold py-4 rounded-lg shadow-lg text-sm tracking-widest uppercase transition-all hover:scale-[1.01] active:scale-[0.99] ${isEditing ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-rodovar-yellow text-black hover:bg-yellow-400'}`}>
                        {loading ? 'PROCESSANDO...' : isEditing ? 'SALVAR ALTERAÇÕES' : 'CADASTRAR CARGA'}
                    </button>
                </form>
            </div>

            <div className="xl:col-span-6 space-y-4">
                <div className="flex justify-between items-center bg-[#1E1E1E] p-4 rounded-lg border border-gray-800">
                    <h3 className="font-bold text-white text-lg">Cargas Ativas</h3>
                    <div className="relative w-48 md:w-64">
                        <SearchIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar carga, cidade ou motorista..." className="w-full bg-black/30 border border-gray-700 rounded-full py-2 pl-9 text-sm text-white focus:border-rodovar-yellow outline-none" />
                    </div>
                </div>
                <div className="max-h-[800px] overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                    {filteredShipments.map(s => (
                        <div key={s.code} className={`bg-[#1E1E1E] p-5 rounded-xl border border-gray-800 flex flex-col gap-3 transition-colors hover:border-gray-600 ${isEditing && code === s.code ? 'border-blue-500 ring-1 ring-blue-500' : ''}`}>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <span className="text-rodovar-yellow font-bold font-mono text-lg">{s.code}</span>
                                    {s.driverName && (
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700">
                                            <SteeringWheelIcon className="w-3 h-3 text-gray-400" />
                                            <span className="text-[10px] text-gray-300 font-bold uppercase">{s.driverName}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase border ${s.status === TrackingStatus.DELIVERED ? 'bg-green-900/20 border-green-800 text-green-400' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
                                        {StatusLabels[s.status]}
                                    </span>
                                    {s.isLive && (
                                        <span className="text-[9px] bg-red-600 text-white px-2 rounded-full animate-pulse font-bold">LIVE</span>
                                    )}
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 text-xs text-gray-400 my-1">
                                <div>
                                    <p className="uppercase text-[10px] text-gray-600 font-bold">Origem</p>
                                    <p className="text-white truncate">{s.origin}</p>
                                </div>
                                <div>
                                    <p className="uppercase text-[10px] text-gray-600 font-bold">Destino</p>
                                    <p className="text-white truncate">{s.destination}</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2 text-xs text-gray-400 bg-black/20 p-2 rounded">
                                <MapPinIcon className="w-3 h-3 text-blue-500" />
                                <span className="truncate">Atual: <span className="text-gray-300">{s.currentLocation.city} - {s.currentLocation.state}</span></span>
                            </div>

                            <div className="flex justify-between items-center pt-3 border-t border-gray-800 mt-1">
                                <span className="text-[10px] text-gray-600">Atualizado: {s.lastUpdate.split('-')[0]} {s.lastUpdatedBy ? `• Por ${s.lastUpdatedBy}` : ''}</span>
                                <div className="flex gap-2">
                                    <button onClick={() => handleEditShipment(s)} className="text-blue-400 hover:text-blue-300 text-xs font-bold uppercase px-3 py-1 bg-blue-900/10 rounded hover:bg-blue-900/20 transition-colors">Editar</button>
                                    <button onClick={() => handleDeleteShipment(s.code)} className="text-red-400 hover:text-red-300 text-xs font-bold uppercase px-3 py-1 bg-red-900/10 rounded hover:bg-red-900/20 transition-colors">Excluir</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      {/* --- ABA MOTORISTAS --- */}
      {activeTab === 'drivers' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[#1E1E1E] p-6 rounded-xl border border-gray-700 h-fit">
                  <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                      <SteeringWheelIcon className="w-6 h-6 text-rodovar-yellow" />
                      Cadastrar Motorista
                  </h3>
                  <form onSubmit={handleSaveDriver} className="space-y-4">
                      <div>
                          <label className="block text-xs text-gray-500 uppercase mb-1">Nome e Sobrenome</label>
                          <input 
                            value={newDriverName} 
                            onChange={e => setNewDriverName(e.target.value)} 
                            className="w-full bg-black/50 border border-gray-600 rounded p-3 text-white focus:border-rodovar-yellow outline-none" 
                            placeholder="Ex: João Silva" 
                          />
                      </div>
                      <div>
                          <label className="block text-xs text-gray-500 uppercase mb-1">Celular / WhatsApp (Apenas Números)</label>
                          <input 
                            type="tel"
                            value={newDriverPhone} 
                            onChange={e => setNewDriverPhone(e.target.value)} 
                            className="w-full bg-black/50 border border-gray-600 rounded p-3 text-white focus:border-rodovar-yellow outline-none" 
                            placeholder="Ex: 71999998888" 
                          />
                      </div>
                      <p className="text-xs text-gray-500 italic">Não é necessário criar senha. O motorista acessa apenas com o Código da Carga.</p>
                      {driverMsg && <p className="text-green-500 text-sm font-bold">{driverMsg}</p>}
                      <button type="submit" className="w-full bg-rodovar-yellow text-black font-bold py-3 rounded hover:bg-yellow-400 uppercase tracking-wide">
                          Cadastrar Motorista
                      </button>
                  </form>
              </div>

              <div className="bg-[#1E1E1E] p-6 rounded-xl border border-gray-700">
                  <h3 className="text-xl font-bold text-white mb-6">Equipe de Motoristas</h3>
                  <div className="space-y-3">
                      {drivers.length === 0 ? <p className="text-gray-500 italic">Nenhum motorista cadastrado.</p> : drivers.map(d => (
                          <div key={d.id} className="flex justify-between items-center bg-black/30 p-4 rounded-lg border border-gray-800">
                              <div className="flex items-center gap-3">
                                  <div className="bg-gray-800 p-2 rounded-full">
                                      <SteeringWheelIcon className="w-5 h-5 text-gray-400" />
                                  </div>
                                  <div>
                                      <p className="text-white font-bold">{d.name}</p>
                                      <div className="flex gap-2 text-xs text-gray-500">
                                          {d.phone && <span>Tel: {d.phone}</span>}
                                      </div>
                                  </div>
                              </div>
                              <div className="flex gap-2">
                                  {d.phone && (
                                      <button onClick={() => sendDriverLink(d)} className="text-green-500 hover:text-green-400 bg-green-900/20 px-2 py-1 rounded transition-colors" title="Enviar Link via WhatsApp">
                                          <WhatsAppIcon className="w-5 h-5" />
                                      </button>
                                  )}
                                  <button onClick={() => handleDeleteDriver(d.id)} className="text-red-500 hover:text-red-400 text-xs font-bold px-3 py-1 bg-red-900/10 rounded hover:bg-red-900/20 transition-colors">
                                      REMOVER
                                  </button>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* --- ABA USUÁRIOS ADMIN --- */}
      {activeTab === 'users' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {isAdmin ? (
                  <div className="bg-[#1E1E1E] p-6 rounded-xl border border-gray-700 h-fit">
                      <h3 className="text-xl font-bold text-white mb-6">Novo Administrador</h3>
                      <form onSubmit={handleSaveUser} className="space-y-4">
                          <div>
                            <label className="block text-xs text-gray-500 uppercase mb-1">Usuário</label>
                            <input value={newUsername} onChange={e => setNewUsername(e.target.value)} className="w-full bg-black/50 border border-gray-600 rounded p-3 text-white focus:border-rodovar-yellow outline-none" placeholder="Novo usuário admin" />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 uppercase mb-1">Senha</label>
                            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full bg-black/50 border border-gray-600 rounded p-3 text-white focus:border-rodovar-yellow outline-none" placeholder="Senha segura" />
                          </div>
                          {userMsg && <p className="text-green-500 text-sm font-bold">{userMsg}</p>}
                          <button type="submit" className="w-full bg-gray-700 text-white font-bold py-3 rounded hover:bg-gray-600 uppercase tracking-wide">Criar Admin</button>
                      </form>
                  </div>
              ) : (
                  <div className="bg-[#1E1E1E] p-6 rounded text-center text-gray-400 border border-gray-700">Acesso Restrito ao Admin Master</div>
              )}
              <div className="bg-[#1E1E1E] p-6 rounded-xl border border-gray-700">
                  <h3 className="text-xl font-bold text-white mb-6">Administradores</h3>
                  {users.map(u => (
                      <div key={u.username} className="flex justify-between items-center p-3 border-b border-gray-800 last:border-0">
                          <span className="text-gray-300 font-medium">{u.username}</span>
                          {isAdmin && u.username !== 'admin' && <button onClick={() => handleDeleteUser(u.username)} className="text-red-500 hover:text-red-300 text-xs font-bold">REMOVER</button>}
                      </div>
                  ))}
              </div>
          </div>
      )}

    </div>
  );
};

export default AdminPanel;