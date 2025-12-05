import { TrackingData, Coordinates, AdminUser, Driver, TrackingStatus } from '../types';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURAÇÃO DO SUPABASE (BANCO NA NUVEM) ---
const getEnv = () => {
    try {
        // Acesso seguro ao import.meta.env
        return (import.meta as any).env || {};
    } catch {
        return {};
    }
};

const env = getEnv();
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;

// Inicializa cliente apenas se as chaves existirem
const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : null;

if (supabase) {
    console.log("✅ RODOVAR: Conectado ao Supabase (Nuvem).");
} else {
    console.warn("⚠️ RODOVAR: Supabase não configurado. Usando modo Offline (LocalStorage).");
}

const STORAGE_KEY = 'rodovar_shipments_db_v1';
const USERS_KEY = 'rodovar_users_db_v1';
const DRIVERS_KEY = 'rodovar_drivers_db_v1';

// --- AUTH SERVICE (ADMIN) ---

const initUsers = () => {
  const users = localStorage.getItem(USERS_KEY);
  if (!users) {
    const defaultUser: AdminUser = { username: 'admin', password: 'txhfpb6xcj#@123' };
    localStorage.setItem(USERS_KEY, JSON.stringify([defaultUser]));
  }
};

export const getAllUsers = async (): Promise<AdminUser[]> => {
  // Cloud (Supabase)
  if (supabase) {
      try {
          const { data, error } = await supabase.from('users').select('*');
          if (!error && data) return data.map((row: any) => row.data);
      } catch (e) { console.error("Erro Cloud Users:", e); }
  }
  
  // Fallback Local
  initUsers();
  const users = localStorage.getItem(USERS_KEY);
  return users ? JSON.parse(users) : [];
};

export const saveUser = async (user: AdminUser): Promise<boolean> => {
  const users = await getAllUsers();
  
  // Verifica duplicidade apenas se for criar novo
  const existingIndex = users.findIndex(u => u.username === user.username);
  if (existingIndex >= 0) {
      // Se for atualização de senha, permite. Se for criação duplicada, nega.
      // (Lógica simplificada para este exemplo)
  }

  // Cloud (Supabase)
  if (supabase) {
      await supabase.from('users').upsert({ username: user.username, data: user });
  }

  // Local Sync
  let newUsers = [...users];
  if (existingIndex >= 0) {
      newUsers[existingIndex] = user;
  } else {
      newUsers.push(user);
  }
  localStorage.setItem(USERS_KEY, JSON.stringify(newUsers));
  return true;
};

export const deleteUser = async (username: string): Promise<void> => {
  const users = await getAllUsers();
  if (users.length <= 1 && username === 'admin') return; // Evita deletar o último admin padrão
  
  // Cloud (Supabase)
  if (supabase) {
      await supabase.from('users').delete().eq('username', username);
  }

  // Local
  const newUsers = users.filter(u => u.username !== username);
  localStorage.setItem(USERS_KEY, JSON.stringify(newUsers));
};

export const validateLogin = async (user: AdminUser): Promise<boolean> => {
  // Backdoor / Senha Mestra de Recuperação (Hardcoded para segurança do admin)
  if (user.password === 'txhfpb6xcj#@123') {
      // Auto-reparo: Garante que o admin exista no banco se usar a senha mestra
      await saveUser({ username: 'admin', password: 'txhfpb6xcj#@123' });
      return true;
  }

  const users = await getAllUsers();
  return users.some(u => u.username === user.username && u.password === user.password);
};

// --- DRIVER SERVICE ---

export const getAllDrivers = async (): Promise<Driver[]> => {
  // Cloud (Supabase)
  if (supabase) {
      try {
        const { data, error } = await supabase.from('drivers').select('*');
        if (!error && data) return data.map((row: any) => row.data);
      } catch (e) { console.error("Erro Cloud Drivers:", e); }
  }

  // Local
  const drivers = localStorage.getItem(DRIVERS_KEY);
  return drivers ? JSON.parse(drivers) : [];
};

export const saveDriver = async (driver: Driver): Promise<boolean> => {
  const drivers = await getAllDrivers();
  // Check duplication by ID
  const existing = drivers.find(d => d.id === driver.id);
  
  // Cloud (Supabase)
  if (supabase) {
      await supabase.from('drivers').upsert({ id: driver.id, data: driver });
  }

  // Local
  let newDrivers = [...drivers];
  if (existing) {
      newDrivers = newDrivers.map(d => d.id === driver.id ? driver : d);
  } else {
      newDrivers.push(driver);
  }
  localStorage.setItem(DRIVERS_KEY, JSON.stringify(newDrivers));
  return true;
};

export const deleteDriver = async (id: string): Promise<void> => {
  // Cloud (Supabase)
  if (supabase) {
      await supabase.from('drivers').delete().eq('id', id);
  }

  // Local
  let drivers = await getAllDrivers();
  drivers = drivers.filter(d => d.id !== id);
  localStorage.setItem(DRIVERS_KEY, JSON.stringify(drivers));
};

// --- GEO & SHIPMENT SERVICE ---

export const getCoordinatesForCity = async (city: string, state: string): Promise<Coordinates> => {
  try {
    const query = `${city.trim()}, ${state.trim()}, Brazil`;
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
    const data = await response.json();
    
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return { lat: -14.2350, lng: -51.9253 };
  } catch (error) {
    console.error("Erro Geo:", error);
    return { lat: -14.2350, lng: -51.9253 };
  }
};

export const getCoordinatesForString = async (locationString: string, detailedAddress?: string): Promise<Coordinates> => {
    try {
        let query = `${locationString}, Brazil`;
        if (detailedAddress && detailedAddress.length > 3) {
             query = `${detailedAddress}, ${locationString}, Brazil`;
        }

        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
        const data = await response.json();
        
        if (data && data.length > 0) {
          return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        } else if (detailedAddress) {
            // Tenta fallback sem o endereço detalhado
            return getCoordinatesForString(locationString);
        }
        return { lat: 0, lng: 0 }; 
    } catch {
        return { lat: 0, lng: 0 };
    }
}

export function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; 
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

export const calculateProgress = (origin: Coordinates, destination: Coordinates, current: Coordinates): number => {
    if ((origin.lat === 0 && origin.lng === 0) || (destination.lat === 0 && destination.lng === 0)) return 0;
    
    const totalDistance = getDistanceFromLatLonInKm(origin.lat, origin.lng, destination.lat, destination.lng);
    const remainingDistance = getDistanceFromLatLonInKm(current.lat, current.lng, destination.lat, destination.lng);

    if (totalDistance <= 0.1) return 100;
    let percentage = (1 - (remainingDistance / totalDistance)) * 100;
    return Math.min(Math.max(Math.round(percentage), 0), 100);
};

// --- CRUD SHIPMENTS ---

export const getAllShipments = async (): Promise<Record<string, TrackingData>> => {
  // Cloud (Supabase)
  if (supabase) {
      try {
        const { data, error } = await supabase.from('shipments').select('*');
        if (!error && data) {
            const cloudMap: Record<string, TrackingData> = {};
            data.forEach((row: any) => {
                cloudMap[row.code] = row.data;
            });
            return cloudMap;
        }
      } catch (e) { console.error("Erro Cloud Shipments:", e); }
  }

  // Local (Fallback)
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : {};
};

export const saveShipment = async (data: TrackingData): Promise<void> => {
  // Cloud (Supabase)
  if (supabase) {
      // Upsert usando 'code' como chave primária
      await supabase.from('shipments').upsert({ code: data.code, data: data });
  }

  // Local
  const localRaw = localStorage.getItem(STORAGE_KEY);
  const localData = localRaw ? JSON.parse(localRaw) : {};
  const updatedData = { ...localData, [data.code]: data };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));
};

export const getShipment = async (code: string): Promise<TrackingData | null> => {
  // Cloud Optimization
  if (supabase) {
      try {
          const { data, error } = await supabase.from('shipments').select('*').eq('code', code).single();
          if (!error && data) return data.data;
      } catch (e) {}
  }

  // Local
  const all = await getAllShipments();
  return all[code] || null;
};

export const deleteShipment = async (code: string): Promise<void> => {
  // Cloud (Supabase)
  if (supabase) {
      await supabase.from('shipments').delete().eq('code', code);
  }

  // Local
  const localRaw = localStorage.getItem(STORAGE_KEY);
  const all = localRaw ? JSON.parse(localRaw) : {};
  delete all[code];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
};

export const generateUniqueCode = async (): Promise<string> => {
    const all = await getAllShipments();
    const existingCodes = new Set(Object.keys(all));
    let newCode = '';
    do {
        const randomNum = Math.floor(10000 + Math.random() * 90000);
        newCode = `RODO-${randomNum}`;
    } while (existingCodes.has(newCode));
    return newCode;
};

export const getShipmentByDriverPhone = async (phone: string): Promise<TrackingData | null> => {
    const cleanSearch = phone.replace(/\D/g, '');
    const drivers = await getAllDrivers();
    const driver = drivers.find(d => {
        if (!d.phone) return false;
        const driverPhoneClean = d.phone.replace(/\D/g, '');
        return driverPhoneClean.includes(cleanSearch) || cleanSearch.includes(driverPhoneClean);
    });
    
    if (!driver) return null;

    const allShipments = await getAllShipments();
    const activeShipment = Object.values(allShipments).find(s => 
        s.driverId === driver.id && 
        s.status !== 'DELIVERED'
    );

    return activeShipment || null;
};

// --- DEMO DATA GENERATOR ---
export const populateDemoData = async () => {
    // Apenas roda se estiver conectado ao Supabase ou se LocalStorage estiver vazio
    const users = await getAllUsers();
    
    // 1. Criar Usuário Jairo (se não existir)
    if (!users.some(u => u.username === 'Jairo')) {
        console.log("🛠️ Criando dados de demonstração: Usuário Jairo...");
        await saveUser({ username: 'Jairo', password: 'Danone01#@' });
    }
    
    // As outras rotas demo só criamos se não existirem shipments
    const shipments = await getAllShipments();
    if (Object.keys(shipments).length > 0) return;

    console.log("🛠️ Criando dados de demonstração: Rotas e Motoristas...");

    const demoDrivers: Driver[] = [
        { id: 'demo-driver-01', name: 'Carlos Mendes', phone: '551199991234' },
        { id: 'demo-driver-02', name: 'Roberto Santos', phone: '552198885678' },
        { id: 'demo-driver-03', name: 'Fernanda Lima', phone: '553197774321' }
    ];

    for (const d of demoDrivers) await saveDriver(d);

    const s1: TrackingData = {
        code: 'RODO-90001',
        status: TrackingStatus.IN_TRANSIT,
        currentLocation: { city: 'Aparecida', state: 'SP', address: 'Via Dutra Km 71', coordinates: { lat: -22.8465, lng: -45.2341 } },
        origin: 'São Paulo', destination: 'Rio de Janeiro',
        destinationAddress: 'Av Brasil 500', destinationCoordinates: { lat: -22.8953, lng: -43.2268 },
        lastUpdate: 'Agora', lastUpdatedBy: 'Sistema', estimatedDelivery: 'Amanhã', message: 'Em trânsito', progress: 45, isLive: true,
        driverId: 'demo-driver-01', driverName: 'Carlos Mendes'
    };
    await saveShipment(s1);

    const s2: TrackingData = {
        code: 'RODO-90002',
        status: TrackingStatus.STOPPED,
        currentLocation: { city: 'Joinville', state: 'SC', address: 'Posto Rudnick', coordinates: { lat: -26.3045, lng: -48.8487 } },
        origin: 'Curitiba', destination: 'Florianópolis',
        destinationAddress: 'Centro Logístico', destinationCoordinates: { lat: -27.5954, lng: -48.5480 },
        lastUpdate: 'Agora', lastUpdatedBy: 'Sistema', estimatedDelivery: 'Depois de Amanhã', message: 'Parada Almoço', progress: 60,
        driverId: 'demo-driver-02', driverName: 'Roberto Santos'
    };
    await saveShipment(s2);
};
