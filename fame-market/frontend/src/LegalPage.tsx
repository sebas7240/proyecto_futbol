import {
  ArrowLeft,
  CircleDollarSign,
  Database,
  Scale,
  ShieldCheck,
  Trophy
} from 'lucide-react';

const updatedAt = '15 de junio de 2026';

function RulesPage() {
  return (
    <>
      <header className="legal-heading">
        <span><Scale size={20} /> Reglas de la beta</span>
        <h1>Un juego sobre la economia de la atencion</h1>
        <p>
          Fame Market usa monedas, precios y participaciones completamente
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
          economico de ninguna figura publica. Durante el modo sombra, las
          senales externas se calculan y muestran, pero no modifican precios.
        </p>
      </section>
      <section>
        <h2>3. Ranking</h2>
        <p>
          La clasificacion usa el rendimiento porcentual del portafolio. Para
          ser elegible se requieren al menos tres operaciones, actividad en dos
          dias distintos y una cuenta sin alertas de abuso pendientes.
        </p>
      </section>
      <section>
        <h2>4. Juego limpio</h2>
        <p>
          Se prohiben multicuentas, automatizaciones no autorizadas, explotacion
          de errores, coordinacion para alterar precios y cualquier intento de
          manipular el ranking. Fame Market puede congelar cuentas, artistas o
          resultados mientras realiza una revision.
        </p>
      </section>
      <section>
        <h2>5. Datos y metodologia</h2>
        <p>
          Las estadisticas de YouTube se muestran como informacion publica para
          ayudar a tomar decisiones y actualmente no afectan el precio. El
          Indice de Atencion es una metrica independiente de Fame Market, no
          una metrica publicada o aprobada por YouTube. Su metodologia y sus
          fuentes se publican en una pagina separada.
        </p>
      </section>
      <section>
        <h2>6. Premios y cambios</h2>
        <p>
          La beta no promete premios. Si una temporada futura ofrece uno, sus
          condiciones se publicaran por separado. Las reglas pueden actualizarse
          y una version nueva requerira una aceptacion nueva antes de operar.
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
          Esta politica explica que informacion usa Fame Market durante la beta
          y por que. No vendemos datos personales ni usamos el portafolio
          ficticio para evaluar credito o inversiones reales.
        </p>
      </header>

      <section>
        <h2>1. Informacion que tratamos</h2>
        <p>
          Al iniciar sesion recibimos de Firebase el identificador de cuenta,
          nombre, correo y avatar disponibles. Guardamos favoritos, operaciones,
          posiciones, ranking, aceptaciones legales y eventos necesarios para
          seguridad y prevencion de fraude.
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
          Services para metadatos y estadisticas publicas. Cada proveedor trata
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
          antifraude, cifrado de respaldos y revision administrativa. Las
          alertas automaticas apoyan una revision humana; no entregan premios ni
          imponen sanciones definitivas por si solas.
        </p>
      </section>
      <section>
        <h2>6. YouTube API Services</h2>
        <p>
          Fame Market usa YouTube API Services para mostrar canales y videos
          oficiales. Al usar Fame Market tambien aplican los{' '}
          <a href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer">
            Terminos de Servicio de YouTube
          </a>
          . Puedes consultar la{' '}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">
            Politica de Privacidad de Google
          </a>
          . Fame Market no solicita permisos para administrar tu cuenta de
          YouTube ni descarga comentarios individuales.
        </p>
      </section>
      <section>
        <h2>7. Solicitudes</h2>
        <p>
          Puedes solicitar correccion o eliminacion mediante el canal oficial
          de soporte publicado por Fame Market. Algunas operaciones pueden
          anonimizarse en lugar de borrarse cuando sean necesarias para
          integridad competitiva, seguridad o cumplimiento.
        </p>
      </section>
    </>
  );
}

function MethodologyPage() {
  return (
    <>
      <header className="legal-heading">
        <span><Database size={20} /> Metodologia publica</span>
        <h1>Indice Automatico de Atencion</h1>
        <p>
          Es una metrica calculada independientemente por Fame Market para
          observar cambios relativos de atencion. No es una estadistica
          publicada, respaldada ni aprobada por YouTube, Wikimedia o Google.
        </p>
      </header>

      <section>
        <h2>1. Estado actual</h2>
        <p>
          El indice se encuentra en modo sombra. Las senales se guardan y
          evaluan durante 30 ventanas diarias, pero el ajuste aplicado al precio
          permanece siempre en cero hasta completar revision tecnica, humana y
          de permisos.
        </p>
      </section>
      <section>
        <h2>2. Fuente activa</h2>
        <p>
          La primera fuente es Wikimedia Pageviews. Se utilizan visitas diarias
          agregadas de usuarios y se compara cada figura solamente contra su
          propio historial. Los totales de figuras distintas nunca se comparan
          directamente.
        </p>
      </section>
      <section>
        <h2>3. Calculo</h2>
        <p>
          Se compara el promedio de los siete dias recientes contra los 21 dias
          anteriores. El crecimiento logaritmico se suaviza con una funcion
          acotada, incorpora una zona neutral y propone como maximo 15 puntos
          basicos, equivalentes a 0,15%, cuando existe una sola fuente.
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
          se identificara expresamente como calculado por Fame Market y no como
          un dato originado directamente en YouTube. La senal de YouTube se
          mantendra separada de Wikimedia u otras fuentes, salvo autorizacion
          escrita que permita combinarlas.
        </p>
      </section>
    </>
  );
}

export function LegalPage({
  page
}: {
  page: 'rules' | 'privacy' | 'methodology';
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
      ) : (
        <MethodologyPage />
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
          <Database size={19} />
          <strong>Datos limitados</strong>
          <span>Guardamos lo necesario para operar la beta.</span>
        </article>
      </footer>
    </main>
  );
}
