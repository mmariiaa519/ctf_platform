# ══════════════════════════════════════════════════════════════
# Dockerfile — Build multi-stage para la plataforma MARSEC CTF
#
# Stage 1 (frontend): Instala deps del cliente y genera el build
#   estatico de React con Vite (HTML/CSS/JS optimizados).
#
# Stage 2 (production): Copia el servidor Node.js y el build del
#   frontend en una imagen limpia sin herramientas de build.
#
# Resultado: imagen ligera (~180MB) con Express sirviendo
#   tanto la API como el frontend estatico en el puerto 3000.
# ══════════════════════════════════════════════════════════════

# ── Stage 1: Build del frontend React con Vite ──────────────
FROM node:20-alpine AS frontend
WORKDIR /build

# Copiar solo package*.json primero para aprovechar la cache de Docker
# (si las deps no cambian, no se reinstalan en builds sucesivos)
COPY client/package*.json ./
RUN npm install

# Copiar el resto del codigo del cliente y generar el build estatico
COPY client/ ./
RUN npm run build
# Resultado: /build/dist/ contiene index.html + assets optimizados

# ── Stage 2: Servidor de produccion ─────────────────────────
FROM node:20-alpine
WORKDIR /app

# Instalar solo dependencias de produccion (sin devDependencies)
COPY server/package*.json ./
RUN npm install --omit=dev

# Copiar el codigo del servidor
COPY server/ ./

# Copiar el build del frontend desde Stage 1 a server/dist/
# Express lo servira como archivos estaticos (ver server.js)
COPY --from=frontend /build/dist ./dist

# Crear directorio data/ para la base de datos JSON
# (en produccion se monta como volumen desde docker-compose)
RUN mkdir -p data

# Puerto interno del servidor Express
EXPOSE 3000

# Arrancar el servidor
CMD ["node", "server.js"]
