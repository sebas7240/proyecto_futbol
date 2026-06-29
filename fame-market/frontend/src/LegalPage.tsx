import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  BadgeInfo,
  BookOpenText,
  CircleDollarSign,
  Database,
  FileCheck2,
  Scale,
  Send,
  ShieldCheck,
  Trophy
} from 'lucide-react';
import { api } from './api';
import type { RightsRequestType } from './types';

const updatedAt = '28 de junio de 2026';

const guideArticles = [
  {
    title: 'Como se juega una temporada de Fame Plays',
    body:
      'Cada temporada empieza con el mismo saldo ficticio para todos. Tu meta es formar un equipo de figuras publicas antes de que su atencion suba dentro del juego. El ranking compara rendimiento porcentual, no dinero real, y todos parten con las mismas reglas.'
  },
  {
    title: 'Que significan los FameCoins',
    body:
      'Los FameCoins son puntos internos de entretenimiento. Sirven para medir tus jugadas dentro de una temporada, pero no se compran, no se retiran, no se venden y no pueden convertirse en criptomonedas, dinero ni activos digitales.'
  },
  {
    title: 'Como leer la grafica sin confundirla con inversion',
    body:
      'La grafica muestra una dinamica ficticia de popularidad. Puede moverse por actividad del juego, noticias publicas revisadas y estados internos controlados. No representa valor economico real de una persona, marca, cancion, carrera deportiva ni empresa.'
  },
  {
    title: 'Premios promocionales y revision antifraude',
    body:
      'Algunas temporadas pueden ofrecer recompensas promocionales manuales si se alcanza una meta publica de usuarios. Ganar el ranking no garantiza pago automatico: el top pasa por revision antifraude y la recompensa no convierte FameCoins en dinero.'
  },
  {
    title: 'Comunidad, chat y juego responsable',
    body:
      'El chat existe para comentar tendencias y compartir estrategias sanas. Los reportes, limites de mensajes y moderacion ayudan a evitar spam, acoso o abuso. No publiques claves privadas, datos sensibles ni enlaces sospechosos.'
  }
];

function formatDate(value: string | null) {
  if (!value) return 'Pendiente';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function statusLabel(status: string) {
  if (status === 'shadow-ready') return 'Sombra completa';
  if (status === 'collecting-shadow') return 'Recolectando sombra';
  return 'Pendiente de sincronizacion';
}

function RulesPage() {
  return (
    <>
      <header className="legal-heading">
        <span><Scale size={20} /> Reglas de la beta</span>
        <h1>Un juego sobre la economia de la atencion</h1>
        <p>
          Fame Plays usa monedas, precios y participaciones completamente
          ficticios. Participar no constituye una inversion, apuesta ni genera
          derechos sobre artistas, canciones o ingresos reales.
        </p>
      </header>

      <section>
        <h2>1. Participacion</h2>
        <p>
          La beta esta dirigida a personas mayores de 18 anos con una cuenta
          valida. Cada persona debe utilizar una sola cuenta y es responsable
          de proteger el acceso a ella.
        </p>
      </section>
      <section>
        <h2>2. FameCoins y liga de atencion</h2>
        <p>
          Cada temporada comienza con el mismo saldo ficticio. Los FameCoins no
          se compran, venden, retiran, convierten ni transfieren. Los precios se
          mueven por la actividad interna del juego y no representan el valor
          economico de ninguna figura publica. El bonus diario puede entregar
          pequenas participaciones ficticias en las figuras que ya tengas,
          normalmente hasta 25 FameCoins de valor total por dia, sin mover el
          precio ni cobrar comision.
        </p>
      </section>
      <section>
        <h2>3. Ranking</h2>
        <p>
          La clasificacion usa el rendimiento porcentual de tu equipo ficticio.
          Para ser elegible se requieren al menos tres jugadas, actividad en dos
          dias distintos y una cuenta sin alertas de abuso pendientes. Las
          recompensas diarias cuentan dentro del juego, pero no sustituyen los
          requisitos de actividad ni la revision antifraude.
        </p>
      </section>
      <section>
        <h2>4. Juego limpio</h2>
        <p>
          Se prohiben multicuentas, automatizaciones no autorizadas, explotacion
          de errores, coordinacion para alterar precios y cualquier intento de
          manipular el ranking. Fame Plays puede congelar cuentas, artistas o
          resultados mientras realiza una revision. Crear cuentas para reclamar
          recompensas diarias multiples se considera abuso.
        </p>
      </section>
      <section>
        <h2>5. Comunidad y chat</h2>
        <p>
          El chat y las notas de voz cortas son funciones comunitarias. No se
          permiten insultos graves, acoso, spam, enlaces peligrosos, suplantacion
          ni contenido ilegal. Los usuarios pueden reportar mensajes o notas de
          voz; el equipo puede ocultar contenido, silenciar, bloquear o reiniciar
          una sala para proteger la experiencia. Durante revisiones publicitarias
          o campañas sensibles, Fame Plays puede evitar anuncios dentro o junto
          al chat para no monetizar contenido generado por usuarios sin contexto.
        </p>
      </section>
      <section>
        <h2>6. Datos y metodologia</h2>
        <p>
          Las estadisticas de YouTube se muestran como informacion publica para
          ayudar a tomar decisiones y actualmente no afectan el precio. El
          Indice de Atencion es una metrica independiente de Fame Plays, no
          una metrica publicada o aprobada por YouTube. Su metodologia y sus
          fuentes se publican en una pagina separada.
        </p>
      </section>
      <section>
        <h2>7. Premios, wallet y cambios</h2>
        <p>
          Una temporada solo tendra recompensa promocional si la pantalla de
          ranking muestra sus condiciones, la meta minima de usuarios registrados
          se cumple y el top final supera la revision antifraude. En el
          lanzamiento, el plan es premiar manualmente al top 3 cuando Fame Plays
          llegue a 100 usuarios registrados. Esa recompensa no es apuesta, no es
          retiro, no es conversion de FameCoins y no exige deposito. La wallet
          Solana registrada solo se usara como dato operativo para pagos manuales
          autorizados; Fame Plays nunca pedira frase semilla, llave privada ni
          acceso a una cuenta cripto. Las reglas pueden actualizarse y una
          version nueva requerira una aceptacion nueva antes de jugar.
        </p>
      </section>
      <section>
        <h2>8. Figuras publicas y marcas</h2>
        <p>
          Los nombres se usan para identificar figuras publicas dentro de un
          indice informativo y un juego ficticio. Esa referencia no implica
          afiliacion, patrocinio, aprobacion ni propiedad sobre su nombre,
          imagen, marca, obra o actividad profesional. No se permite usar el
          servicio para suplantar a una figura o presentar productos oficiales.
        </p>
      </section>
    </>
  );
}

function PrivacyPage() {
  return (
    <>
      <header className="legal-heading">
        <span><ShieldCheck size={20} /> Privacidad</span>
        <h1>Datos necesarios, sin adornos</h1>
        <p>
          Esta politica explica que informacion usa Fame Plays durante la beta
          y por que. No vendemos datos personales ni usamos tu equipo ficticio
          para evaluar credito, inversiones reales o productos financieros.
        </p>
      </header>

      <section>
        <h2>1. Informacion que tratamos</h2>
        <p>
          Al iniciar sesion recibimos de Firebase el identificador de cuenta,
          nombre, correo y avatar disponibles. Guardamos favoritos, jugadas,
          posiciones, ranking, wallet publica de recompensas si decides registrarla,
          recompensas diarias reclamadas, aceptaciones legales y eventos
          necesarios para seguridad y prevencion de fraude.
        </p>
      </section>
      <section>
        <h2>2. Para que se utiliza</h2>
        <p>
          Usamos estos datos para autenticar la cuenta, mantener tu equipo,
          calcular rankings, atender errores, prevenir abuso y conservar la
          integridad de las temporadas.
        </p>
      </section>
      <section>
        <h2>3. Proveedores</h2>
        <p>
          La operacion tecnica puede involucrar Firebase para autenticacion, Cloudflare
          para entrega y seguridad, Hetzner para infraestructura, PostgreSQL
          para persistencia, Wikimedia para pageviews agregadas y YouTube API
          Services para metadatos y estadisticas publicas. El chat usa Workers
          y Durable Objects de Cloudflare; la seccion de radio puede consultar
          directorios o streams publicos de terceros. Cada proveedor trata
          informacion bajo sus propios terminos y medidas de seguridad.
        </p>
      </section>
      <section>
        <h2>4. Conservacion</h2>
        <p>
          Los datos del juego se conservan mientras la cuenta o la beta esten
          activas y durante el tiempo razonable necesario para auditoria. Las
          copias operativas se rotan normalmente a los 14 dias. Los registros
          de temporadas pueden conservarse para mantener rankings historicos.
        </p>
        <p>
          Los mensajes de chat, reportes y notas de voz se conservan de forma
          limitada dentro de la sala correspondiente y pueden eliminarse
          automaticamente por volumen, antiguedad o decision de moderacion.
          No estan pensados como almacenamiento permanente.
        </p>
        <p>
          Los metadatos obtenidos de YouTube se actualizan o eliminan conforme
          a las YouTube API Services Developer Policies. Mientras no exista una
          autorizacion adicional, las estadisticas almacenadas se eliminan al
          superar 30 dias. Si YouTube aprueba el uso de metricas derivadas, las
          estadisticas y metricas autorizadas podran conservarse hasta 36 meses.
        </p>
      </section>
      <section>
        <h2>5. Seguridad y decisiones</h2>
        <p>
          Aplicamos autenticacion, limites de solicitudes, verificacion
          antifraude, limites de mensajes y notas de voz, cifrado de respaldos
          y revision administrativa. Las alertas automaticas apoyan una revision
          humana; no entregan premios ni imponen sanciones definitivas por si
          solas.
        </p>
      </section>
      <section>
        <h2>6. YouTube API Services</h2>
        <p>
          Fame Plays usa YouTube API Services para mostrar canales y videos
          oficiales. Al usar Fame Plays tambien aplican los{' '}
          <a href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer">
            Terminos de Servicio de YouTube
          </a>
          . Puedes consultar la{' '}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">
            Politica de Privacidad de Google
          </a>
          . Fame Plays no solicita permisos para administrar tu cuenta de
          YouTube ni descarga comentarios individuales.
        </p>
      </section>
      <section>
        <h2>7. Wallet de recompensas</h2>
        <p>
          Si registras una wallet Solana, se almacena como direccion publica
          para contactarte o realizar una transferencia manual si una temporada
          validada incluye recompensa promocional. No conectamos tu wallet, no firmamos
          transacciones y nunca solicitamos claves privadas.
        </p>
      </section>
      <section>
        <h2>8. Solicitudes</h2>
        <p>
          Puedes solicitar correccion o eliminacion mediante el formulario de
          derechos. Para tramitarlo guardamos el nombre, correo, contenido de
          la solicitud, evidencia aportada, estado y notas internas. La IP se
          transforma en un hash para limitar abuso y no se guarda en texto
          legible. Algunas operaciones pueden anonimizarse en lugar de borrarse
          cuando sean necesarias para integridad competitiva, seguridad o
          cumplimiento.
        </p>
      </section>
    </>
  );
}

function MethodologyPage() {
  const statusQuery = useQuery({
    queryKey: ['public-attention-status'],
    queryFn: api.publicAttentionStatus,
    staleTime: 60_000
  });
  const status = statusQuery.data;

  return (
    <>
      <header className="legal-heading">
        <span><Database size={20} /> Metodologia publica</span>
        <h1>Indice Automatico de Atencion</h1>
        <p>
          Es una metrica calculada independientemente por Fame Plays para
          observar cambios relativos de atencion. No es una estadistica
          publicada, respaldada ni aprobada por YouTube, Wikimedia o Google.
        </p>
      </header>

      <section>
        <h2>1. Estado actual</h2>
        <p>
          El indice externo ya puede proponer ajustes controlados al precio
          cuando existen fuentes suficientes y la configuracion de la liga lo
          permite. Cada ajuste queda limitado por bandas diarias, versionado y
          revision operativa para evitar movimientos extremos o manipulables.
        </p>
      </section>
      <section>
        <h2>2. Fuentes activas</h2>
        <p>
          Fame Plays puede combinar fuentes publicas autorizadas o permitidas
          por sus terminos, como actividad de noticias y pageviews agregadas.
          Cada figura se compara principalmente contra su propio historial; los
          totales de figuras distintas no se usan como una comparacion directa
          de valor.
        </p>
      </section>
      <section>
        <h2>3. Calculo</h2>
        <p>
          El motor normaliza cambios recientes contra una linea base, aplica
          suavizado, deduplicacion, zonas neutrales y limites por fuente. Las
          apoyos y retiros del juego siguen influyendo mediante la liga
          ficticia; las senales externas solo agregan una variacion controlada.
        </p>
      </section>
      <section>
        <h2>4. Protecciones</h2>
        <p>
          Solo se aceptan ventanas completas y consecutivas. Una fuente ausente
          o atrasada no produce una caida artificial. Cada algoritmo tiene
          version, las ventanas son idempotentes y toda activacion futura
          requerira auditoria, limites diarios y posibilidad de detener una
          fuente sin detener el juego.
        </p>
      </section>
      <section>
        <h2>5. YouTube</h2>
        <p>
          Los datos publicos de YouTube actualmente se muestran por separado y
          no forman parte del indice. Solo se incorporaran despues de recibir
          autorizacion para metricas derivadas. Si se aprueba, cualquier score
          se identificara expresamente como calculado por Fame Plays y no como
          un dato originado directamente en YouTube. La senal de YouTube se
          mantendra separada de Wikimedia u otras fuentes, salvo autorizacion
          escrita que permita combinarlas.
        </p>
      </section>
      <section className="methodology-status">
        <div className="methodology-status__heading">
          <div>
            <h2>6. Estado vivo del indice</h2>
            <p>
              Esta vista se alimenta de la API publica y confirma que las
              fuentes externas se estan observando con limites de seguridad.
            </p>
          </div>
          <span>{status?.mode ?? 'shadow'}</span>
        </div>

        {statusQuery.isLoading ? (
          <p>Consultando estado del indice...</p>
        ) : statusQuery.isError ? (
          <p>No se pudo consultar el estado publico del indice.</p>
        ) : status ? (
          <>
            <div className="methodology-status__metrics">
              <article>
                <strong>{status.summary.totalSources}</strong>
                <span>Fuentes activas</span>
              </article>
              <article>
                <strong>{status.summary.readySources}</strong>
                <span>Con 30 ventanas</span>
              </article>
              <article>
                <strong>{status.summary.averageCoveragePercent}%</strong>
                <span>Cobertura promedio</span>
              </article>
              <article>
                <strong>Limitado</strong>
                <span>Impacto aplicado</span>
              </article>
            </div>
            <p className="methodology-status__note">
              Ultima sincronizacion:{' '}
              {formatDate(status.summary.lastSyncedAt)}. Los ajustes publicos
              se muestran de forma agregada y pueden pausarse manualmente.
            </p>
            <div className="methodology-source-list">
              {status.sources.map((source) => (
                <article key={`${source.artistSlug}-${source.provider}`}>
                  <header>
                    <div>
                      <strong>{source.artistName}</strong>
                      <span>{source.provider}</span>
                    </div>
                    <b className={`methodology-source-list__status ${source.status}`}>
                      {statusLabel(source.status)}
                    </b>
                  </header>
                  <div className="methodology-source-list__bar">
                    <i style={{ width: `${source.coveragePercent}%` }} />
                  </div>
                  <p>
                    {source.observedDays}/{source.targetDays} ventanas ·
                    propuesta ultima:{' '}
                    {source.proposedDeltaBps === null
                      ? 'pendiente'
                      : `${source.proposedDeltaBps} bps`}{' '}
                    · aplicado: {source.appliedDeltaBps ?? 0} bps
                  </p>
                  <a href={source.sourceUrl} target="_blank" rel="noreferrer">
                    Ver fuente
                  </a>
                </article>
              ))}
            </div>
          </>
        ) : null}
      </section>
    </>
  );
}

function RightsPage() {
  const [form, setForm] = useState({
    requesterName: '',
    requesterEmail: '',
    requestType: 'correction' as RightsRequestType,
    subject: '',
    message: '',
    evidenceUrl: '',
    website: ''
  });
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);
  const contactEmail =
    import.meta.env.VITE_RIGHTS_CONTACT_EMAIL?.trim() ?? '';

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSending(true);
    setStatus('');
    try {
      const result = await api.createRightsRequest(form);
      setStatus(
        `Solicitud recibida. Conserva esta referencia: ${result.id}.`
      );
      setForm({
        requesterName: '',
        requesterEmail: '',
        requestType: 'correction',
        subject: '',
        message: '',
        evidenceUrl: '',
        website: ''
      });
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : 'No se pudo enviar la solicitud.'
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <header className="legal-heading">
        <span><BadgeInfo size={20} /> Derechos y correcciones</span>
        <h1>Identificacion informativa, sin afiliacion</h1>
        <p>
          Fame Plays es un simulador independiente. Las figuras y marcas
          mencionadas no patrocinan, administran ni aprueban esta plataforma.
          Esta pagina explica la politica de nombres, imagenes y reclamaciones.
        </p>
      </header>

      <section>
        <h2>1. Nombres y marcas</h2>
        <p>
          Los nombres se muestran solo para identificar a la figura sobre la
          que se presentan hechos, fuentes y actividad publica. No usamos sus
          nombres o simbolos como marca propia, dominio, logotipo ni indicacion
          de respaldo oficial. Antes de adoptar el nombre definitivo de la
          plataforma se realizara una busqueda de marcas y riesgo de confusion.
        </p>
      </section>
      <section>
        <h2>2. Imagenes</h2>
        <p>
          Una imagen personal solo puede publicarse si existe una base de uso
          registrada: contenido propio, licencia comprobable o autorizacion
          aplicable del proveedor. En los demas casos se muestra un avatar
          abstracto de iniciales. Una caricatura o imagen generada por IA que
          imite de forma reconocible a una persona no se considera
          automaticamente segura.
        </p>
      </section>
      <section>
        <h2>3. Datos y hechos</h2>
        <p>
          Los hechos publicos y estadisticas se presentan con su fuente y bajo
          las condiciones del proveedor correspondiente. Que un dato sea
          publico no elimina sus terminos de API, limites de reutilizacion,
          derechos sobre fotografias ni posibles derechos de imagen.
        </p>
      </section>
      <section>
        <h2>4. Alcance</h2>
        <p>
          El precio, las participaciones y los FameCoins son elementos
          ficticios del juego. No representan acciones, contratos, regalias ni
          propiedad sobre una persona. Este diseño reduce riesgos, pero no es
          una garantia legal universal. Antes de lanzar premios, publicidad a
          gran escala o nuevos paises se requiere revision profesional en las
          jurisdicciones aplicables.
        </p>
      </section>
      <section className="rights-form-section">
        <div>
          <h2>5. Solicitar revision</h2>
          <p>
            Representantes, titulares y usuarios pueden pedir correccion,
            atribucion o retiro. Incluye suficiente detalle para localizar el
            contenido.
          </p>
          {contactEmail && (
            <p>
              Canal alternativo:{' '}
              <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
            </p>
          )}
        </div>
        <form className="rights-form" onSubmit={submit}>
          <div className="rights-form__row">
            <label>
              Nombre
              <input
                required
                minLength={2}
                maxLength={120}
                value={form.requesterName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    requesterName: event.target.value
                  }))
                }
              />
            </label>
            <label>
              Correo
              <input
                required
                type="email"
                maxLength={254}
                value={form.requesterEmail}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    requesterEmail: event.target.value
                  }))
                }
              />
            </label>
          </div>
          <label>
            Tipo de solicitud
            <select
              value={form.requestType}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  requestType: event.target.value as RightsRequestType
                }))
              }
            >
              <option value="correction">Correccion</option>
              <option value="removal">Retiro de contenido</option>
              <option value="trademark">Marca o posible confusion</option>
              <option value="image">Imagen, fotografia o semejanza</option>
              <option value="other">Otro</option>
            </select>
          </label>
          <label>
            Asunto
            <input
              required
              minLength={3}
              maxLength={180}
              value={form.subject}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  subject: event.target.value
                }))
              }
            />
          </label>
          <label>
            Detalle
            <textarea
              required
              minLength={20}
              maxLength={4000}
              rows={6}
              value={form.message}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  message: event.target.value
                }))
              }
            />
          </label>
          <label>
            Enlace de evidencia <span>(opcional)</span>
            <input
              type="url"
              maxLength={500}
              placeholder="https://"
              value={form.evidenceUrl}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  evidenceUrl: event.target.value
                }))
              }
            />
          </label>
          <label className="rights-form__trap" aria-hidden="true">
            Sitio web
            <input
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  website: event.target.value
                }))
              }
            />
          </label>
          <button type="submit" disabled={sending}>
            <Send size={17} />
            {sending ? 'Enviando...' : 'Enviar solicitud'}
          </button>
          {status && <p className="rights-form__status">{status}</p>}
        </form>
      </section>
      <section>
        <h2>6. Referencias generales</h2>
        <p>
          La politica se apoya en la diferencia entre copyright, marcas y
          derechos sobre nombre e imagen. Consulta la{' '}
          <a
            href="https://www.copyright.gov/help/faq/faq-protect.html"
            target="_blank"
            rel="noreferrer"
          >
            Oficina de Copyright de Estados Unidos
          </a>
          , la{' '}
          <a
            href="https://www.uspto.gov/page/about-trademark-infringement"
            target="_blank"
            rel="noreferrer"
          >
            USPTO
          </a>{' '}
          y la jurisprudencia aplicable de la{' '}
          <a
            href="https://www.corteconstitucional.gov.co/relatoria/2022/t-280-22"
            target="_blank"
            rel="noreferrer"
          >
            Corte Constitucional de Colombia
          </a>
          . Estas referencias no sustituyen asesoria juridica.
        </p>
      </section>
    </>
  );
}

function GuidesPage() {
  return (
    <>
      <header className="legal-heading">
        <span><BookOpenText size={20} /> Guias de juego</span>
        <h1>Aprende a competir sin confundirlo con inversion</h1>
        <p>
          Estas guias explican Fame Plays como lo que es: un juego gratuito de
          popularidad con puntos ficticios, reglas visibles y recompensas
          promocionales manuales cuando una temporada lo permita.
        </p>
      </header>

      {guideArticles.map((article, index) => (
        <section key={article.title}>
          <h2>{index + 1}. {article.title}</h2>
          <p>{article.body}</p>
        </section>
      ))}

      <section>
        <h2>6. Antes de compartir Fame Plays</h2>
        <p>
          Revisa que las reglas, privacidad, metodologia, derechos y ranking de
          la temporada esten visibles. Si existe recompensa, debe aparecer la
          meta de usuarios, el numero de puestos, la revision antifraude y la
          aclaracion de que no hay compra de entrada ni conversion de FameCoins.
        </p>
      </section>
    </>
  );
}

function HowToPage() {
  return (
    <>
      <header className="legal-heading">
        <span><BookOpenText size={20} /> Como jugar</span>
        <h1>Forma tu equipo de fama en pocos pasos</h1>
        <p>
          Fame Plays es gratis y usa FameCoins ficticias. Tu objetivo es leer
          tendencias culturales, apoyar figuras y subir en el ranking de la
          temporada sin usar dinero real.
        </p>
      </header>

      <section className="how-to-steps">
        <article>
          <strong>1</strong>
          <h2>Elige una figura</h2>
          <p>
            Revisa precio ficticio, grafica, noticias, contenido reciente y
            categoria antes de decidir.
          </p>
        </article>
        <article>
          <strong>2</strong>
          <h2>Suma apoyo</h2>
          <p>
            Indica cuantas participaciones quieres, verifica seguridad cuando
            el sistema lo pida y revisa la cotizacion.
          </p>
        </article>
        <article>
          <strong>3</strong>
          <h2>Confirma la jugada</h2>
          <p>
            Si aceptas el precio promedio y la comision ficticia, confirma. La
            jugada aparece en tu equipo y puede cambiar tu ranking.
          </p>
        </article>
        <article>
          <strong>4</strong>
          <h2>Compite limpio</h2>
          <p>
            El ranking premia rendimiento porcentual. Las recompensas
            promocionales, si existen, pasan por revision antifraude.
          </p>
        </article>
      </section>

      <section>
        <h2>Lo importante</h2>
        <p>
          Los FameCoins no se compran, no se retiran y no se convierten en
          dinero. Fame Plays no es inversion, bolsa ni apuesta: es un juego de
          estrategia sobre atencion publica.
        </p>
        <a href="/reglas">Leer reglas completas</a>
      </section>
    </>
  );
}

export function LegalPage({
  page
}: {
  page: 'rules' | 'privacy' | 'methodology' | 'rights' | 'guides' | 'howto';
}) {
  return (
    <main className="legal-page">
      <nav>
        <a href="/"><ArrowLeft size={17} /> Volver a la liga</a>
        <span>Actualizado: {updatedAt}</span>
      </nav>
      {page === 'rules' ? (
        <RulesPage />
      ) : page === 'privacy' ? (
        <PrivacyPage />
      ) : page === 'methodology' ? (
        <MethodologyPage />
      ) : page === 'howto' ? (
        <HowToPage />
      ) : page === 'guides' ? (
        <GuidesPage />
      ) : (
        <RightsPage />
      )}
      <footer className="legal-summary">
        <article>
          <CircleDollarSign size={19} />
          <strong>Sin dinero real</strong>
          <span>FameCoins no tienen valor monetario.</span>
        </article>
        <article>
          <Trophy size={19} />
          <strong>Competencia revisada</strong>
          <span>El top puede pasar por revision antifraude.</span>
        </article>
        <article>
          <FileCheck2 size={19} />
          <strong>Uso verificable</strong>
          <span>Las imagenes necesitan una base registrada.</span>
        </article>
      </footer>
    </main>
  );
}
