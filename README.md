# ⚽ FC Galaxy — Manager de Fútbol con Economía Blockchain Simulada

Videojuego de gestión futbolística completo y jugable, con una capa de economía
blockchain **simulada** (SIMCHAIN). Cero dependencias externas: solo Node.js
(módulos `http`, `fs`, `path`, `crypto`).

## Cómo jugar

### Opción A — En tu ordenador (recomendada: es la versión completa)

Requiere [Node.js](https://nodejs.org) 18 o superior instalado:

```bash
npm start          # servidor en http://localhost:3000
```

Abre `http://localhost:3000` en el navegador (no abras `index.html` directo
con doble clic: el frontend necesita el servidor para la API). El progreso se
guarda automáticamente en `server/data/save.json` (escritura atómica) y se
restaura al reiniciar el servidor, incluido el estado del generador aleatorio.

### Opción B — Desplegado en Vercel (sin servidor)

El repositorio incluye `vercel.json` y un bundle del motor para navegador
(`public/js/engine-bundle.js`, generado por `node tools/build-browser.js`).
En Vercel, importa el repo con el preset **Other**: detectará `vercel.json` y
servirá `public/` como sitio estático. En este modo el juego completo se
ejecuta en tu navegador y el progreso se guarda en el `localStorage` del
navegador (persistente entre sesiones en el mismo dispositivo y navegador).

Limitaciones del modo navegador frente al servidor local: el guardado vive en
el dispositivo/navegador (no se sincroniza entre dispositivos) y tiene el
tamaño máximo típico de localStorage (~5 MB, equivalente a varias temporadas).

Otros comandos:

```bash
npm test                     # 21 tests: blockchain, motor, mercado, temporada completa, persistencia, modo navegador
node tools/build-browser.js  # regenerar el bundle del navegador tras cambiar el motor
```

## Arquitectura

```
blockchain/            ← capa blockchain SIMULADA, 100% separada del juego
  chain.js             bloques SHA-256 encadenados por prevHash + validación
  token.js             ledger del token FCG (mint / transfer / burn)
  nft.js               registro de activos únicos por jugador (SIM-721)
  contract.js          "contrato inteligente" simulado de traspasos (atómico, 4% quemado)

server/
  index.js             servidor HTTP sin dependencias (solo transporte)
  routes.js            API REST compartida entre servidor y modo navegador
  store.js             persistencia JSON atómica + restauración de RNG
  store-browser.js     persistencia en localStorage para el modo navegador
  engine/              ← lógica de juego (no sabe que existe la blockchain)
    rng.js             PRNG determinista y serializable
    player.js          generación, atributos, valoración, salarios, desarrollo
    club.js            clubes, formaciones, plantillas iniciales
    match.js           motor de partidos minuto a minuto (lesiones, tarjetas, fatiga, cambios IA)
    league.js          calendario doble vuelta (22 jornadas), clasificación, premios
    finance.js         ledger contable, ingresos/gastos semanales, instalaciones
    youth.js           cantera: promesas semanales y promoción
    market.js          publicaciones, pujas IA, ofertas directas, negociación
    game.js            orquestador: ÚNICO puente entre juego y blockchain

public/                ← frontend SPA vanilla (sin framework)
  js/engine-bundle.js  motor compilado para navegador (generado, no editar a mano)
  js/core.js           API, estado, navegación, shell, creación de club
  js/views1..4.js      panel, plantilla, tácticas, liga, mercado, cantera, finanzas, club, SIMCHAIN
  js/match.js          reproducción de partidos en vivo + panel táctico (descanso y min. 75)
  js/boot.js           arranque y restauración de sesión
```

### Separación juego ↔ blockchain

- `server/engine/` nunca importa `blockchain/`. Solo `game.js` (orquestador)
  invoca `contract.simulateTransfer(...)` y sincroniza wallets.
- Sustituir la simulación por una blockchain real = reimplementar
  `blockchain/chain|token|nft|contract` con web3 y cambiar el adaptador en
  `game.js`. Nada del motor de juego cambia.
- **Todas** las transacciones llevan `simulated: true` y la UI muestra de
  forma permanente el aviso "SIMCHAIN — simulada, no real".

### Modelo económico

- El presupuesto del club (`club.budget`) es la fuente de verdad del juego; la
  wallet en el ledger FCG lo refleja y se sincroniza cada semana con un bloque
  de mint/burn registrado en la cadena.
- Cada traspaso ejecuta un contrato simulado atómico: valida propiedad del NFT
  y saldo del comprador (precio + 4% de comisión), debita, acredita, quema la
  comisión, transfiere el activo y escribe un bloque. Si algo falla, todo
  revierte (probado en tests).

## Bucle de juego

1. Crea tu cuenta (usuario y contraseña; en modo navegador las cuentas viven en
   localStorage). El registro incluye una **pregunta de seguridad** para
   recuperar la contraseña si la olvidas (enlaces "¿Olvidaste tu contraseña?"
   en el login y "🔑 Recuperación" en la barra lateral; también sirve para
   configurarla en cuentas creadas antes de esta función). La respuesta se
   guarda solo como hash con salt. El campo `provider` de las cuentas deja
   preparada la integración futura de OAuth (p. ej. Google) sin tocar la
   lógica del juego.
2. Funda tu club (nombre, ciudad, colores, formación, **país de la liga** —
   da nacionalidad y coherencia de nombres a los jugadores — y **editor de
   escudo y camiseta** con vista previa en vivo).
3. Configura alineación y tácticas (campo interactivo, auto-completar).
4. Juega la jornada en vivo: eventos minuto a minuto, **minimapa** con la
   posición de los jugadores y el balón, fuera de juego, **control de
   velocidad** (0.5×–4×), medidor de **pasión de la grada** (el público local
   empuja si va perdiendo) y cambios en el descanso. Los partidos se juegan
   hasta el minuto 90 **más tiempo añadido** (1–6 min según goles, cambios,
   tarjetas y lesiones de la segunda parte, anunciado con un evento ⏱️).
   O simula el resultado directamente.
5. Entrena y desarrolla: cada mejora de atributo en el entrenamiento semanal
   y cada buen partido (nota ≥ 7.5 o gol) genera **puntos de habilidad**.
   En el perfil del jugador puedes gastarlos en su **árbol de habilidades**
   por posición (3 tiers con requisitos previos): las skills desbloqueadas
   mejoran atributos concretos y se reflejan en el **gráfico de radar**
   (ritmo, tiro, pase, regate, defensa, físico; porteros con sus 4
   atributos propios).
6. Avanza la semana: finanzas, entrenamientos, cantera, mercado de la IA,
   ofertas, recuperación de lesionados, sincronización de wallets y **nuevas
   ofertas de patrocinio**.
5. Avanza la semana: finanzas, entrenamientos, cantera, mercado de la IA,
   ofertas, recuperación de lesionados, sincronización de wallets y **nuevas
   ofertas de patrocinio**.
7. Negocia patrocinios: camiseta y gradas del estadio (aceptar, contraoferta
   con riesgo de que retiren la oferta, rechazar). Los contratos se abonan
   semanalmente y caducan al terminar las temporadas firmadas.
8. Ficha, vende, renueva contratos, mejora instalaciones, promociona canteranos.
9. Tras 22 jornadas: premios, reparto de taquilla por posición y nueva
   temporada (envejecimiento, retiradas, contratos que expiran, agentes libres,
   vencimiento de patrocinios).

## Limitaciones conocidas (v1)

- Un único usuario contra 11 clubes IA; sin multijugador.
- La SIMCHAIN es local al proceso del servidor (persistida en JSON), no hay
  red P2P ni consenso: es una simulación honesta, nunca se presenta como real.
- Copa continental y otras competiciones no están en v1; la liga de 12 clubes
  es la competición completa y jugable de principio a fin.
- El login con Google (OAuth) NO está implementado: requiere credenciales de
  Google Cloud y una URL de redirección pública. Las cuentas son locales
  (usuario + contraseña con hash y salt) y el campo `provider` deja la
  integración preparada. En modo navegador todo vive en el localStorage del
  cliente: adecuado para jugar, no para proteger secretos. Para cuentas reales
  multiusuario conviene desplegar el servidor Node (Railway/Render/VPS).
- La recuperación de contraseña usa pregunta de seguridad (no hay envío de
  email: el juego no depende de ningún servicio externo). Tras 5 respuestas
  incorrectas la recuperación se bloquea 5 minutos. Si pierdes a la vez la
  contraseña y la respuesta, no hay forma automática de recuperar la cuenta:
  borra el archivo de cuentas del servidor (o los datos del navegador) y
  empieza de nuevo.
