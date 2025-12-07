import React, { useState } from 'react';
import Mascot from './Mascot';
import { User, ShieldCheck, ArrowRight, Lock } from 'lucide-react';
import { UserRole } from '../types';

interface LoginScreenProps {
  onLogin: (role: UserRole) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '1234') {
      onLogin('admin');
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="min-h-dvh bg-slate-50 flex flex-col items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md flex flex-col items-center">
        <div className="mb-6 md:mb-8 flex flex-col items-center animate-float">
            <Mascot size={100} className="w-20 h-20 md:w-32 md:h-32" />
            <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mt-4 md:mt-6 tracking-tight">Antelito 3.0</h1>
            <p className="text-slate-500 mt-1 md:mt-2 text-sm md:text-base">Tu asistente inteligente corporativo</p>
        </div>

        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xl w-full border border-slate-100 transition-all">
            {!selectedRole ? (
            <div className="space-y-3 md:space-y-4">
                <p className="text-center text-slate-600 mb-4 md:mb-6 font-medium text-sm md:text-base">Selecciona tu perfil de acceso</p>
                
                <button
                onClick={() => onLogin('user')}
                className="w-full group relative flex items-center p-3 md:p-4 border border-slate-200 rounded-xl hover:border-yellow-400 hover:bg-yellow-50 transition-all text-left"
                >
                <div className="bg-slate-100 group-hover:bg-yellow-200 p-2 md:p-3 rounded-full mr-3 md:mr-4 transition-colors">
                    <User className="text-slate-600 group-hover:text-yellow-800" size={20} />
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 text-sm md:text-base">Usuario</h3>
                    <p className="text-xs text-slate-500">Acceso a consultas y biblioteca pública</p>
                </div>
                <ArrowRight className="absolute right-4 text-slate-300 group-hover:text-yellow-500 transition-colors" size={20} />
                </button>

                <button
                onClick={() => setSelectedRole('admin')}
                className="w-full group relative flex items-center p-3 md:p-4 border border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all text-left"
                >
                <div className="bg-slate-100 group-hover:bg-blue-200 p-2 md:p-3 rounded-full mr-3 md:mr-4 transition-colors">
                    <ShieldCheck className="text-slate-600 group-hover:text-blue-800" size={20} />
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 text-sm md:text-base">Administrador</h3>
                    <p className="text-xs text-slate-500">Gestión de base de datos y archivos</p>
                </div>
                <ArrowRight className="absolute right-4 text-slate-300 group-hover:text-blue-500 transition-colors" size={20} />
                </button>
            </div>
            ) : (
            <form onSubmit={handleAdminLogin} className="space-y-5 md:space-y-6">
                <div className="text-center">
                    <div className="bg-blue-100 p-2 md:p-3 rounded-full inline-block mb-3">
                        <Lock className="text-blue-600" size={20} />
                    </div>
                    <h3 className="text-lg md:text-xl font-bold text-slate-800">Acceso Administrativo</h3>
                    <p className="text-xs md:text-sm text-slate-500">Introduce la clave de seguridad</p>
                </div>

                <div className="space-y-2">
                    <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`w-full p-3 border rounded-xl outline-none focus:ring-2 transition-all text-center text-lg tracking-widest ${error ? 'border-red-300 ring-2 ring-red-100 bg-red-50' : 'border-slate-200 focus:border-blue-400 focus:ring-blue-100'}`}
                        placeholder="••••"
                        autoFocus
                    />
                    {error && <p className="text-xs text-red-500 text-center font-medium">Clave incorrecta</p>}
                </div>

                <div className="flex gap-3">
                    <button 
                        type="button"
                        onClick={() => { setSelectedRole(null); setPassword(''); setError(false); }}
                        className="flex-1 py-3 text-slate-500 font-medium hover:bg-slate-50 rounded-xl transition-colors text-sm md:text-base"
                    >
                        Volver
                    </button>
                    <button 
                        type="submit"
                        className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 active:scale-95 transition-all text-sm md:text-base"
                    >
                        Entrar
                    </button>
                </div>
            </form>
            )}
        </div>
        
        <p className="mt-8 text-[10px] md:text-xs text-slate-400">© 2024 Antelito AI - v3.0</p>
      </div>
    </div>
  );
};

export default LoginScreen;