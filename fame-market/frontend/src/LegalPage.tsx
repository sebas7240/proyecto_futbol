import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  BadgeInfo,
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
          ficticios. Participar no constituye una inversion ni genera derechos
          sobre artistas, canciones o ingresos reales.
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
        <h2>2. FameCoins y mercado</h2>
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
          La clasificacion usa el rendimiento porcentual del portafolio. Para
          ser elegible se requieren al menos tres operaciones, actividad en dos
          dias distintos y una cuenta sin alertas de abuso pendientes. Las
          recompensas diarias cuentan dentro del portafolio porque son parte del
          juego, pero no sustituyen los requisitos de actividad ni la revision
          antifraude.
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
          una sala para proteger la experiencia.
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
          La beta no promete premios. Si una temporada futura ofrece uno, sus
          condiciones se publicaran por separado. La wallet Solana registrada
          solo se usara como dato de contacto operativo para pagos manuales de
          premios autorizados; Fame Plays nunca pedira frase semilla, llave
          privada ni acceso a una cuenta cripto. Las reglas pueden actualizarse
          y una version nueva requerira una aceptacion nueva antes de operar.
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
          y por que. No vendemos datos personales ni usamos el portafolio
          ficticio para evaluar credito o inversiones reales.
        </p>
      </header>

      <section>
        <h2>1. Informacion que tratamos</h2>
        <p>
          Al iniciar sesion recibimos de Firebase el identificador de cuenta,
          nombre, correo y avatar disponibles. Guardamos favoritos, operaciones,
          posiciones, ranking, wallet publica de premios si decides registrarla,
          recompensas diarias reclamadas, aceptaciones legales y eventos
          necesarios para seguridad y prevencion de fraude.
        </p>
      </section>
      <section>
        <h2>2. Para que se utiliza</h2>
        <p>
          Usamos estos datos para autenticar la cuenta, mantener el portafolio,
          calcular rankings, atender errores, prevenir abuso y conservar la
          integridad de las temporadas.
        </p>
      </section>
      <section>
        <h2>3. Proveedores</h2>
        <p>
          La operacion puede involucrar Firebase para autenticacion, Cloudflare
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
        <h2>7. Wallet de premios</h2>
        <p>
          Si registras una wallet Solana, se almacena como direccion publica
          para contactarte o realizar una transferencia manual si una temporada
          validada incluye premio. No conectamos tu wallet, no firmamos
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
          cuando existen fuentes suficientes y la configuracion de mercado lo
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
          compras y ventas del juego siguen influyendo mediante el mercado
          ficticio; las senales externas solo agregan una variacion controlada.
        </p>
      </section>
      <section>
        <h2>4. Protecciones</h2>
        <p>
          Solo se aceptan ventanas completas y consecutivas. Una fuente ausente
          o atrasada no produce una caida artificial. Cada algoritmo tiene
          version, las ventanas son idempotentes y toda activacion futura
          requerira auditoria, limites diarios y posibilidad de detener una
          fuente sin detener el mercado.
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

export function LegalPage({
  page
}: {
  page: 'rules' | 'privacy' | 'methodology' | 'rights';
}) {
  return (
    <main className="legal-page">
      <nav>
        <a href="/"><ArrowLeft size={17} /> Volver al mercado</a>
        <span>Actualizado: {updatedAt}</span>
      </nav>
      {page === 'rules' ? (
        <RulesPage />
      ) : page === 'privacy' ? (
        <PrivacyPage />
      ) : page === 'methodology' ? (
        <MethodologyPage />
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
