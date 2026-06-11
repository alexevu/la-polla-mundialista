# Polla Mundialista ⚽🏆

Aplicación web completa para gestionar el sorteo de selecciones de fútbol en una "polla mundialista" o lotería. Diseñada con una interfaz moderna, responsiva, con efecto de ruleta animada durante 5 segundos y persistencia en **Azure Table Storage**. El backend está implementado en **Azure Functions (Node.js)** de forma transaccional para garantizar que ningún equipo sea asignado por duplicado. Es desplegable en **Azure Static Web Apps (ASWA)**.

---

## Características de la Aplicación

1.  **Frontend Dinámico:** Desarrollado en HTML, CSS y JavaScript puro con estética oscura, moderna y efectos de vidrio esmerilado (glassmorphic UI) optimizada para dispositivos móviles.
2.  **Animación de Ruleta:** Muestra una ruleta tipo slot-machine durante exactamente 5 segundos que pasa por banderas y nombres de los equipos antes de frenar en el equipo ganador.
3.  **Celebración Visual:** Efecto de confeti en pantalla usando la librería `canvas-confetti` al revelar la selección asignada.
4.  **Backend Transaccional:** El sorteo se ejecuta en el servidor usando transacciones del grupo de entidades (Entity Group Transactions) de Azure Table Storage para evitar que dos usuarios obtengan el mismo equipo al mismo tiempo.
5.  **Control de Duplicidad:** Si un participante busca sortear con un nombre ya registrado, el sistema no le permite repetir el sorteo, sino que le muestra directamente la selección que ya le había sido asignada.
6.  **Panel de Administración Protegido:**
    *   Ingreso mediante contraseña segura configurada por variables de entorno.
    *   Estadísticas en tiempo real (participantes, equipos totales y libres).
    *   Visualización de todas las asignaciones (fecha, nombre del participante y equipo).
    *   Lista de estado de disponibilidad de los equipos.
    *   Opción para reiniciar el sorteo completamente.
    *   Opción para reconfigurar la lista de selecciones participantes escribiéndolas en un cuadro de texto (línea por línea).

---

## Estructura de Carpetas

```
polla-mundialista/
├── staticwebapp.config.json    # Configuración de enrutamiento y redirecciones de ASWA
├── src/                         # Archivos estáticos del Frontend
│   ├── index.html               # Vista del sorteo principal
│   ├── admin.html               # Panel de control de administrador
│   ├── css/
│   │   └── style.css            # Estilos CSS premium (colores HSL y animaciones)
│   └── js/
│       ├── app.js               # Lógica del cliente, ruleta y validaciones
│       └── admin.js             # Lógica del panel administrativo
└── api/                         # Backend (Azure Functions en Node.js)
    ├── package.json             # Dependencias de npm de la API
    ├── host.json                # Configuración de la API en Azure
    ├── local.settings.json      # Configuración para entorno de pruebas local (puerto, secretos)
    └── src/
        ├── shared/
        │   └── tableService.js  # Conexión centralizada a base de datos e inicialización automática
        └── functions/
            ├── draw.js          # Sorteo transaccional (POST /api/draw)
            ├── getStatus.js     # Consulta de participante (GET /api/status?name=...)
            ├── getTeams.js      # Listado público de equipos (GET /api/teams)
            └── admin.js         # Rutas de administración (GET/POST /api/manage/{action})
```

---

## Requisitos Previos para Desarrollo Local

Para correr este proyecto en tu computadora, necesitas tener instalado:

1.  **Node.js** (Versión 18 o superior).
2.  **Azure Functions Core Tools** (Versión 4.x).
3.  **Azure Static Web Apps CLI (SWA CLI)** para emular el entorno de Azure de manera local.
    ```bash
    npm install -g @azure/static-web-apps-cli
    ```
4.  **Azurite** (Emulador de Azure Storage local). Puedes ejecutarlo como extensión en VS Code o instalarlo por npm:
    ```bash
    npm install -g azurite
    ```

---

## Ejecución en Local (Paso a Paso)

1.  **Iniciar Azurite (Emulador de Almacenamiento):**
    En una consola independiente, crea un directorio para los datos temporales y arranca Azurite:
    ```bash
    mkdir azurite_data
    azurite --silent --location azurite_data --debug azurite_data/debug.log
    ```

2.  **Instalar dependencias del Backend:**
    Abre una consola en la carpeta `api/` e instala las dependencias necesarias:
    ```bash
    cd api
    npm install
    cd ..
    ```

3.  **Configurar Variables de Entorno Locales:**
    Verifica que el archivo `api/local.settings.json` tenga la siguiente estructura:
    ```json
    {
      "IsEncrypted": false,
      "Values": {
        "AzureWebJobsStorage": "UseDevelopmentStorage=true",
        "FUNCTIONS_WORKER_RUNTIME": "node",
        "AzureTableStorageConnectionString": "UseDevelopmentStorage=true",
        "ADMIN_PASSWORD": "admin123"
      },
      "Host": {
        "CORS": "*"
      }
    }
    ```
    *Nota: La contraseña predeterminada del administrador en local será `admin123`.*

4.  **Iniciar el Emulador de Azure Static Web Apps (SWA CLI):**
    En el directorio raíz del proyecto (`polla-mundialista/`), ejecuta el comando de SWA CLI. Esto arrancará el servidor de frontend y el servidor de API al mismo tiempo y los unirá bajo un único puerto local (por defecto `http://localhost:4280`):
    ```bash
    swa start src --api-location api
    ```

5.  **Probar la Aplicación:**
    *   Ingresa a tu navegador a `http://localhost:4280`.
    *   Prueba agregando participantes y realizando el sorteo. Verás la animación de la ruleta durante 5 segundos y los confetis de celebración.
    *   Ingresa a `http://localhost:4280/admin` (o haz clic en el enlace del pie de página) e introduce la contraseña `admin123` para ver el panel de control, reiniciar el sorteo o modificar la lista de equipos participantes.

---

## Despliegue en Azure (Paso a Paso)

El despliegue se realiza de forma directa y unificada en **Azure Static Web Apps**.

### Paso 1: Subir el código a GitHub
Sube este directorio completo (`polla-mundialista`) a un repositorio de GitHub (público o privado).

### Paso 2: Crear el recurso en Azure Portal
1.  Ingresa a [Azure Portal](https://portal.azure.com/).
2.  Busca y selecciona **Static Web Apps** y haz clic en **Create**.
3.  Configura los detalles del recurso:
    *   **Subscription:** Selecciona tu suscripción activa.
    *   **Resource Group:** Selecciona o crea uno nuevo.
    *   **Name:** `polla-mundialista` (o el nombre que prefieras).
    *   **Plan type:** **Free** (el plan gratuito incluye Azure Functions administradas y ancho de banda suficiente).
    *   **Region:** Elige la región más cercana a tus usuarios (ej. `East US 2`).
4.  En la sección **Deployment details**:
    *   Selecciona **GitHub** como fuente e inicia sesión con tu cuenta.
    *   Elige tu **Organization**, **Repository** y la **Branch** (ej. `main`).
5.  En **Build Details** (Configuración del compilador):
    *   **Build Presets:** Selecciona **Custom**.
    *   **App location:** `/src` (donde se encuentran el HTML/CSS/JS).
    *   **Api location:** `/api` (donde se encuentra el código de Node.js).
    *   **Output location:** Deja este campo **vacío** (ya que estamos sirviendo HTML/JS puro directamente sin compilador como React/Vite).
6.  Haz clic en **Review + create** y luego en **Create**.
7.  Azure creará un flujo de trabajo de GitHub Actions en tu repositorio que automatizará la compilación y el despliegue cada vez que hagas push a la rama seleccionada.

### Paso 3: Configurar Azure Table Storage en Producción
Para que la aplicación guarde los datos en la nube de forma segura y permanente:
1.  Crea una cuenta de almacenamiento en Azure (**Storage Account**).
2.  Una vez creada, ve al recurso, ingresa a la sección **Access keys** (en el menú de la izquierda) y copia el **Connection string** (Cadena de conexión).
3.  Regresa a tu recurso de **Static Web App** en el portal.
4.  Ingresa a la sección **Configuration** (Configuración) en el menú lateral.
5.  En la pestaña **Application settings**, añade dos nuevas variables:
    *   **Nombre:** `AzureTableStorageConnectionString` | **Valor:** *Pega la cadena de conexión de tu Storage Account copiada anteriormente.*
    *   **Nombre:** `ADMIN_PASSWORD` | **Valor:** *Escribe la contraseña que desees para proteger tu panel de administración (ej. MiSuperContrasenaDePolla2026).*
6.  Haz clic en **Save** (Guardar) al final de la página.

¡Listo! En unos minutos, el flujo de GitHub Actions terminará y Azure te proporcionará una URL pública para que los participantes ingresen al sorteo y vivan la emoción de la Polla Mundialista.
