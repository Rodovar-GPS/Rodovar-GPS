import React, { useState } from 'react';
import { validateLogin } from '../services/storageService';

interface LoginPanelProps {
  onLoginSuccess: (username: string) => void;
  onCancel: () => void;
}

const LoginPanel: React.FC<LoginPanelProps> = ({ onLoginSuccess, onCancel }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
        const isValid = await validateLogin({ username, password });
        if (isValid) {
          onLoginSuccess(username);
        } else {
          setError('Usuário ou senha incorretos.');
        }
    } catch (err) {
        setError('Erro ao conectar ao sistema.');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-[fadeIn_0.3s]">
      <div className="w-full max-w-md bg-[#1E1E1E] border border-gray-700 rounded-xl p-8 shadow-2xl relative">
        <button 
            onClick={onCancel}
            className="absolute top-4 right-4 text-gray-500 hover:text-white"
        >
            ✕
        </button>
        
        <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white">Acesso Restrito</h2>
            <p className="text-gray-400 text-sm mt-1">Entre com suas credenciais administrativas</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs text-rodovar-yellow uppercase font-bold mb-2">Usuário</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-black/50 border border-gray-600 rounded-lg p-3 text-white focus:border-rodovar-yellow focus:ring-1 focus:ring-rodovar-yellow outline-none transition-all"
              placeholder="Digite seu usuário"
            />
          </div>

          <div>
            <label className="block text-xs text-rodovar-yellow uppercase font-bold mb-2">Senha</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/50 border border-gray-600 rounded-lg p-3 text-white focus:border-rodovar-yellow focus:ring-1 focus:ring-rodovar-yellow outline-none transition-all"
              placeholder="Digite sua senha"
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center font-bold bg-red-900/20 py-2 rounded">
              {error}
            </div>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-rodovar-yellow text-black font-bold py-3 rounded-lg hover:bg-yellow-400 transition-colors shadow-[0_0_10px_rgba(255,215,0,0.2)] disabled:opacity-50"
          >
            {loading ? 'VERIFICANDO...' : 'ENTRAR NO SISTEMA'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPanel;