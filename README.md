# PROYECTO-POLIZAS-BACKEND — API REST

Apartado Backed del proyecto Polizas de servicios para COMPUSERVICIOS BCS

## Stack

- **Node.js + Express**
- **MySQL** (XAMPP / phpMyAdmin) (Prueba Local)

## Endpoints

| Método   | Ruta                             | Descripción               |
| -------- | -------------------------------- | ------------------------- |
| GET      | `/api/health`                    | Estado del servidor       |
| GET/POST | `/api/servicios`                 | Catálogo de servicios     |
| GET/POST | `/api/polizas`                   | Catálogo de pólizas       |
| GET/POST | `/api/empresas`                  | Directorio de empresas    |
| GET      | `/api/empresas/:id`              | Expediente completo       |
| POST     | `/api/empresas/:id/polizas`      | Vincular póliza           |
| POST     | `/api/empresas/:id/usuarios`     | Añadir usuario            |
| GET/POST | `/api/incidencias`               | Gestión de incidencias    |
| GET      | `/api/incidencias/stats`         | Estadísticas generales    |
| PATCH    | `/api/incidencias/:id/estatus`   | Cambiar estatus           |
| PATCH    | `/api/incidencias/:id/cerrar`    | Cerrar + generar JSON bot |
| POST     | `/api/incidencias/:id/notas`     | Añadir nota               |
| PATCH    | `/api/incidencias/:id/cita`      | Agendar/reagendar cita    |
| GET      | `/api/historial`                 | Incidencias cerradas      |
| GET      | `/api/historial/reporte-mensual` | Reporte mensual           |
| GET/POST | `/api/calendario`                | Mantenimientos            |
| GET      | `/api/tecnicos`                  | Lista de técnicos         |

---

## Estructura del proyecto

```
polizas-api/
├── src/
│   ├── index.js                    # Entry point
│   ├── database/
│   │   ├── connection.js           # Pool MySQL
│   │   ├── schema.sql              # Esquema completo
│   │   └── init.js                 # Script de inicialización
│   ├── middlewares/
│   │   ├── errorHandler.js
│   │   └── validate.js
│   ├── utils/
│   │   └── response.js
│   └── modules/
│       ├── servicios/
│       ├── polizas/
│       ├── empresas/
│       ├── incidencias/
│       ├── historial/
│       ├── calendario/
│       └── usuarios/
├── .env.example
├── .gitignore
└── package.json
```
