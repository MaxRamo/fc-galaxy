# ⚽ FC Galaxy — Manager de Fútbol con Economía Blockchain Simulada

> Juego Manager de Fútbol en blockchain (capa blockchain simulada internamente).

Videojuego de gestión futbolística completo y jugable, con una capa de economía
blockchain **simulada** (SIMCHAIN). Cero dependencias externas: solo Node.js
(módulos `http`, `fs`, `path`, `crypto`).

## Cómo jugar

```bash
npm start          # servidor en http://localhost:3000
```

Abre `http://localhost:3000`, funda tu club y gestiona: plantilla, tácticas,
entrenamientos, mercado, cantera, finanzas y tu wallet en la SIMCHAIN. El
progreso se guarda automáticamente en `server/data/save.json` (escritura
atómica) y se restaura al reiniciar el servidor, incluido el estado del
generador aleatorio (partidas reproducibles entre sesiones).

Otros comandos:

```bash
npm test           # 18 tests: blockchain, motor, mercado, temporada completa headless, persistencia
```

## Arquitectura

```
blockchain/            ← capa blockchain SIMULADA, 100% separada del juego
  chain.js             bloques SHA-256 encadenados por prevHash + validación
  token.js             ledger del token FCG (mint / transfer / burn)
  nft.js               registro de activos únicos por jugador (SIM-721)
  contract.js          "contrato inteligente" simulado de traspasos (atómico, 4% quemado)

server/
  index.js             servidor HTTP sin dependencias + API REST
  store.js             persistencia JSON atómica + restauración de RNG
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

1. Funda tu club (nombre, ciudad, colores, formación).
2. Configura alineación y tácticas (campo interactivo, auto-completar).
3. Juega la jornada en vivo (eventos minuto a minuto, cambios en el descanso
   y en el minuto 75) o simula el resultado.
4. Avanza la semana: finanzas, entrenamientos, cantera, mercado de la IA,
   ofertas, recuperación de lesionados, sincronización de wallets.
5. Ficha, vende, renueva contratos, mejora instalaciones, promociona canteranos.
6. Tras 22 jornadas: premios, reparto de taquilla por posición y nueva
   temporada (envejecimiento, retiradas, contratos que expiran, agentes libres).

## Limitaciones conocidas (v1)

- Un único usuario contra 11 clubes IA; sin multijugador.
- La SIMCHAIN es local al proceso del servidor (persistida en JSON), no hay
  red P2P ni consenso: es una simulación honesta, nunca se presenta como real.
- Copa continental y otras competiciones no están en v1; la liga de 12 clubes
  es la competición completa y jugable de principio a fin.
