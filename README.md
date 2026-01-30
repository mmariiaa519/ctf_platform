# 🚩 Plataforma CTF - Capture The Flag

Plataforma minimalista para competiciones CTF (Capture The Flag) construida con Node.js, Express y almacenamiento en JSON.

## 📋 Características

- ✅ Sistema de registro y autenticación de equipos
- ✅ 10 retos predefinidos de múltiples categorías (Web, Crypto, Forensics, Reversing, Pwn)
- ✅ Sistema de puntos con penalización por pistas
- ✅ Scoreboard en tiempo real
- ✅ Panel de administración completo
- ✅ Flags hasheadas con SHA256 para mayor seguridad
- ✅ Rate limiting para prevenir fuerza bruta
- ✅ Sistema de pistas progresivas (3 niveles)

## 🔐 Credenciales de Administrador

**Usuario:** `admin`
**Contraseña:** `CTF@dm1n!2026$SecurePwd`

> ⚠️ **IMPORTANTE:** Cambia estas credenciales después del primer despliegue usando el panel de administración o modificando directamente el archivo `data/admins.json` con un hash bcrypt nuevo.

## 🚀 Desplegar en Vercel (GRATIS)

### Opción 1: Despliegue desde GitHub (Recomendado)

1. **Subir el proyecto a GitHub:**

```bash
# Inicializar repositorio git
git init

# Agregar todos los archivos
git add .

# Hacer el primer commit
git commit -m "Initial commit - CTF Platform"

# Crear un repositorio en GitHub (https://github.com/new)
# Luego conectar tu repositorio local:
git remote add origin https://github.com/TU-USUARIO/TU-REPOSITORIO.git
git branch -M main
git push -u origin main
```

2. **Desplegar en Vercel:**
   - Ve a [vercel.com](https://vercel.com) y crea una cuenta (puedes usar GitHub)
   - Haz clic en "Add New Project"
   - Importa tu repositorio de GitHub
   - Vercel detectará automáticamente la configuración de `vercel.json`
   - Haz clic en "Deploy"
   - ¡Listo! Tu CTF estará disponible en una URL como `tu-proyecto.vercel.app`

### Opción 2: Despliegue con Vercel CLI

1. **Instalar Vercel CLI:**

```bash
npm install -g vercel
```

2. **Desplegar:**

```bash
# Desde el directorio del proyecto
vercel

# Seguir las instrucciones en pantalla
# Cuando pregunte por el directorio del proyecto, presiona Enter (usa el actual)
# Confirma las configuraciones sugeridas
```

3. **Despliegue a producción:**

```bash
vercel --prod
```

### Consideraciones para Vercel

⚠️ **Limitaciones del almacenamiento en JSON:**

Vercel utiliza un sistema de archivos efímero, lo que significa que los datos almacenados en archivos JSON se perderán entre despliegues. Para un entorno de producción real, considera:

- Usar una base de datos persistente (MongoDB Atlas, PostgreSQL, etc.)
- O mantener los datos en el repositorio Git y hacer commits periódicos

Para desarrollo y competiciones cortas, el sistema actual funciona perfectamente.

## 💻 Ejecutar Localmente

### Requisitos previos

- Node.js 14.x o superior
- npm o yarn

### Instalación

1. **Clonar o descargar el repositorio:**

```bash
git clone <url-del-repositorio>
cd CTF-Armada
```

2. **Instalar dependencias:**

```bash
npm install
```

3. **Iniciar el servidor:**

```bash
npm start
```

El servidor se iniciará en `http://localhost:3000`

### Scripts disponibles

```bash
npm start      # Inicia el servidor en producción
npm run dev    # Inicia el servidor en desarrollo
```

### Usando los scripts incluidos

**Windows:**
```bash
start.bat
```

**Linux/Mac:**
```bash
chmod +x start.sh
./start.sh
```

## 📁 Estructura del Proyecto

```
CTF-Armada/
├── data/                    # Base de datos JSON
│   ├── admins.json         # Administradores
│   ├── teams.json          # Equipos registrados
│   ├── challenges.json     # Retos del CTF
│   ├── submissions.json    # Flags enviadas
│   └── hint_unlocks.json   # Pistas desbloqueadas
├── public/
│   └── index.html          # Frontend (SPA)
├── node_modules/           # Dependencias (generado)
├── server.js               # Servidor Express
├── package.json            # Configuración de npm
├── vercel.json             # Configuración de Vercel
├── .gitignore             # Archivos ignorados por Git
├── start.bat              # Script de inicio para Windows
├── start.sh               # Script de inicio para Linux/Mac
└── README.md              # Este archivo

```

## 🎯 Categorías de Retos

La plataforma incluye 10 retos de ejemplo en las siguientes categorías:

- **Web** (400 pts): Vulnerabilidades web, inspección de código
- **Crypto** (700 pts): Criptografía y codificación
- **Forensics** (500 pts): Análisis forense
- **Reversing** (1000 pts): Ingeniería inversa
- **Pwn** (1000 pts): Explotación de binarios

## 🛠️ Panel de Administración

Accede al panel de administración haciendo clic en "Admin Login" en la página principal.

### Funcionalidades del admin:

- ✏️ Crear, editar y eliminar retos
- 👥 Ver y gestionar equipos
- 🗑️ Eliminar equipos específicos
- 🔄 Resetear toda la competición
- 📊 Ver estadísticas detalladas

## 🔒 Seguridad

### Flags Hasheadas

Las flags se almacenan hasheadas con SHA256 + salt para mayor seguridad:

```javascript
FLAG_SALT = process.env.FLAG_SALT || 'ctf-platform-secret-salt-2024'
```

### Rate Limiting

Sistema de rate limiting para envíos de flags:
- Máximo 10 intentos por minuto por equipo
- Previene ataques de fuerza bruta

### Variables de Entorno (Opcional)

Puedes configurar estas variables de entorno para mayor seguridad:

```bash
PORT=3000
SESSION_SECRET=tu-secreto-super-seguro-aquí
FLAG_SALT=tu-salt-personalizado-para-flags
NODE_ENV=production
```

Crea un archivo `.env` en la raíz del proyecto:

```env
SESSION_SECRET=cambiar-en-produccion-123456789
FLAG_SALT=mi-salt-secreto-para-flags-2024
```

## 📊 Sistema de Puntuación

Los puntos se calculan según las pistas utilizadas:

| Pistas usadas | Multiplicador | Ejemplo (500 pts base) |
|--------------|---------------|------------------------|
| 0 pistas     | 100%          | 500 pts                |
| 1 pista      | 75%           | 375 pts                |
| 2 pistas     | 50%           | 250 pts                |
| 3 pistas     | 30%           | 150 pts                |

## 🔄 Resetear Datos

### Resetear todos los equipos y puntuaciones:

Usa el botón "Reset All Data" en el panel de administración, o manualmente:

```bash
# Linux/Mac
echo "[]" > data/teams.json
echo "[]" > data/submissions.json
echo "[]" > data/hint_unlocks.json

# Windows PowerShell
"[]" | Out-File -Encoding UTF8 data/teams.json
"[]" | Out-File -Encoding UTF8 data/submissions.json
"[]" | Out-File -Encoding UTF8 data/hint_unlocks.json
```

## 🐛 Solución de Problemas

### El servidor no inicia

```bash
# Verificar que Node.js está instalado
node --version

# Reinstalar dependencias
rm -rf node_modules package-lock.json
npm install
```

### Error de permisos

```bash
# Linux/Mac
chmod +x start.sh
```

### Puerto ya en uso

Cambia el puerto en el archivo `.env` o usa:

```bash
PORT=4000 npm start
```

### Problemas en Vercel

- Verifica que `vercel.json` existe en la raíz del proyecto
- Asegúrate de que todas las dependencias están en `package.json`
- Revisa los logs en el dashboard de Vercel

## 🤝 Contribuir

Las contribuciones son bienvenidas. Para cambios importantes:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia MIT.

## 🎓 Uso Educativo

Esta plataforma está diseñada para:
- Competiciones CTF en universidades
- Workshops de ciberseguridad
- Entrenamientos de equipos
- Eventos de hacking ético

## 📞 Soporte

Para problemas o preguntas:
- Abre un issue en el repositorio
- Consulta la documentación de [Express.js](https://expressjs.com/)
- Revisa la [documentación de Vercel](https://vercel.com/docs)

---

**¡Buena suerte en tu CTF! 🚩**
