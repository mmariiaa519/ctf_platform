# MARSEC Cyber Range — Plataforma CTF

Plataforma web para ejercicios Capture The Flag (CTF) del MARSEC Cyber Range, desarrollada por TRUST Lab en la Universidad Politecnica de Cartagena (UPCT).

Arquitectura modular con Express.js (backend) y React + Vite (frontend), desplegable con Docker.

---

## Estructura del proyecto

```
ctf_platform/
├── server/                        # Backend — API Express.js
│   ├── server.js                  # Punto de entrada: middleware, sesion, rutas
│   ├── config.js                  # FLAG_SALT centralizado
│   ├── db.js                      # Base de datos JSON con backup atomico
│   ├── routes/
│   │   ├── auth.js                # POST /register, /login, /logout, /me, /admin/login
│   │   ├── challenges.js          # GET /challenges, POST /submit, POST /hint
│   │   ├── scoreboard.js          # GET /scoreboard, GET /submissions/:teamId
│   │   └── admin.js               # CRUD retos, equipos, reset, stats
│   ├── middleware/
│   │   ├── auth.js                # requireAuth, requireAdmin (guards de sesion)
│   │   └── rateLimit.js           # loginLimiter (5/60s), flagLimiter (10/60s)
│   └── package.json               # Dependencias del servidor
│
├── client/                        # Frontend — React 18 + Vite
│   ├── src/
│   │   ├── main.jsx               # Entry point React
│   │   ├── App.jsx                # Rutas + AuthProvider
│   │   ├── lib/api.js             # Wrapper fetch para /api
│   │   ├── hooks/useAuth.jsx      # Contexto de autenticacion
│   │   ├── pages/
│   │   │   ├── Login.jsx          # Formulario de acceso de equipos
│   │   │   ├── Register.jsx       # Registro de equipos
│   │   │   ├── Dashboard.jsx      # Vista principal: retos + clasificacion
│   │   │   └── Admin.jsx          # Panel de administracion
│   │   ├── components/
│   │   │   ├── Navbar.jsx         # Barra de navegacion sticky
│   │   │   ├── ParticleBackground.jsx  # Fondo animado canvas
│   │   │   ├── ChallengeCard.jsx  # Tabla de retos (ChallengeList)
│   │   │   ├── ChallengeModal.jsx # Modal de envio de flag
│   │   │   ├── Scoreboard.jsx     # Tabla de clasificacion
│   │   │   └── TeamHistory.jsx    # Historial de un equipo
│   │   └── styles/index.css       # Sistema de diseno completo
│   ├── public/                    # Assets estaticos (logos, favicon)
│   ├── vite.config.js             # Proxy /api → localhost:3000
│   └── package.json               # Dependencias del cliente
│
├── data/                          # Base de datos JSON (runtime)
│   ├── challenges.json            # Definicion de retos (flagHash SHA256)
│   ├── teams.json                 # Equipos registrados
│   ├── submissions.json           # Envios de flags correctos
│   ├── hint_unlocks.json          # Pistas desbloqueadas
│   └── admins.json                # Cuentas de administrador
│
├── Dockerfile                     # Build multi-stage (React build + Express)
├── docker-compose.yml             # Orquestacion con volumen de datos
├── .env.example                   # Plantilla de variables de entorno
├── migrate-flags.js               # Utilidad: migrar flags texto plano → SHA256
├── start-client.mjs               # Arranca Vite dev server para desarrollo
└── package.json                   # Scripts de conveniencia (npm start, dev)
```

---

## Inicio rapido

### Requisitos

- **Node.js** 18+ (recomendado 20 LTS)
- **npm** (incluido con Node.js)

### Desarrollo local

```bash
# 1. Clonar el repositorio
git clone <url-del-repositorio>
cd ctf_platform

# 2. Instalar dependencias del servidor
cd server && npm install && cd ..

# 3. Instalar dependencias del cliente
cd client && npm install && cd ..

# 4. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores (ver seccion Configuracion)

# 5. Arrancar backend (terminal 1)
npm run dev:server

# 6. Arrancar frontend (terminal 2)
npm run dev:client
```

- Backend: `http://localhost:3000` (API)
- Frontend: `http://localhost:5173` (con HMR y proxy a la API)

### Docker (produccion)

```bash
# Configurar variables de entorno
cp .env.example .env
# Editar .env con valores seguros

# Construir y arrancar
docker compose up -d --build

# Ver logs
docker compose logs -f

# Detener
docker compose down
```

La plataforma estara disponible en `http://localhost:3060`.

---

## Configuracion

Variables de entorno (archivo `.env`):

| Variable | Descripcion | Valor por defecto |
|----------|-------------|-------------------|
| `NODE_ENV` | Entorno de ejecucion | `production` |
| `PORT` | Puerto del servidor Express | `3000` |
| `SESSION_SECRET` | Clave para firmar cookies de sesion (cambiar en produccion) | `marsec-session-...` |
| `FLAG_SALT` | Salt para hashing SHA256 de flags — **NO cambiar si ya existen hashes** | `ctf-platform-secret-salt-2024` |
| `ADMIN_USER` | Usuario administrador por defecto | `admin` |
| `ADMIN_PASS` | Password del admin (min 8 caracteres, cambiar en produccion) | `CTF@dm1n!2026$SecurePwd` |

---

## API — Endpoints

### Publicos

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| `POST` | `/api/register` | Registrar equipo (name, password) |
| `POST` | `/api/login` | Login de equipo |
| `POST` | `/api/logout` | Cerrar sesion |
| `GET` | `/api/me` | Estado de sesion actual |
| `GET` | `/api/challenges` | Listar retos (sin flagHash) |
| `GET` | `/api/scoreboard` | Clasificacion general |
| `GET` | `/api/scoreboard/submissions/:teamId` | Historial de un equipo |

### Autenticados (requieren sesion de equipo)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| `POST` | `/api/challenges/submit` | Enviar flag (challengeId, flag) |
| `POST` | `/api/challenges/hint` | Desbloquear pista (challengeId) |

### Admin (requieren sesion de administrador)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| `POST` | `/api/admin/login` | Login de administrador |
| `GET` | `/api/admin/challenges` | Listar retos con metadata |
| `POST` | `/api/admin/challenges` | Crear reto |
| `PUT` | `/api/admin/challenges/:id` | Actualizar reto |
| `DELETE` | `/api/admin/challenges/:id` | Eliminar reto (cascade) |
| `GET` | `/api/admin/teams` | Listar equipos con puntuaciones |
| `DELETE` | `/api/admin/teams/:id` | Eliminar equipo (cascade) |
| `POST` | `/api/admin/reset` | Resetear equipos, submissions, hints |
| `GET` | `/api/admin/stats` | Estadisticas generales |

---

## Retos del MARSEC Cyber Range

7 retos organizados siguiendo una kill chain:

| Orden | Titulo | Categoria | Puntos |
|-------|--------|-----------|--------|
| 0 | Superficie expuesta | RECON | 100 |
| 1 | La primera grieta | INTRUSION | 100 |
| 2 | Lo que no se ve | FORENSICS | 300 |
| 3 | Mensajes internos | SIGINT | 300 |
| 4 | Un nivel mas arriba | PRIVESC | 500 |
| 5 | Dejar huella | PERSISTENCE | 500 |
| 6 | El secreto mejor guardado | CRYPTO | 1000 |

**Total posible:** 2.800 puntos (sin penalizacion por pistas).

### Sistema de puntuacion

| Pistas usadas | Puntos otorgados |
|---------------|------------------|
| 0 pistas | 100% de la base |
| 1 pista | 50% de la base |

### Formato de flags

```
FLAG{...}    o    F14G{...}
```

Las flags se almacenan como hashes SHA256 con salt. El texto plano nunca se guarda en disco.

---

## Seguridad

### Medidas implementadas

| Proteccion | Implementacion |
|------------|----------------|
| Flags hasheadas | SHA256 con salt (nunca en texto plano) |
| Comparacion timing-safe | `crypto.timingSafeEqual` contra side-channel |
| Rate limiting | 5 intentos/min login, 10 intentos/min flags |
| Cabeceras HTTP | Helmet.js con CSP configurado |
| Cookies seguras | httpOnly, sameSite=strict, secure en produccion |
| Passwords | bcrypt con cost factor 12 |
| Body limit | 100kb maximo por peticion |
| Trust proxy | Configurado para Docker/nginx |

### Migracion de flags

Si tienes flags en texto plano en `challenges.json` (propiedad `flag`), ejecuta:

```bash
npm run migrate
```

Esto genera los hashes SHA256 y elimina las flags en texto plano. Crea un backup automatico antes de modificar.

---

## Resetear datos

### Desde el panel de admin

Boton "Resetear todo" en la seccion de control. Requiere doble confirmacion. Elimina equipos, submissions y hints. Los retos se conservan.

### Manualmente

```bash
echo "[]" > data/teams.json
echo "[]" > data/submissions.json
echo "[]" > data/hint_unlocks.json
```

---

## Diseno visual

Sistema de diseno basado en el Brand Book de TRUST Lab:

| Token | Valor | Uso |
|-------|-------|-----|
| TRUST BLUE | `#02eef0` | Acentos, estados activos, glow |
| LAB BLUE | `#1625ee` | Botones primarios, header |
| Fondo principal | `#080c18` | Background del body |
| Fuente body | Sora | Texto general |
| Fuente code | JetBrains Mono | Flags, valores numericos |
| Border radius | 4px max | Segun Brand Book |

Efectos visuales: glassmorphism, particulas canvas animadas, glow TRUST BLUE.

---

## Scripts npm

Desde la raiz del proyecto:

```bash
npm start           # Arranca el servidor de produccion
npm run dev:server   # Arranca el backend en desarrollo
npm run dev:client   # Arranca el frontend Vite con HMR
npm run migrate      # Migra flags texto plano a SHA256
```

---

## Tecnologias

### Backend
- **Express.js** 4.18 — framework HTTP
- **express-session** — sesiones con cookies firmadas
- **bcryptjs** — hashing de passwords
- **helmet** — cabeceras de seguridad (CSP, HSTS, etc.)
- **express-rate-limit** — proteccion contra fuerza bruta
- **uuid** — generacion de IDs unicos

### Frontend
- **React** 18 — biblioteca de UI
- **React Router** 6 — enrutamiento SPA
- **Vite** 5 — bundler y dev server con HMR

### Infraestructura
- **Docker** — contenedorizacion multi-stage
- **Node.js** 20 Alpine — imagen base ligera

---

## Licencia

Proyecto academico desarrollado por TRUST Lab, Universidad Politecnica de Cartagena.
