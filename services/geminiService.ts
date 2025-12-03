import { TrackingData } from "../types";
import { getShipment, getCoordinatesForString, getShipmentByDriverPhone } from "./storageService";

export const fetchTrackingInfo = async (input: string): Promise<TrackingData> => {
  
  // Simula um pequeno delay de rede para feedback visual (loading spinner)
  await new Promise(resolve => setTimeout(resolve, 600));

  // Limpa o input
  const cleanInput = input.trim();
  const cleanInputUpper = cleanInput.toUpperCase();
  const digitsOnly = cleanInput.replace(/\D/g, '');

  let localData: TrackingData | null = null;

  // Lógica de Detecção:
  // Se tiver mais de 8 dígitos e só números, assume que é um telefone
  if (digitsOnly.length >= 8 && /^\d+$/.test(cleanInput)) {
      localData = await getShipmentByDriverPhone(digitsOnly);
  } else {
      // Caso contrário, busca por Código (RODO-XXX)
      localData = await getShipment(cleanInputUpper);
  }
  
  if (localData) {
    // Correção Retroativa: Se a carga já existe mas não tem coords de destino salvas, busca agora.
    if (!localData.destinationCoordinates && localData.destination) {
        try {
            const destCoords = await getCoordinatesForString(localData.destination);
            return { ...localData, destinationCoordinates: destCoords };
        } catch (e) {
            // Se falhar, retorna sem coords de destino
            return localData;
        }
    }
    return localData;
  }

  // 2. Se não existir, lançar erro específico
  throw new Error("RASTREAMENTO NÃO ENCONTRADO: Verifique se o código ou o celular do motorista está correto e se há uma viagem ativa.");
};