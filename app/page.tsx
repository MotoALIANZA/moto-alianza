'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '51999000000';
const SHEET_URL = process.env.NEXT_PUBLIC_SHEET_URL || '';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

type Point = { lat: number; lng: number; address: string };
type Cotizacion = {
  precio_usd: number;
  precio_bs: number | null;
  tasa_bs: number | null;
  distancia_km: number;
  duracion_minutos: number;
  precio_km: number;
  tipo_servicio: string;
  whatsapp_text: string;
  route_geometry: any;
};

function getL() {
  return typeof window !== 'undefined' ? (window as any).L : null;
}

export default function Home() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerOrigen = useRef<any>(null);
  const markerDestino = useRef<any>(null);
  const routeLine = useRef<any>(null);

  const [origen, setOrigen] = useState<Point | null>(null);
  const [destino, setDestino] = useState<Point | null>(null);
  const [clickMode, setClickMode] = useState<'origen' | 'destino'>('origen');
  const [servicio, setServicio] = useState('moto');
  const servicioRef = useRef('moto');
  const [metodoPago, setMetodoPago] = useState('movil');
  const [cotizacion, setCotizacion] = useState<Cotizacion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cotizacionActiva, setCotizacionActiva] = useState(false);
  const [origenInput, setOrigenInput] = useState('');
  const [destinoInput, setDestinoInput] = useState('');
  const [origenDropdown, setOrigenDropdown] = useState<any[]>([]);
  const [destinoDropdown, setDestinoDropdown] = useState<any[]>([]);
  const [showOrigenDD, setShowOrigenDD] = useState(false);
  const [showDestinoDD, setShowDestinoDD] = useState(false);
  const [searchingOrigen, setSearchingOrigen] = useState(false);
  const [searchingDestino, setSearchingDestino] = useState(false);
  const [locating, setLocating] = useState<'origen' | 'destino' | null>(null);
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteTelefono, setClienteTelefono] = useState('');
  const [online, setOnline] = useState(true);
  const [showZonas, setShowZonas] = useState(false);
  const [zonasLoading, setZonasLoading] = useState<string | null>(null);
  const [showCliente, setShowCliente] = useState(false);
  const [showLanding, setShowLanding] = useState(true);

  // Estado del servicio (6 AM - 3 AM)
  const checkOnline = useCallback(() => {
    const h = new Date().getHours();
    setOnline(!(h >= 3 && h < 6));
  }, []);
  useEffect(() => {
    checkOnline();
    const id = setInterval(checkOnline, 60000);
    return () => clearInterval(id);
  }, [checkOnline]);

  // Inicializar mapa
  useEffect(() => {
    const L = getL();
    if (!L || !mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([10.1621, -68.0070], 14);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    }).addTo(map);

    map.on('click', (e: any) => {
      const { lat, lng } = e.latlng;
      if (clickModeRef.current === 'origen') {
        setOrigen({ lat, lng, address: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
        setOrigenInput(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        reverseGeocodeRef.current(lat, lng, 'origen');
        setClickMode('destino');
        clickModeRef.current = 'destino';
      } else {
        setDestino({ lat, lng, address: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
        setDestinoInput(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        reverseGeocodeRef.current(lat, lng, 'destino');
        setClickMode('origen');
        clickModeRef.current = 'origen';
      }
    });

    mapInstance.current = map;

    // Auto-detect location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          setOrigen({ lat, lng, address: 'Tu ubicación actual' });
          setOrigenInput('Tu ubicación actual');
          reverseGeocodeRef.current(lat, lng, 'origen');
          map.setView([lat, lng], 15);
          setClickMode('destino');
          clickModeRef.current = 'destino';
        },
        () => {}
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refs for callbacks
  const clickModeRef = useRef(clickMode);
  clickModeRef.current = clickMode;

  const origeRef = useRef(origen);
  origeRef.current = origen;
  const destinRef = useRef(destino);
  destinRef.current = destino;

  const cotActRef = useRef(cotizacionActiva);
  cotActRef.current = cotizacionActiva;

  // Reverse Geocode ref
  const revTO = useRef<any>(null);
  const reverseGeocodeRef = useRef<(lat: number, lng: number, type: 'origen' | 'destino') => void>(() => {});
  reverseGeocodeRef.current = (lat, lng, type) => {
    clearTimeout(revTO.current);
    revTO.current = setTimeout(async () => {
      try {
        const r = await fetch(`${NOMINATIM_URL}/reverse?lat=${lat}&lon=${lng}&format=json`);
        const d = await r.json();
        const addr = d.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        if (type === 'origen') {
          setOrigenInput(addr);
          origeRef.current && setOrigen({ ...origeRef.current!, address: addr });
        } else {
          setDestinoInput(addr);
          destinRef.current && setDestino({ ...destinRef.current!, address: addr });
        }
      } catch {}
    }, 300);
  };

  // Actualizar marcadores
  useEffect(() => {
    const L = getL();
    if (!L || !mapInstance.current) return;
    const map = mapInstance.current;

    if (markerOrigen.current) map.removeLayer(markerOrigen.current);
    if (markerDestino.current) map.removeLayer(markerDestino.current);

    if (origen) {
      markerOrigen.current = L.marker([origen.lat, origen.lng], {
        icon: L.divIcon({
          html: '<div style="background:white;border:2px solid #22c55e;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;color:#22c55e;box-shadow:0 2px 6px rgba(0,0,0,0.3)">O</div>',
          iconSize: [30, 30], iconAnchor: [15, 15], className: '',
        }),
        draggable: true,
      }).addTo(map);
      markerOrigen.current.on('dragend', () => {
        const p = markerOrigen.current.getLatLng();
        setOrigen({ lat: p.lat, lng: p.lng, address: origen.address });
        reverseGeocodeRef.current(p.lat, p.lng, 'origen');
        autoRecalcularRef.current();
      });
    }

    if (destino) {
      markerDestino.current = L.marker([destino.lat, destino.lng], {
        icon: L.divIcon({
          html: '<div style="background:white;border:2px solid #ef4444;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;color:#ef4444;box-shadow:0 2px 6px rgba(0,0,0,0.3)">D</div>',
          iconSize: [30, 30], iconAnchor: [15, 15], className: '',
        }),
        draggable: true,
      }).addTo(map);
      markerDestino.current.on('dragend', () => {
        const p = markerDestino.current.getLatLng();
        setDestino({ lat: p.lat, lng: p.lng, address: destino.address });
        reverseGeocodeRef.current(p.lat, p.lng, 'destino');
        autoRecalcularRef.current();
      });
    }

    const pts: [number, number][] = [];
    if (origen) pts.push([origen.lat, origen.lng]);
    if (destino) pts.push([destino.lat, destino.lng]);
    if (pts.length === 2) map.fitBounds(L.latLngBounds(pts), { padding: [50, 50] });
    else if (pts.length === 1) map.setView(pts[0], 15);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origen, destino]);

  // Ruta en mapa
  useEffect(() => {
    const L = getL();
    if (!L || !mapInstance.current || !cotizacion?.route_geometry) return;
    const map = mapInstance.current;
    if (routeLine.current) map.removeLayer(routeLine.current);
    routeLine.current = L.geoJSON(cotizacion.route_geometry, {
      style: { color: '#c9a94e', weight: 5, opacity: 0.85 },
    }).addTo(map);
    map.fitBounds(routeLine.current.getBounds(), { padding: [50, 50] });
  }, [cotizacion]);

  // Auto-recalcular
  const fetchCotRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const autoRecalcularRef = useRef(() => {});
  autoRecalcularRef.current = () => {
    if (cotActRef.current && origeRef.current && destinRef.current) {
      fetchCotRef.current();
    }
  };

  // Autocomplete handlers
  const searchTO = useRef<any>(null);
  function handleSearchInput(value: string, type: 'origen' | 'destino') {
    if (type === 'origen') setOrigenInput(value);
    else setDestinoInput(value);
    clearTimeout(searchTO.current);
    if (value.trim().length < 3) {
      type === 'origen' ? setShowOrigenDD(false) : setShowDestinoDD(false);
      return;
    }
    if (type === 'origen') setSearchingOrigen(true); else setSearchingDestino(true);
    searchTO.current = setTimeout(async () => {
      try {
        const r = await fetch(`${NOMINATIM_URL}/search?q=${encodeURIComponent(value)}&format=json&limit=5`);
        const data = await r.json();
        if (type === 'origen') { setOrigenDropdown(data); setShowOrigenDD(data.length > 0); }
        else { setDestinoDropdown(data); setShowDestinoDD(data.length > 0); }
      } catch {
        type === 'origen' ? setShowOrigenDD(false) : setShowDestinoDD(false);
      }
      if (type === 'origen') setSearchingOrigen(false); else setSearchingDestino(false);
    }, 400);
  }

  function selectAddress(item: any, type: 'origen' | 'destino') {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    const willHaveBoth = type === 'origen' ? !!destinRef.current : !!origeRef.current;
    if (type === 'origen') {
      setOrigen({ lat, lng, address: item.display_name });
      setOrigenInput(item.display_name);
      setShowOrigenDD(false);
    } else {
      setDestino({ lat, lng, address: item.display_name });
      setDestinoInput(item.display_name);
      setShowDestinoDD(false);
    }
    mapInstance.current?.setView([lat, lng], 16);
    if (willHaveBoth) setTimeout(fetchCotizacion, 100);
  }

  // Geolocation
  function setCurrentLocation(target: 'origen' | 'destino') {
    if (!navigator.geolocation) { setError('Tu navegador no soporta geolocalización.'); return; }
    setLocating(target);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(null);
        const { latitude: lat, longitude: lng } = pos.coords;
        const willHaveBoth = target === 'origen' ? !!destinRef.current : !!origeRef.current;
        if (target === 'origen') {
          setOrigen({ lat, lng, address: 'Tu ubicación actual' });
          setOrigenInput('Tu ubicación actual');
          reverseGeocodeRef.current(lat, lng, 'origen');
        } else {
          setDestino({ lat, lng, address: 'Tu ubicación actual' });
          setDestinoInput('Tu ubicación actual');
          reverseGeocodeRef.current(lat, lng, 'destino');
        }
        mapInstance.current?.setView([lat, lng], 16);
        if (willHaveBoth) setTimeout(fetchCotizacion, 100);
      },
      () => { setLocating(null); setError('No se pudo obtener tu ubicación.'); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // Calcular
  const fetchCotizacion = async () => {
    setError('');
    if (!origen) { setError('Seleccioná un origen.'); return; }
    if (!destino) { setError('Seleccioná un destino.'); return; }
    setLoading(true);
    try {
      const r = await fetch('/api/cotizar/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat_origen: origen.lat, lon_origen: origen.lng,
          lat_destino: destino.lat, lon_destino: destino.lng,
          tipo_servicio: servicioRef.current, nombre: clienteNombre,
          telefono: clienteTelefono, metodo_pago: metodoPago,
          direccion_origen: origenInput, direccion_destino: destinoInput,
        }),
      });
      const data = await r.json();
      if (data.error) { setError(data.error); return; }
      setCotizacion(data);
      setCotizacionActiva(true);
      setTimeout(() => document.getElementById('resultado')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
    } catch { setError('Error de conexión.'); }
    finally { setLoading(false); }
  };
  fetchCotRef.current = fetchCotizacion;

  function handleServicioChange(val: string) {
    servicioRef.current = val;
    setServicio(val);
    if (cotizacionActiva && origen && destino) setTimeout(fetchCotizacion, 0);
  }

  const ZONAS = [
    'Naguanagua', 'San Diego', 'El Trigal', 'La Viña', 'Prebo',
    'Centro de Valencia', 'La Isabelica', 'Mañongo', 'Camoruco',
    'Ciudad Alianza', 'Guacara', 'Los Guayos',
  ];

  async function handleZonaClick(zona: string) {
    setZonasLoading(zona);
    const queryMap: Record<string, string> = {
      'Ciudad Alianza': 'Ciudad Alianza, Guacara, Carabobo, Venezuela',
    };
    const q = queryMap[zona] || `${zona}, Valencia, Venezuela`;
    try {
      const r = await fetch(`${NOMINATIM_URL}/search?q=${encodeURIComponent(q)}&format=json&limit=1`);
      const data = await r.json();
      if (!data.length) return;
      const { lat, lon, display_name } = data[0];
      const pt = { lat: parseFloat(lat), lng: parseFloat(lon), address: display_name };
      const target = clickModeRef.current;
      const willHaveBoth = target === 'origen' ? !!destinRef.current : !!origeRef.current;
      if (target === 'origen') {
        setOrigen(pt);
        setOrigenInput(display_name);
        setClickMode('destino');
        clickModeRef.current = 'destino';
      } else {
        setDestino(pt);
        setDestinoInput(display_name);
        setClickMode('origen');
        clickModeRef.current = 'origen';
      }
      mapInstance.current?.setView([parseFloat(lat), parseFloat(lon)], 15);
      if (willHaveBoth) setTimeout(fetchCotizacion, 100);
    } catch {}
    setZonasLoading(null);
  }

  function formatBs(n: number) {
    return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function formatTiempo(mins: number) {
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}min` : `${h}h`;
  }

  const waDisabled = !(clienteNombre.trim() && clienteTelefono.trim());
  async function handlePasteMaps(target: 'origen' | 'destino') {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      let lat: number | null = null, lng: number | null = null, query = '';
      const m1 = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      const m2 = text.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
      const m3 = text.match(/maps\.google\.com\/maps\/?\?.*q=([^&]+)/);
      if (m1) { lat = parseFloat(m1[1]); lng = parseFloat(m1[2]); }
      else if (m2) { lat = parseFloat(m2[1]); lng = parseFloat(m2[2]); }
      else if (m3) { query = decodeURIComponent(m3[1]); }
      if (lat !== null && lng !== null) {
        const r = await fetch(`${NOMINATIM_URL}/reverse?lat=${lat}&lon=${lng}&format=json`);
        const d = await r.json();
        const addr = d.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        const p = { lat, lng, address: addr };
        if (target === 'origen') { setOrigen(p); setOrigenInput(addr); setClickMode('destino'); clickModeRef.current = 'destino'; }
        else { setDestino(p); setDestinoInput(addr); setClickMode('origen'); clickModeRef.current = 'origen'; }
        mapInstance.current?.setView([lat, lng], 16);
      } else if (query) {
        handleSearchInput(query, target);
      }
    } catch {}
  }

  async function registrarPedido() {
    if (!cotizacion || !SHEET_URL) return;
    try {
      const p = new URLSearchParams({
        cliente: clienteNombre.trim(),
        numero: clienteTelefono.trim(),
        precio: cotizacion.precio_usd.toFixed(2),
        fecha: new Date().toLocaleDateString('es-VE', { timeZone: 'America/Caracas' }),
      });
      await fetch(`${SHEET_URL}?${p}`, { method: 'GET', mode: 'no-cors' });
    } catch {}
  }
  const [copied, setCopied] = useState(false);
  function compartirTarifa() {
    if (!cotizacion) return;
    const tipos: Record<string, string> = { moto: 'el mototaxi', delivery: 'el delivery', encomienda: 'la encomienda' };
    const t = tipos[cotizacion.tipo_servicio] || cotizacion.tipo_servicio;
    const txt = `🚀 ${t} por @MotoAlianza sale en $${cotizacion.precio_usd.toFixed(2)} — ${cotizacion.distancia_km} km, ${formatTiempo(cotizacion.duracion_minutos)}. Cotiza en: ${window.location.href}`;
    navigator.clipboard.writeText(txt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  return (
    <>
      {showLanding && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#1c1913] px-6" style={{ backgroundImage: 'url(/fondoMotoAlianza.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <div className="absolute inset-0 bg-[#1c1913]/80" />
          <div className="relative z-10 flex flex-col items-center text-center">
            <img src="/logo.jpg" alt="MOTOAL+ANZA" className="w-28 h-28 rounded-2xl object-cover ring-4 ring-[#ead189] shadow-xl mb-5" />
            <h1 className="text-[#ead189] font-bold text-3xl mb-3">MOTOAL+ANZA</h1>
            <p className="text-[#c9b07a] text-base max-w-xs leading-relaxed mb-1">Activados para llevarte más lejos.</p>
            <p className="text-[#c9b07a] text-base max-w-xs leading-relaxed mb-8">Muévete seguro, muévete con MOTOAL+ANZA</p>
            <button onClick={() => setShowLanding(false)}
              className="bg-[#ead189] text-[#1c1913] font-bold py-3.5 px-10 rounded-xl text-base shadow-lg hover:bg-[#d4b86a] transition-all active:scale-95">
              Comenzar
            </button>
          </div>
        </div>
      )}
      <div className="max-w-md mx-auto px-4 py-4">
      {/* Header */}
      <div className="bg-[#1c1913] rounded-2xl px-4 py-3 mb-4 shadow-md">
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="MOTOAL+ANZA" className="w-10 h-10 rounded-lg object-cover ring-2 ring-[#ead189]" />
          <div className="flex-1">
            <h1 className="text-[#ead189] font-bold text-lg leading-tight">MOTOAL+ANZA</h1>
            <p className="text-[#ead189]/80 text-xs">Cotizador de viajes</p>
            <p className={`text-[10px] mt-0.5 ${online ? 'text-green-400' : 'text-red-400'}`}>
              {online ? '🟢 En línea / Activos' : '🔴 Fuera de servicio'}
            </p>
          </div>
        </div>
      </div>

      {!online && (
        <div className="mb-3 p-3 bg-red-50/90 border border-red-300 rounded-xl text-sm text-red-700 text-center">
          🔴 Déjanos tu cotización y te agendamos para primera hora de la mañana
        </div>
      )}
      {/* Mapa */}
      <div ref={mapRef} className="h-[240px] w-full rounded-xl shadow-md mb-3 ring-1 ring-black/5"></div>

      {error && <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>}

      {/* Origen */}
      <div className="relative mb-2.5">
        <label className={`block text-xs font-semibold mb-1 ml-1 ${origen ? 'text-green-300' : 'text-white/80'}`}>📍 ORIGEN {origen && '✅'}</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <div className="relative">
              <input type="text" value={origenInput} onChange={(e) => handleSearchInput(e.target.value, 'origen')}
                placeholder="Buscar dirección o toca el mapa..."
                className={`w-full p-2.5 border rounded-xl outline-none text-sm focus:border-[#c9a94e] focus:ring-3 focus:ring-[#ead189]/30 bg-white transition-all ${origen ? 'border-green-400' : 'border-gray-300'}`} />
              {searchingOrigen && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#c9a94e] animate-pulse">⏳</span>}
              {origenInput && !searchingOrigen && (
                <button onClick={() => { setOrigen(null); setOrigenInput(''); setShowOrigenDD(false); setClickMode('origen'); clickModeRef.current = 'origen'; }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-red-500 transition-colors">✕</button>
              )}
              {showOrigenDD && <Dropdown items={origenDropdown} onSelect={(item) => selectAddress(item, 'origen')} />}
            </div>
          </div>
          <button onClick={() => setCurrentLocation('origen')} className="btn-location relative" disabled={locating === 'origen'}>
            {locating === 'origen' ? <span className="inline-block animate-spin">⏳</span> : '📍'} Actual
          </button>
          <button onClick={() => handlePasteMaps('origen')} className="btn-location" title="Pegar link de Google Maps">🔗 Maps</button>
        </div>
      </div>

      {/* Destino */}
      <div className="relative mb-3">
        <label className={`block text-xs font-semibold mb-1 ml-1 ${destino ? 'text-green-300' : 'text-white/80'}`}>🏁 DESTINO {destino && '✅'}</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <div className="relative">
              <input type="text" value={destinoInput} onChange={(e) => handleSearchInput(e.target.value, 'destino')}
                placeholder="Buscar dirección o toca el mapa..."
                className={`w-full p-2.5 border rounded-xl outline-none text-sm focus:border-[#c9a94e] focus:ring-3 focus:ring-[#ead189]/30 bg-white transition-all ${destino ? 'border-green-400' : 'border-gray-300'}`} />
              {searchingDestino && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#c9a94e] animate-pulse">⏳</span>}
              {destinoInput && !searchingDestino && (
                <button onClick={() => { setDestino(null); setDestinoInput(''); setShowDestinoDD(false); setClickMode('destino'); clickModeRef.current = 'destino'; }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-red-500 transition-colors">✕</button>
              )}
              {showDestinoDD && <Dropdown items={destinoDropdown} onSelect={(item) => selectAddress(item, 'destino')} />}
            </div>
          </div>
          <button onClick={() => setCurrentLocation('destino')} className="btn-location relative" disabled={locating === 'destino'}>
            {locating === 'destino' ? <span className="inline-block animate-spin">⏳</span> : '📍'} Actual
          </button>
          <button onClick={() => handlePasteMaps('destino')} className="btn-location" title="Pegar link de Google Maps">🔗 Maps</button>
        </div>
      </div>

      {/* Servicio */}
      <div className="mb-3">
        <label className="block text-xs font-semibold text-white/80 mb-1.5 ml-1">🛵 TIPO DE SERVICIO</label>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { v: 'moto', l: '🛵 Mototaxi', r: '$0.30/km' },
            { v: 'delivery', l: '📦 Delivery', r: '$0.25/km' },
            { v: 'encomienda', l: '📮 Encomienda', r: '$0.50/km' },
          ].map((s) => (
            <button key={s.v} onClick={() => handleServicioChange(s.v)}
              className={`rounded-xl py-2.5 text-xs font-medium border-2 transition-all ${servicio === s.v ? 'bg-[#ead189] border-[#c9a94e] text-[#1c1913] font-bold' : 'bg-white border-gray-200 text-gray-500'}`}>
              {s.l}<br /><span className="text-[10px] opacity-70">{s.r}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Zonas rápidas */}
      <div className="mb-3 border border-[#ead189]/40 rounded-xl overflow-hidden bg-white/95 backdrop-blur-sm">
        <button onClick={() => setShowZonas(!showZonas)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-[#1c1913] hover:bg-[#f5e8b8]/30 transition-colors">
          <span>📍 Zonas rápidas — {clickMode === 'origen' ? 'elegir ORIGEN' : 'elegir DESTINO'}</span>
          <span className="text-[#4a3822]">{showZonas ? '▲' : '▼'}</span>
        </button>
        {showZonas && (
          <div className="px-4 pb-4 pt-1 border-t border-[#ead189]/40">
            <p className="text-[10px] text-[#4a3822] mb-2">Tocá una zona para usarla como <strong>{clickMode === 'origen' ? 'ORIGEN' : 'DESTINO'}</strong></p>
            <div className="flex flex-wrap gap-1.5">
              {ZONAS.map((z) => (
                <button key={z} onClick={() => handleZonaClick(z)} disabled={zonasLoading === z}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#c9a94e]/40 bg-white text-[#1c1913] hover:bg-[#ead189]/30 transition-all disabled:opacity-50">
                  {zonasLoading === z ? '⌛' : '📍'} {z}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Cliente */}
      <div className="mb-3 border border-[#ead189]/40 rounded-xl overflow-hidden bg-white">
        <button onClick={() => setShowCliente(!showCliente)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-[#1c1913] hover:bg-[#f5e8b8]/30 transition-colors">
          <span>👤 Datos del cliente <span className="text-[10px] text-red-400 font-normal">* obligatorio</span></span>
          <span className="text-[#4a3822]">{showCliente ? '▲' : '▼'}</span>
        </button>
        {showCliente && (
          <div className="px-4 pb-4 pt-1 border-t border-[#ead189]/40">
            <div className="mb-2.5">
              <label className="block text-xs text-[#4a3822] mb-1">Nombre completo</label>
              <input type="text" value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)}
                placeholder="Ej: Juan Pérez"
                className="w-full p-2.5 border border-gray-300 rounded-xl outline-none text-sm focus:border-[#c9a94e] focus:ring-3 focus:ring-[#ead189]/30 bg-white transition-all" />
            </div>
            <div className="mb-2.5">
              <label className="block text-xs text-[#4a3822] mb-1">Teléfono de contacto</label>
              <input type="tel" value={clienteTelefono} onChange={(e) => setClienteTelefono(e.target.value)}
                placeholder="Ej: 0412-1234567"
                className="w-full p-2.5 border border-gray-300 rounded-xl outline-none text-sm focus:border-[#c9a94e] focus:ring-3 focus:ring-[#ead189]/30 bg-white transition-all" />
            </div>
          </div>
        )}
      </div>

      {/* Pago */}
      <div className="mb-3">
        <label className="block text-xs font-semibold text-white/80 mb-1.5 ml-1">💳 MÉTODO DE PAGO</label>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { v: 'movil', l: '📱 Pago Móvil' },
            { v: 'efectivo', l: '💵 Efectivo (USD)' },
            { v: 'efectivo_bs', l: '💵 Efectivo (Bs.)' },
          ].map((p) => (
            <button key={p.v} onClick={() => setMetodoPago(p.v)}
              className={`rounded-xl py-2.5 text-xs font-medium border-2 transition-all ${metodoPago === p.v ? 'bg-[#1c1913] border-[#1c1913] text-[#ead189] font-bold' : 'bg-white border-gray-200 text-gray-500'}`}>
              {p.l}
            </button>
          ))}
        </div>
      </div>

      {/* Calcular */}
      <button onClick={fetchCotizacion} disabled={loading}
        className="w-full py-3.5 rounded-xl font-bold text-base shadow-md mb-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ backgroundColor: '#ead189', color: '#1c1913' }}>
        {loading ? 'Calculando...' : 'Calcular Tarifa'}
      </button>

      {/* Resultado */}
      {cotizacion && (
        <div id="resultado" className="bg-gradient-to-br from-[#6b7280] to-white border border-[#ead189] rounded-2xl p-5 text-center shadow-md">
          <p className="text-[#4a3822] text-xs uppercase tracking-wider mb-1">Tu cotización</p>
          <div className="text-3xl font-bold text-[#1c1913] mb-1">${cotizacion.precio_usd.toFixed(2)}</div>
          {cotizacion.precio_bs != null && <div className="text-lg font-semibold text-[#4a3822] mb-1">Bs. {formatBs(cotizacion.precio_bs)}</div>}
          <div className="text-[11px] text-[#6b5a3e] mb-2">$1.00 base + ${cotizacion.precio_km.toFixed(2)}/km × {cotizacion.distancia_km} km = ${cotizacion.precio_usd.toFixed(2)}</div>
          <div className="flex justify-center gap-4 text-sm text-[#4a3822] mb-3">
            <span>📏 {cotizacion.distancia_km} km</span>
            <span>⏱ {formatTiempo(cotizacion.duracion_minutos)}</span>
            <span>{cotizacion.tipo_servicio}</span>
          </div>
          <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(cotizacion.whatsapp_text)}`}
            target="_blank" onClick={registrarPedido}
            className={`block w-full py-3 rounded-xl font-bold text-sm shadow transition-all text-white ${waDisabled ? 'bg-green-300 pointer-events-none' : 'bg-green-500 hover:bg-green-600'}`}>
            💬 Confirmar y Solicitar por WhatsApp
          </a>
          <button onClick={compartirTarifa}
            className="w-full mt-2 py-2 rounded-xl font-medium text-xs border border-[#c9a94e] text-[#1c1913] bg-white/80 hover:bg-[#ead189]/20 transition-all">
            {copied ? '✅ ¡Copiado!' : '📋 Compartir tarifa'}
          </button>
        </div>
      )}

      <p className="text-center text-xs text-white/60 mt-3">Tocá el mapa para marcar • Arrastrá los marcadores</p>

      <style jsx>{`
        .btn-location {
          padding: 0 12px; border: 1.5px solid #d1d5db; border-radius: 12px; font-size: 13px;
          white-space: nowrap; display: flex; align-items: center; gap: 4px;
          transition: all 0.2s; background: white; color: #4b5563; cursor: pointer;
        }
        .btn-location:hover { border-color: #c9a94e; background: #f5e8b8; color: #1c1913; }
        .btn-location:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>
    </div>
    </>
  );
}

function Dropdown({ items, onSelect }: { items: any[]; onSelect: (item: any) => void }) {
  return (
    <div className="absolute left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto z-50">
      {items.map((item, i) => (
        <div key={i} className="px-4 py-2.5 text-sm cursor-pointer hover:bg-[#f5e8b8] border-b border-gray-100 last:border-0"
          onClick={() => onSelect(item)}>
          {item.display_name}
        </div>
      ))}
    </div>
  );
}
