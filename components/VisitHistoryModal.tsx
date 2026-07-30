import React, { useState } from 'react';
import { VisitStats, VisitLogEntry } from '../types';
import { X, History, Search, Calendar, Clock, RotateCcw, Download, ShieldCheck, UserCheck, Smartphone, Monitor, Globe, Info } from 'lucide-react';

interface VisitHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  visitStats: VisitStats;
  onResetVisits?: () => void;
}

const VisitHistoryModal: React.FC<VisitHistoryModalProps> = ({
  isOpen,
  onClose,
  visitStats,
  onResetVisits
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSessionOnly, setFilterSessionOnly] = useState(false);
  const [showMacInfo, setShowMacInfo] = useState(false);

  if (!isOpen) return null;

  const history = Array.isArray(visitStats.history) ? visitStats.history : [];

  // Filter history
  const filteredHistory = history.filter((entry) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      entry.dateStr.toLowerCase().includes(term) ||
      entry.timeStr.toLowerCase().includes(term) ||
      (entry.deviceInfo && entry.deviceInfo.toLowerCase().includes(term)) ||
      (entry.ip && entry.ip.toLowerCase().includes(term)) ||
      (entry.browser && entry.browser.toLowerCase().includes(term)) ||
      (entry.os && entry.os.toLowerCase().includes(term)) ||
      (entry.location && entry.location.toLowerCase().includes(term)) ||
      (entry.screenRes && entry.screenRes.toLowerCase().includes(term));
    const matchesSession = filterSessionOnly ? entry.isNewSession : true;
    return matchesSearch && matchesSession;
  });

  const formatRelativeTime = (timestamp: number) => {
    const diffSeconds = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSeconds < 60) return 'Hace un momento';
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `Hace ${diffMinutes} min`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `Hace ${diffHours} h`;
    const diffDays = Math.floor(diffHours / 24);
    return `Hace ${diffDays} d`;
  };

  const handleExportCSV = () => {
    if (history.length === 0) return;
    const headers = 'ID,Fecha,Hora,IP,Dispositivo,Navegador,Ubicacion,Pantalla,Idioma,Timestamp,Tipo\n';
    const rows = history
      .map(
        (item) =>
          `"${item.id}","${item.dateStr}","${item.timeStr}","${item.ip || 'Desconocida'}","${item.deviceInfo || item.os || 'Desconocido'}","${
            item.browser || 'Web'
          }","${item.location || 'Desconocida'}","${item.screenRes || 'N/A'}","${item.language || 'es'}",${item.timestamp},"${
            item.isNewSession ? 'Nueva Sesión' : 'Recarga/Navegación'
          }"`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historial_visitas_antelito_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 md:p-5 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 border border-blue-400/30 rounded-xl text-blue-300">
              <History size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">Registro Global de Visitas</h3>
                <span className="px-2 py-0.5 bg-blue-500/30 text-blue-200 text-[10px] font-bold rounded-full uppercase tracking-wider border border-blue-400/30">
                  Panel Admin
                </span>
              </div>
              <p className="text-xs text-slate-300">Conexiones multiterminal en tiempo real (IP, Dispositivo, Hora y Fecha)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
            title="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Quick Stats Grid */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-3 gap-3">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Total Visitas</span>
            <span className="text-2xl font-black text-blue-600 mt-0.5">{visitStats.totalVisits}</span>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Sesiones Únicas</span>
            <span className="text-2xl font-black text-indigo-600 mt-0.5">{visitStats.sessionVisits || 1}</span>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
            <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Último Ingreso</span>
            <span className="text-xs font-bold text-slate-700 mt-1 truncate">
              {new Date(visitStats.lastVisit).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className="text-[10px] text-slate-500">
              {new Date(visitStats.lastVisit).toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Filter & Search Controls */}
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-white">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por IP, fecha, hora o dispositivo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-100 focus:bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterSessionOnly(!filterSessionOnly)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                filterSessionOnly
                  ? 'bg-blue-50 border-blue-300 text-blue-700 font-bold'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <UserCheck size={13} />
              <span>Nuevas sesiones</span>
            </button>

            {history.length > 0 && (
              <button
                onClick={handleExportCSV}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                title="Exportar como CSV"
              >
                <Download size={13} />
                <span className="hidden sm:inline">Exportar CSV</span>
              </button>
            )}
          </div>
        </div>

        {/* MAC / Protocol Info Notice */}
        <div className="px-4 py-2 bg-amber-50/70 border-b border-amber-200/60 flex items-center justify-between text-[11px] text-amber-900">
          <div className="flex items-center gap-1.5">
            <Info size={13} className="text-amber-600 shrink-0" />
            <span>
              <strong>IP & Dispositivo capturados.</strong> Las direcciones MAC no son accesibles mediante HTTP por seguridad del navegador.
            </span>
          </div>
          <button
            onClick={() => setShowMacInfo(!showMacInfo)}
            className="text-[10px] font-bold text-amber-700 underline hover:text-amber-900 shrink-0"
          >
            {showMacInfo ? 'Ocultar info' : 'saber más'}
          </button>
        </div>

        {showMacInfo && (
          <div className="px-4 py-2.5 bg-slate-800 text-slate-200 text-[11px] space-y-1 border-b border-slate-700">
            <p className="font-semibold text-white">📌 Nota sobre la dirección MAC en aplicaciones Web:</p>
            <p className="text-slate-300 leading-relaxed">
              Las direcciones MAC operan en la capa física de red local (Capa 2 del modelo OSI) y son eliminadas por los routers al navegar por internet. Por motivos de privacidad y seguridad, las especificaciones de la W3C impiden que los navegadores web lean el hardware MAC de los usuarios. Sin embargo, registramos con precisión la <strong>IP pública/local, el sistema operativo, navegador y tipo de dispositivo</strong>.
            </p>
          </div>
        )}

        {/* History Table / List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredHistory.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <History size={36} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">No hay registros de visitas encontrados</p>
              {searchTerm && <p className="text-xs text-slate-400 mt-1">Prueba cambiando los términos de búsqueda</p>}
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredHistory.map((item, idx) => {
                const visitNumber = visitStats.totalVisits - (history.indexOf(item) !== -1 ? history.indexOf(item) : idx);
                const isMobile = item.deviceInfo?.toLowerCase().includes('android') || item.deviceInfo?.toLowerCase().includes('iphone') || item.deviceInfo?.toLowerCase().includes('ipad');

                return (
                  <div
                    key={item.id || idx}
                    className="p-3 bg-white hover:bg-slate-50 rounded-xl border border-slate-200/80 shadow-2xs flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 transition-colors text-xs"
                  >
                    <div className="flex items-start sm:items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 font-extrabold flex items-center justify-center text-xs shrink-0 mt-0.5 sm:mt-0">
                        #{visitNumber}
                      </div>
                      <div>
                        {/* Date and Time */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-800 flex items-center gap-1">
                            <Calendar size={12} className="text-slate-400" />
                            {item.dateStr}
                          </span>
                          <span className="font-semibold text-blue-600 flex items-center gap-1 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 text-[11px]">
                            <Clock size={11} className="text-blue-500" />
                            {item.timeStr}
                          </span>
                        </div>

                        {/* Badges: Relative time, session, device, IP */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] text-slate-400 font-medium">
                            {formatRelativeTime(item.timestamp)}
                          </span>

                          {item.isNewSession && (
                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full">
                              Nueva Sesión
                            </span>
                          )}

                          {/* IP Address Badge */}
                          <span className="text-[10px] font-mono font-bold text-slate-800 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <Globe size={11} className="text-indigo-500" />
                            <span>IP: {item.ip || '127.0.0.1'}</span>
                          </span>

                          {/* Device / OS Info Badge */}
                          {(item.deviceInfo || item.os) && (
                            <span className="text-[10px] font-medium text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                              {isMobile ? <Smartphone size={11} className="text-indigo-500" /> : <Monitor size={11} className="text-slate-600" />}
                              <span>{item.deviceInfo || `${item.os} (${item.browser || 'Web'})`}</span>
                            </span>
                          )}

                          {/* Location / Timezone Badge */}
                          {item.location && (
                            <span className="text-[10px] text-amber-900 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                              <span>📍 {item.location}</span>
                            </span>
                          )}

                          {/* Screen Resolution Badge */}
                          {item.screenRes && item.screenRes !== 'No especificada' && (
                            <span className="text-[10px] font-mono text-slate-600 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <span>📐 {item.screenRes}</span>
                            </span>
                          )}

                          {/* Language Badge */}
                          {item.language && (
                            <span className="text-[10px] uppercase font-bold text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">
                              🗣️ {item.language}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 self-end sm:self-center">
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(item.timestamp).toISOString().slice(11, 19)} UTC
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>Servidor Centralizado: Registro activo de IP, fecha, hora y dispositivo.</span>
          </div>

          <div className="flex items-center gap-2">
            {onResetVisits && (
              <button
                onClick={() => {
                  if (confirm('¿Estás seguro de que deseas reiniciar todo el contador e historial de visitas?')) {
                    onResetVisits();
                    onClose();
                  }
                }}
                className="px-3 py-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1 font-semibold"
              >
                <RotateCcw size={12} />
                <span>Reiniciar historial</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisitHistoryModal;
