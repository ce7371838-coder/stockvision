import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BriefcaseBusiness,
  CircleDollarSign,
  History,
  LayoutDashboard,
  Search,
  ShoppingCart,
  TrendingUp,
  WalletCards,
  X
} from 'lucide-react'

const accionesDemo = [
  { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Tecnología', price: 212.45, change: 1.82 },
  { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Automotriz', price: 318.12, change: -0.54 },
  { symbol: 'MELI', name: 'MercadoLibre', sector: 'Comercio electrónico', price: 2145.33, change: 2.1 },
  { symbol: 'NVDA', name: 'NVIDIA', sector: 'Semiconductores', price: 181.55, change: 3.42 },
  { symbol: 'MSFT', name: 'Microsoft', sector: 'Tecnología', price: 531.82, change: 0.76 },
  { symbol: 'AMZN', name: 'Amazon', sector: 'Comercio electrónico', price: 245.6, change: -0.31 },
  { symbol: 'GOOGL', name: 'Alphabet', sector: 'Tecnología', price: 196.72, change: 1.25 },
  { symbol: 'META', name: 'Meta Platforms', sector: 'Tecnología', price: 738.4, change: 0.91 }
]

const dinero = (valor) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'USD'
  }).format(Number(valor || 0))

function App() {
  const [accionesIniciales, setAccionesIniciales] = useState(accionesDemo)
  const [cargandoApi, setCargandoApi] = useState(true)
  const [errorApi, setErrorApi] = useState('')
  const [cotizando, setCotizando] = useState(false)
  const [mensajeCotizacion, setMensajeCotizacion] = useState('')

  const [seccion, setSeccion] = useState('dashboard')
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState(false)
  const [accion, setAccion] = useState(accionesDemo[0])
  const [cantidad, setCantidad] = useState(1)
  const [tipoPrecio, setTipoPrecio] = useState('mercado')
  const [precioManual, setPrecioManual] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [portafolios, setPortafolios] = useState([])
  const [portafolioId, setPortafolioId] = useState('')
  const portafolio =
    portafolios.find((item) => String(item.id) === String(portafolioId)) || {
      id: null,
      nombre: 'Sin portafolio seleccionado',
      presupuesto: 0,
      saldo: 0
    }
  const [posiciones, setPosiciones] = useState([])
  const [historial, setHistorial] = useState([])
  const [mostrarCrearPortafolio, setMostrarCrearPortafolio] = useState(false)
  const [nuevoNombrePortafolio, setNuevoNombrePortafolio] = useState('')
  const [nuevoPresupuesto, setNuevoPresupuesto] = useState('')
  const [errorPortafolio, setErrorPortafolio] = useState('')

  useEffect(() => {
    const cargarPortafolio = async () => {
      try {
        const respuesta = await fetch('/api/portfolios')
        if (!respuesta.ok) throw new Error('Error consultando portafolios')

        const datos = await respuesta.json()

        setPortafolios(datos)

        if (datos.length > 0) {
          setPortafolioId(String(datos[0].id))
        }
      } catch (error) {
        console.error('Error cargando portafolio:', error)
      }
    }

    cargarPortafolio()
  }, [])

  useEffect(() => {
    const cargarAcciones = async () => {
      try {
        const respuesta = await fetch('/api/stocks')

        if (!respuesta.ok) {
          throw new Error('La API respondió con error')
        }

        const datos = await respuesta.json()
        setAccionesIniciales(datos)
        setErrorApi('')
      } catch (error) {
        console.error('Error consultando StockVision API:', error)
        setErrorApi('No se pudo consultar la API. Se muestran datos de respaldo.')
        setAccionesIniciales(accionesDemo)
      } finally {
        setCargandoApi(false)
      }
    }

    cargarAcciones()
  }, [])

  const accionesFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()

    if (!texto) {
      return accionesIniciales
    }

    return accionesIniciales.filter(
      (item) =>
        item.symbol.toLowerCase().includes(texto) ||
        item.name.toLowerCase().includes(texto)
    )
  }, [busqueda, accionesIniciales])

  useEffect(() => {
    const cargarPosiciones = async () => {
      if (!portafolioId) {
        setPosiciones([])
        return
      }

      try {
        const respuesta = await fetch(`/api/portfolios/${portafolioId}/positions`)

        if (!respuesta.ok) {
          throw new Error('No fue posible consultar las posiciones')
        }

        const datos = await respuesta.json()
        setPosiciones(datos)
      } catch (error) {
        console.error('Error cargando posiciones:', error)
        setPosiciones([])
      }
    }

    cargarPosiciones()
  }, [portafolioId])

  const cotizarSimbolo = async () => {
    const symbol = busqueda.trim().toUpperCase()

    if (!symbol) {
      setMensajeCotizacion('Escribe un símbolo, por ejemplo IBM o AAPL.')
      return
    }

    setCotizando(true)
    setMensajeCotizacion('')

    try {
      const respuesta = await fetch(`/api/stocks/${encodeURIComponent(symbol)}`)
      const resultado = await respuesta.json()

      if (!respuesta.ok) {
        throw new Error(resultado.message || 'No fue posible cotizar la acción')
      }

      setAccionesIniciales((actuales) => {
        const existe = actuales.some((item) => item.symbol === resultado.symbol)

        if (existe) {
          return actuales.map((item) =>
            item.symbol === resultado.symbol ? resultado : item
          )
        }

        return [resultado, ...actuales]
      })

      setBusqueda(resultado.symbol)
      setMensajeCotizacion(
        `${resultado.symbol} cotizada correctamente desde MarketData.app`
      )
    } catch (error) {
      console.error('Error cotizando símbolo:', error)
      setMensajeCotizacion(error.message)
    } finally {
      setCotizando(false)
    }
  }

  const crearPortafolio = async () => {
    const presupuesto = Number(nuevoPresupuesto)

    if (!nuevoNombrePortafolio.trim() || presupuesto <= 0) {
      setErrorPortafolio('Escribe un nombre y un presupuesto válido.')
      return
    }

    try {
      const respuesta = await fetch('/api/portfolios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nombre: nuevoNombrePortafolio.trim(),
          presupuesto
        })
      })

      const resultado = await respuesta.json()

      if (!respuesta.ok) {
        throw new Error(resultado.message || 'No fue posible crear el portafolio')
      }

      setPortafolios((actuales) => [...actuales, resultado])
      setPortafolioId(String(resultado.id))
      setNuevoNombrePortafolio('')
      setNuevoPresupuesto('')
      setErrorPortafolio('')
      setMostrarCrearPortafolio(false)
    } catch (error) {
      console.error('Error creando portafolio:', error)
      setErrorPortafolio(error.message)
    }
  }

  const capitalInvertido = posiciones.reduce(
    (total, item) => total + item.cantidad * item.precioCompra,
    0
  )

  const valorActual = posiciones.reduce(
    (total, item) => total + item.cantidad * item.precioActual,
    0
  )

  const utilidad = valorActual - capitalInvertido

  const abrirOperacion = (item) => {
    setAccion(item)
    setCantidad(1)
    setTipoPrecio('mercado')
    setPrecioManual('')
    setMensaje('')
    setModal(true)
  }

  const precioSeleccionado = () =>
    tipoPrecio === 'mercado' ? accion.price : Number(precioManual)

  const comprar = async () => {
    const qty = Number(cantidad)
    const precio = precioSeleccionado()
    const total = qty * precio

    if (!qty || qty <= 0 || !precio || precio <= 0) {
      setMensaje('Ingresa una cantidad y un precio válidos.')
      return
    }

    if (total > portafolio.saldo) {
      setMensaje('El saldo del portafolio no es suficiente.')
      return
    }

    if (!portafolio.id) {
      setMensaje('No existe un portafolio activo.')
      return
    }

    try {
      const respuesta = await fetch('/api/buy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          portfolioId: portafolio.id,
          symbol: accion.symbol,
          cantidad: qty,
          precio
        })
      })

      const resultado = await respuesta.json()

      if (!respuesta.ok) {
        throw new Error(resultado.message || 'No fue posible registrar la compra')
      }

      setPortafolios((actuales) =>
        actuales.map((item) =>
          item.id === resultado.portfolio.id ? resultado.portfolio : item
        )
      )

      const posicionesRespuesta = await fetch(
        `/api/portfolios/${portafolioId}/positions`
      )

      if (posicionesRespuesta.ok) {
        const posicionesActualizadas = await posicionesRespuesta.json()
        setPosiciones(posicionesActualizadas)
      }
    } catch (error) {
      console.error('Error registrando compra:', error)
      setMensaje(error.message)
      return
    }

    setHistorial((actual) => [
      {
        id: Date.now(),
        tipo: 'COMPRA',
        symbol: accion.symbol,
        cantidad: qty,
        precio,
        total,
        fecha: new Date().toLocaleString('es-MX')
      },
      ...actual
    ])

    setModal(false)
  }

  const vender = async () => {
    const qty = Number(cantidad)
    const precio = precioSeleccionado()
    const posicion = posiciones.find((item) => item.symbol === accion.symbol)

    if (!posicion || qty <= 0 || qty > posicion.cantidad) {
      setMensaje('No tienes suficientes acciones para realizar la venta.')
      return
    }

    if (!portafolio.id) {
      setMensaje('No existe un portafolio activo.')
      return
    }

    try {
      const respuesta = await fetch('/api/sell', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          portfolioId: portafolio.id,
          symbol: accion.symbol,
          cantidad: qty,
          precio
        })
      })

      const resultado = await respuesta.json()

      if (!respuesta.ok) {
        throw new Error(resultado.message || 'No fue posible registrar la venta')
      }

      setPortafolios((actuales) =>
        actuales.map((item) =>
          item.id === resultado.portfolio.id ? resultado.portfolio : item
        )
      )

      const posicionesRespuesta = await fetch(
        `/api/portfolios/${portafolioId}/positions`
      )

      if (posicionesRespuesta.ok) {
        const posicionesActualizadas = await posicionesRespuesta.json()
        setPosiciones(posicionesActualizadas)
      }

      setHistorial((actual) => [
        {
          id: Date.now(),
          tipo: 'VENTA',
          symbol: accion.symbol,
          cantidad: qty,
          precio,
          total: resultado.total,
          ganancia: resultado.ganancia,
          fecha: new Date().toLocaleString('es-MX')
        },
        ...actual
      ])

      setModal(false)
    } catch (error) {
      console.error('Error registrando venta:', error)
      setMensaje(error.message)
    }
  }

  const menu = [
    { id: 'dashboard', texto: 'Dashboard', icono: LayoutDashboard },
    { id: 'catalogo', texto: 'Catálogo', icono: BarChart3 },
    { id: 'portafolio', texto: 'Portafolio', icono: BriefcaseBusiness },
    { id: 'historial', texto: 'Historial', icono: History }
  ]

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 lg:flex">
      <aside className="w-full bg-slate-950 p-5 text-white lg:min-h-screen lg:w-64">
        <div className="mb-8 flex items-center gap-3">
          <div className="rounded-xl bg-emerald-500 p-2">
            <TrendingUp size={26} />
          </div>

          <div>
            <h1 className="text-xl font-bold">StockVision</h1>
            <p className="text-xs text-slate-400">Trading & Portfolio</p>
          </div>
        </div>

        <nav className="grid grid-cols-2 gap-2 lg:block">
          {menu.map(({ id, texto, icono: Icono }) => (
            <button
              key={id}
              onClick={() => setSeccion(id)}
              className={`mb-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition ${
                seccion === id
                  ? 'bg-emerald-500 font-semibold text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Icono size={19} />
              {texto}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 p-4 md:p-7">
        <header className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold text-emerald-600">
              Mercado de valores
            </p>
            <h2 className="text-3xl font-bold">Panel de inversiones</h2>
            <p className="text-slate-500">
              Administra tus acciones y portafolio desde un solo lugar.
            </p>
          </div>

          <div className="rounded-2xl bg-white px-5 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Portafolio activo</p>
            <p className="font-bold">{portafolio.nombre}</p>
          </div>
        </header>

        <section className="mb-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Tarjeta
            titulo="Saldo disponible"
            valor={dinero(portafolio.saldo)}
            icono={<CircleDollarSign />}
          />
          <Tarjeta
            titulo="Capital invertido"
            valor={dinero(capitalInvertido)}
            icono={<WalletCards />}
          />
          <Tarjeta
            titulo="Valor actual"
            valor={dinero(valorActual)}
            icono={<Activity />}
          />
          <Tarjeta
            titulo="Ganancia / Pérdida"
            valor={dinero(utilidad)}
            positivo={utilidad >= 0}
            icono={utilidad >= 0 ? <ArrowUpRight /> : <ArrowDownRight />}
          />
        </section>

        {(seccion === 'dashboard' || seccion === 'catalogo') && (
          <section className="mb-7 rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h3 className="text-xl font-bold">Catálogo de acciones</h3>
                <p className="text-sm text-slate-500">
                  Busca por nombre o símbolo.
                </p>
              </div>

              <div className="flex flex-col gap-2 md:w-[430px]">
                <div className="flex gap-2">
                  <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 px-4 py-3">
                    <Search size={19} className="text-slate-400" />
                    <input
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') cotizarSimbolo()
                      }}
                      placeholder="Escribe un símbolo: IBM, AAPL, NFLX..."
                      className="w-full border-none bg-transparent outline-none"
                    />
                  </div>

                  <button
                    onClick={cotizarSimbolo}
                    disabled={cotizando}
                    className="rounded-xl bg-emerald-500 px-4 py-3 font-bold text-white hover:bg-emerald-600 disabled:opacity-60"
                  >
                    {cotizando ? 'Cotizando...' : 'Cotizar'}
                  </button>
                </div>

                {mensajeCotizacion && (
                  <p className="text-sm font-semibold text-emerald-700">
                    {mensajeCotizacion}
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {accionesFiltradas.map((item) => (
                <article
                  key={item.symbol}
                  className="rounded-2xl border border-slate-200 p-4 transition hover:-translate-y-1 hover:border-emerald-400 hover:shadow-lg"
                >
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 font-bold text-white">
                      {item.symbol.slice(0, 2)}
                    </div>

                    <span
                      className={`rounded-full px-2 py-1 text-xs font-bold ${
                        item.change >= 0
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {item.change >= 0 ? '+' : ''}
                      {item.change}%
                    </span>
                  </div>

                  <p className="text-xs font-bold text-emerald-600">
                    {item.symbol}
                  </p>
                  <h4 className="truncate font-bold">{item.name}</h4>
                  <p className="mb-4 text-xs text-slate-500">{item.sector}</p>

                  <div className="flex items-center justify-between">
                    <span className="text-lg font-black">
                      {dinero(item.price)}
                    </span>

                    <button
                      onClick={() => abrirOperacion(item)}
                      className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
                    >
                      Operar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {seccion === 'portafolio' && (
          <section className="mb-7 rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div>
                <h3 className="text-xl font-bold">Mis portafolios</h3>
                <p className="text-sm text-slate-500">
                  Selecciona un portafolio para ver sus acciones.
                </p>
              </div>

              <button
                onClick={() => {
                  setErrorPortafolio('')
                  setMostrarCrearPortafolio(true)
                }}
                className="rounded-xl bg-emerald-500 px-4 py-3 font-bold text-white hover:bg-emerald-600"
              >
                + Crear portafolio
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {portafolios.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setPortafolioId(String(item.id))}
                  className={`rounded-2xl border p-5 text-left transition ${
                    String(item.id) === String(portafolioId)
                      ? 'border-emerald-500 bg-emerald-50 shadow-md'
                      : 'border-slate-200 bg-white hover:border-emerald-300'
                  }`}
                >
                  <p className="mb-1 text-xs font-bold uppercase text-emerald-600">
                    Portafolio
                  </p>
                  <h4 className="text-lg font-black">{item.nombre}</h4>
                  <div className="mt-4 flex justify-between">
                    <span className="text-sm text-slate-500">Presupuesto</span>
                    <strong>{dinero(item.presupuesto)}</strong>
                  </div>
                  <div className="mt-2 flex justify-between">
                    <span className="text-sm text-slate-500">Saldo disponible</span>
                    <strong>{dinero(item.saldo)}</strong>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {(seccion === 'dashboard' || seccion === 'portafolio') && (
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">Mi portafolio</h3>
                <p className="text-sm text-slate-500">
                  Acciones compradas y rendimiento actual.
                </p>
              </div>

              <BriefcaseBusiness className="text-emerald-600" />
            </div>

            {posiciones.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 py-12 text-center">
                <ShoppingCart className="mx-auto mb-3 text-slate-300" size={40} />
                <p className="font-semibold">Aún no has comprado acciones</p>
                <p className="text-sm text-slate-500">
                  Selecciona una acción del catálogo para comenzar.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[750px] text-left">
                  <thead>
                    <tr className="border-b text-xs uppercase text-slate-500">
                      <th className="p-3">Acción</th>
                      <th className="p-3">Cantidad</th>
                      <th className="p-3">Compra promedio</th>
                      <th className="p-3">Precio actual</th>
                      <th className="p-3">Valor</th>
                      <th className="p-3">Ganancia/Pérdida</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>

                  <tbody>
                    {posiciones.map((item) => {
                      const pnl =
                        (item.precioActual - item.precioCompra) * item.cantidad

                      return (
                        <tr key={item.symbol} className="border-b">
                          <td className="p-3">
                            <p className="font-bold">{item.symbol}</p>
                            <p className="text-xs text-slate-500">{item.name}</p>
                          </td>
                          <td className="p-3">{item.cantidad}</td>
                          <td className="p-3">{dinero(item.precioCompra)}</td>
                          <td className="p-3">{dinero(item.precioActual)}</td>
                          <td className="p-3 font-semibold">
                            {dinero(item.cantidad * item.precioActual)}
                          </td>
                          <td
                            className={`p-3 font-bold ${
                              pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {dinero(pnl)}
                          </td>
                          <td className="p-3">
                            <button
                              onClick={() =>
                                abrirOperacion(
                                  accionesIniciales.find(
                                    (stock) => stock.symbol === item.symbol
                                  )
                                )
                              }
                              className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold"
                            >
                              Operar
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {seccion === 'historial' && (
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="mb-5 text-xl font-bold">Historial de operaciones</h3>

            {historial.length === 0 ? (
              <p className="text-slate-500">Todavía no existen operaciones.</p>
            ) : (
              <div className="space-y-3">
                {historial.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between gap-3 rounded-xl border p-4 md:flex-row md:items-center"
                  >
                    <div>
                      <span
                        className={`mr-3 rounded-full px-3 py-1 text-xs font-bold ${
                          item.tipo === 'COMPRA'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {item.tipo}
                      </span>

                      <strong>{item.symbol}</strong>

                      <p className="mt-2 text-xs text-slate-500">{item.fecha}</p>
                    </div>

                    <div className="text-right">
                      <p>
                        {item.cantidad} acciones × {dinero(item.precio)}
                      </p>
                      <p className="font-bold">{dinero(item.total)}</p>

                      {item.tipo === 'VENTA' && (
                        <p
                          className={
                            item.ganancia >= 0
                              ? 'text-emerald-600'
                              : 'text-rose-600'
                          }
                        >
                          Resultado: {dinero(item.ganancia)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {mostrarCrearPortafolio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-emerald-600">
                  Nuevo portafolio
                </p>
                <h3 className="text-2xl font-black">Crear portafolio</h3>
              </div>

              <button
                onClick={() => setMostrarCrearPortafolio(false)}
                className="rounded-full bg-slate-100 p-2"
              >
                <X size={20} />
              </button>
            </div>

            <label className="mb-2 block text-sm font-bold">Nombre</label>
            <input
              value={nuevoNombrePortafolio}
              onChange={(e) => setNuevoNombrePortafolio(e.target.value)}
              placeholder="Ejemplo: Acciones de largo plazo"
              className="mb-5 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
            />

            <label className="mb-2 block text-sm font-bold">Presupuesto</label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={nuevoPresupuesto}
              onChange={(e) => setNuevoPresupuesto(e.target.value)}
              placeholder="50000"
              className="mb-5 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
            />

            {errorPortafolio && (
              <p className="mb-4 rounded-xl bg-rose-100 p-3 text-sm font-semibold text-rose-700">
                {errorPortafolio}
              </p>
            )}

            <button
              onClick={crearPortafolio}
              className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-bold text-white hover:bg-emerald-600"
            >
              Crear portafolio
            </button>
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="font-bold text-emerald-600">{accion.symbol}</p>
                <h3 className="text-2xl font-black">{accion.name}</h3>
                <p className="text-slate-500">{accion.sector}</p>
              </div>

              <button
                onClick={() => setModal(false)}
                className="rounded-full bg-slate-100 p-2"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-5 rounded-2xl bg-slate-950 p-5 text-white">
              <p className="text-sm text-slate-400">Precio de mercado</p>
              <p className="text-4xl font-black">{dinero(accion.price)}</p>
            </div>

            <label className="mb-2 block text-sm font-bold">
              Portafolio
            </label>
            <select
              value={portafolioId}
              onChange={(e) => setPortafolioId(e.target.value)}
              className="mb-5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-emerald-500"
            >
              {portafolios.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nombre} — saldo {dinero(item.saldo)}
                </option>
              ))}
            </select>

            <label className="mb-2 block text-sm font-bold">Cantidad</label>
            <input
              type="number"
              min="1"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className="mb-5 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
            />

            <label className="mb-2 block text-sm font-bold">Tipo de precio</label>

            <div className="mb-5 grid grid-cols-2 gap-3">
              <button
                onClick={() => setTipoPrecio('mercado')}
                className={`rounded-xl border px-4 py-3 font-semibold ${
                  tipoPrecio === 'mercado'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200'
                }`}
              >
                Precio de mercado
              </button>

              <button
                onClick={() => setTipoPrecio('manual')}
                className={`rounded-xl border px-4 py-3 font-semibold ${
                  tipoPrecio === 'manual'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200'
                }`}
              >
                Precio manual
              </button>
            </div>

            {tipoPrecio === 'manual' && (
              <input
                type="number"
                step="0.01"
                value={precioManual}
                onChange={(e) => setPrecioManual(e.target.value)}
                placeholder="Ingresa el precio"
                className="mb-5 w-full rounded-xl border border-slate-200 px-4 py-3"
              />
            )}

            <div className="mb-5 rounded-xl bg-slate-100 p-4">
              <div className="flex justify-between">
                <span>Total estimado</span>
                <strong>
                  {dinero(
                    Number(cantidad || 0) *
                      Number(precioSeleccionado() || 0)
                  )}
                </strong>
              </div>
            </div>

            {mensaje && (
              <p className="mb-4 rounded-xl bg-rose-100 p-3 text-sm font-semibold text-rose-700">
                {mensaje}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={comprar}
                className="rounded-xl bg-emerald-500 px-4 py-3 font-bold text-white hover:bg-emerald-600"
              >
                Comprar
              </button>

              <button
                onClick={vender}
                className="rounded-xl bg-slate-900 px-4 py-3 font-bold text-white hover:bg-slate-700"
              >
                Vender
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Tarjeta({ titulo, valor, icono, positivo = true }) {
  return (
    <article className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-500">{titulo}</p>
        <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
          {icono}
        </div>
      </div>

      <p
        className={`text-2xl font-black ${
          titulo.includes('Ganancia')
            ? positivo
              ? 'text-emerald-600'
              : 'text-rose-600'
            : ''
        }`}
      >
        {valor}
      </p>
    </article>
  )
}

export default App
